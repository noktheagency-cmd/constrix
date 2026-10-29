import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {BlobFile,Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {TenantCtx,TenantService} from '../platform/tenant.service';
import {inspectFile,scanFile} from './file-security';
import {serializable} from '../prisma/serializable';
const SEATS:Record<string,string[]>={commercial:['direktor','satinalma','muhasib','smeta','huquq'],project:['direktor','layihe','sahe','muhendis','anbardar','satinalma'],certificate:['direktor','satinalma','smeta','muhendis','anbardar','layihe','sahe'],hr:['direktor','kadr','muhasib']};
const metadata=(file:BlobFile)=>{const {original,...rest}=file;return rest;};
@Injectable()
export class BlobFilesService{
 constructor(private readonly prisma:PrismaService,private readonly tenant:TenantService){}
 private kindAccess(ctx:TenantCtx,kind:string){this.tenant.requireOrg(ctx);if(!SEATS[kind]?.includes(ctx.seat||''))throw new ForbiddenException('Bu növ sənədə səlahiyyətiniz yoxdur');}
 async list(ctx:TenantCtx){const organizationId=this.tenant.requireOrg(ctx);return this.prisma.blobFile.findMany({where:{organizationId,kind:{in:Object.keys(SEATS).filter(kind=>SEATS[kind].includes(ctx.seat||''))}},select:{id:true,name:true,mime:true,kind:true,size:true,sha256:true,parentId:true,version:true,scanStatus:true,scanNote:true,createdAt:true},orderBy:{createdAt:'desc'},take:500});}
 async upload(ctx:TenantCtx,bytes:Buffer,input:{name:string;kind:string;parentId:string;key:string}){
  this.kindAccess(ctx,input.kind);const {name,mime}=inspectFile(input.name,bytes),organizationId=this.tenant.requireOrg(ctx),sha256=createHash('sha256').update(bytes).digest('hex');
  if(!/^[\w-]{16,100}$/.test(input.key))throw new BadRequestException('Yükləmə açarı düzgün deyil');
  const hash=createHash('sha256').update(JSON.stringify({...input,key:undefined,sha256})).digest('hex');const previous=await this.prisma.operationReceipt.findUnique({where:{organizationId_key:{organizationId,key:input.key}}});
  if(previous){if(previous.requestHash!==hash||previous.accountId!==ctx.accountId)throw new BadRequestException('Yükləmə açarı başqa fayla aiddir');return previous.changedBooks;}
  let parentId:string|null=null;if(input.parentId){const parent=await this.prisma.blobFile.findFirst({where:{id:input.parentId,organizationId,kind:input.kind}});if(!parent)throw new NotFoundException('Əvvəlki versiya tapılmadı');parentId=parent.parentId||parent.id;}
  const scan=await scanFile(bytes);
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`file:${organizationId}:${parentId||input.key}`}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId,key:input.key}}});if(replay){if(replay.requestHash!==hash||replay.accountId!==ctx.accountId)throw new BadRequestException('Yükləmə açarı təkrarlanır');return replay.changedBooks;}
   const latest=parentId?await tx.blobFile.findFirst({where:{organizationId,OR:[{id:parentId},{parentId}]},orderBy:{version:'desc'}}):null;
   const file=await tx.blobFile.create({data:{organizationId,uploadedBy:ctx.accountId,name,mime,kind:input.kind,size:bytes.length,sha256,original:Uint8Array.from(bytes),parentId,version:(latest?.version||0)+1,scanStatus:scan.status,scanNote:scan.note}});
   const result=metadata(file);await tx.operationReceipt.create({data:{organizationId,accountId:ctx.accountId,key:input.key,requestHash:hash,command:'file-upload',changedBooks:JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue}});
   await tx.auditEntry.create({data:{organizationId,at:new Date().toISOString(),actor:ctx.name,role:ctx.seat||ctx.accountRole,action:'Sənəd yükləndi',detail:JSON.stringify({id:file.id,name,version:file.version,scan:scan.status,sha256})}});return result;
  });
 }
 async requireOwn(ctx:TenantCtx,ids:string[],kind?:string){
  const organizationId=this.tenant.requireOrg(ctx);if(!ids.length)return;const unique=[...new Set(ids)],count=await this.prisma.blobFile.count({where:{id:{in:unique},organizationId,scanStatus:'clean',...(kind?{kind}: {})}});if(count!==unique.length)throw new BadRequestException('Sənəd sizə aid deyil və ya təhlükəsizlik yoxlaması tamamlanmayıb');
 }
 private async shared(ctx:TenantCtx,file:BlobFile){
  if(!['direktor','satinalma','muhasib','smeta','huquq'].includes(ctx.seat||''))return false;const orgId=this.tenant.requireOrg(ctx);
  const cases=await this.prisma.marketCase.findMany({where:{data:{path:['files'],array_contains:[file.id]}},take:200});const profile=await this.prisma.marketCompany.findUnique({where:{organizationId:orgId}});
  for(const row of cases){if(row.buyerId===orgId||row.supplierId===orgId)return true;if(row.kind==='rfq'&&row.status!=='draft'&&profile?.status==='approved'){
    if(row.visibility==='private'&&(row.invited as string[]).includes(orgId))return true;
    if(row.visibility==='open'){const data=row.data as {lines:{itemId:string}[]};const listing=await this.prisma.marketListing.findFirst({where:{organizationId:orgId,itemId:{in:data.lines.map(l=>l.itemId)},region:row.region}});if(listing)return true;}
   }}
  const bids=await this.prisma.marketBid.findMany({where:{data:{path:['files'],array_contains:[file.id]}},take:100});for(const bid of bids){if(await this.prisma.marketCase.findFirst({where:{id:bid.rfqId,buyerId:orgId}}))return true;}
  const messages=await this.prisma.marketMessage.findMany({where:{recipientId:orgId,organizationId:file.organizationId,attachments:{array_contains:[file.id]}},select:{caseId:true},take:100});
  for(const message of messages){if(await this.prisma.marketCase.findFirst({where:{id:message.caseId,OR:[{buyerId:orgId},{supplierId:orgId},{kind:'rfq',invited:{array_contains:[orgId]}},{kind:'rfq',visibility:'open'}]}}))return true;}
  return false;
 }
 async download(ctx:TenantCtx,id:string){
  this.tenant.requireOrg(ctx);const file=await this.prisma.blobFile.findUnique({where:{id}});if(!file||file.scanStatus!=='clean')throw new NotFoundException('Təhlükəsizlik yoxlamasından keçmiş sənəd tapılmadı');
  let allowed=false;if(file.organizationId===ctx.orgId){this.kindAccess(ctx,file.kind);allowed=true;}else if(ctx.kind==='admin'&&ctx.seat==='direktor'){
   const [company,item,payment]=await Promise.all([this.prisma.marketCompany.findFirst({where:{organizationId:file.organizationId,status:{in:['pending','changes']},documents:{array_contains:[id]}}}),this.prisma.marketItem.findFirst({where:{ownerId:file.organizationId,status:'pending',documents:{array_contains:[id]}}}),this.prisma.marketPayment.findFirst({where:{organizationId:file.organizationId,status:'pending',proof:id}})]);allowed=!!(company||item||payment);
  }
  if(!allowed)allowed=await this.shared(ctx,file);if(!allowed)throw new NotFoundException('Sənəd tapılmadı');
  await this.prisma.auditEntry.create({data:{organizationId:file.organizationId,at:new Date().toISOString(),actor:ctx.name,role:ctx.seat||ctx.accountRole,action:'Sənədə baxış',detail:JSON.stringify({fileId:id,viewerOrganizationId:ctx.orgId,viewerAccountId:ctx.accountId})}});return file;
 }
 async rescan(ctx:TenantCtx,id:string){const file=await this.prisma.blobFile.findFirst({where:{id,organizationId:this.tenant.requireOrg(ctx)}});if(!file)throw new NotFoundException('Sənəd tapılmadı');this.kindAccess(ctx,file.kind);const scan=await scanFile(Buffer.from(file.original));return metadata(await this.prisma.blobFile.update({where:{id},data:{scanStatus:scan.status,scanNote:scan.note}}));}
}
