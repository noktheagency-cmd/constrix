import {BadRequestException,ForbiddenException,Injectable,NotFoundException,ConflictException} from '@nestjs/common';
import {Prisma,MarketCase} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';
import {TenantCtx,TenantService} from './tenant.service';
import {serializable} from '../prisma/serializable';
import {chooseTariff,commission,decimal,debtStage,monthlyStatement,settlementLine,Tariff} from './market-settlement';
import {BlobFilesService} from '../records/blob-files.service';

type Row=Record<string,unknown>;
type Line={id:string;itemId:string;name:string;unit:string;qty:string;spec:string;unitNet?:string;vatRate?:string};
type Receipt={id:string;acceptedAt:string;lines:{lineId:string;accepted:string;disputed:string;net:string;gross:string}[];proof:string;projectId:string;locationId:string;awaitingTariff:boolean};
type Delivery={id:string;lines:{lineId:string;qty:string}[];proof:string;createdAt:string};
type Dispute={id:string;receiptId:string;lineId:string;qty:string;status:'open'|'resolved';acceptedQty?:string;rejectedQty?:string;note?:string;recommendation?:string};
type ReturnRecord={id:string;receiptId:string;lineId:string;qty:string;status:'requested'|'confirmed';requestedBy:string;note:string;proof?:string};
type CaseData={title:string;lines:Line[];address:string;requiredDate:string;files:string[];payment?:string;deliveryCost?:string;validUntil?:string;deliveries?:Delivery[];receipts?:Receipt[];projectId?:string;locationId?:string;erpLinked?:boolean;contractId?:string;sourceRfqId?:string;disputes?:Dispute[];returns?:ReturnRecord[]};
const bodyData=(row:MarketCase)=>row.data as unknown as CaseData;
const input=(value:unknown,label:string,max=4000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new BadRequestException(`${label} düzgün deyil`);return value.trim();};
const list=(value:unknown,label:string)=>{if(!Array.isArray(value)||value.length>100)throw new BadRequestException(`${label} siyahısı düzgün deyil`);return value;};
const records=(value:unknown,label:string):Row[]=>list(value,label).map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw new BadRequestException(label+' sətri düzgün deyil');return row as Row;});
const strings=(value:unknown)=>list(value||[],'Sənəd').map(v=>input(v,'Sənəd',500));
const date=(value:unknown)=>{const s=String(value||'');if(!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw new BadRequestException('Tarix düzgün deyil');return s;};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const plusDays=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const asJson=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const norms=(s:string)=>s.toLocaleLowerCase('az').replace(/\s+/g,' ').trim();

@Injectable()
export class MarketService{
 constructor(private readonly prisma:PrismaService,private readonly tenant:TenantService,private readonly files:BlobFilesService){}
 private org(ctx:TenantCtx){return this.tenant.requireOrg(ctx);}
 private trade(ctx:TenantCtx){this.org(ctx);if(!['direktor','satinalma'].includes(ctx.seat||''))throw new ForbiddenException('Kommersiya əməliyyatı səlahiyyətiniz yoxdur');}
 private admin(ctx:TenantCtx){this.tenant.admin(ctx);}
 private async verified(ctx:TenantCtx,db:Prisma.TransactionClient|PrismaService=this.prisma){const orgId=this.org(ctx);const row=await db.marketCompany.findUnique({where:{organizationId:orgId}});if(row?.status!=='approved')throw new ForbiddenException('Əvvəl şirkətin bazar qeydiyyatı moderator tərəfindən təsdiqlənməlidir');return row;}
 private async policy(tx:Prisma.TransactionClient|PrismaService=this.prisma){return await tx.marketPolicy.findUnique({where:{id:'default'}})||{dueDays:7,warnDays:15,restrictDays:30,requiredProofCategories:[]};}
 private async newAllowed(ctx:TenantCtx,db:Prisma.TransactionClient|PrismaService=this.prisma){
  this.trade(ctx);await this.verified(ctx,db);const p=await this.policy(db);const charges=await db.marketCharge.findMany({where:{organizationId:this.org(ctx)}});
  for(const c of charges){const effective=Prisma.Decimal.max(0,c.amount.minus(c.credit));const paid=Prisma.Decimal.min(c.paid,effective);if(debtStage({acceptedAt:c.acceptedAt,amount:effective.toString(),paid:paid.toString(),today:today(),...p}).stage==='restricted')throw new ForbiddenException('Gecikmiş komissiya borcuna görə yalnız yeni əməliyyatlar məhdudlaşdırılıb. Mövcud sifarişlər açıq qalır.');}
 }
 private async mutation<T>(ctx:TenantCtx,keyValue:unknown,command:string,payload:unknown,caseId:string,work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
  const orgId=this.org(ctx),key=String(keyValue||'');if(!/^[\w-]{16,100}$/.test(key))throw new BadRequestException('Əməliyyat açarı düzgün deyil');
  const requestHash=createHash('sha256').update(JSON.stringify({command,payload})).digest('hex');
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`market:${caseId}`}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId:orgId,key}}});
   if(replay){if(replay.requestHash!==requestHash||replay.accountId!==ctx.accountId)throw new ConflictException('Əməliyyat açarı başqa sorğuya aiddir');return replay.changedBooks as T;}
   if(['create-rfq','bid','select-bid'].includes(command))await this.newAllowed(ctx,tx);
   const result=await work(tx);
   await tx.operationReceipt.create({data:{organizationId:orgId,accountId:ctx.accountId,key,requestHash,command,changedBooks:asJson(result)}});
   return result;
  },120000);
 }
 private async event(tx:Prisma.TransactionClient,ctx:TenantCtx,caseId:string,kind:string,data:unknown){
  const event=await tx.marketEvent.create({data:{caseId,organizationId:this.org(ctx),accountId:ctx.accountId,kind,data:asJson(data)}});
  const labels:Record<string,string>={'rfq-created':'Yeni qiymət sorğusu','bid-created':'Yeni kommersiya təklifi','order-created':'Yeni sifariş','supplier-confirmed':'Təchizatçı sifarişi təsdiqlədi',delivered:'Çatdırılma qeydə alındı',received:'Qəbul və komissiya hesablaşması qeydə alındı','non-binding-recommendation':'Mübahisə üçün moderator tövsiyəsi','dispute-resolved':'Mübahisə üzrə qərar qeydə alındı','return-requested':'Qaytarma tələb edildi','return-confirmed':'Qaytarma təsdiqləndi'};
  if(!labels[kind])return;
  const row=await tx.marketCase.findUnique({where:{id:caseId}});if(!row)return;
  let recipients=[row.buyerId,...(row.supplierId?[row.supplierId]:[])];
  if(kind==='rfq-created'){
   if(row.visibility==='private')recipients.push(...row.invited as string[]);
   else {const items=bodyData(row).lines.map(line=>line.itemId);const listings=await tx.marketListing.findMany({where:{itemId:{in:items},region:row.region},select:{organizationId:true}});recipients.push(...listings.map(listing=>listing.organizationId));}
  }
  for(const organizationId of new Set(recipients))if(organizationId!==ctx.orgId)await this.notify(tx,organizationId,event.id,labels[kind],caseId);
 }
 private async notify(tx:Prisma.TransactionClient,organizationId:string,reference:string,label:string,caseId:string){
  const text=`Bazar: ${label}`;
  await tx.notice.create({data:{organizationId,kind:'teklif',text}});
  for(const channel of ['app','email','sms'])await tx.messageOutbox.create({data:{organizationId,channel,kind:'market-event',reference,status:channel==='app'?'available':'awaiting_provider',payload:asJson({text,caseId,href:'/market'})}});
 }
 private async caseFor(ctx:TenantCtx,id:string,tx:Prisma.TransactionClient|PrismaService=this.prisma){
  const row=await tx.marketCase.findUnique({where:{id}});if(!row)throw new NotFoundException('Bazar sənədi tapılmadı');const orgId=this.org(ctx);
  if(row.buyerId===orgId||row.supplierId===orgId)return row;
  if(row.kind!=='rfq'||row.status==='draft')throw new NotFoundException('Bazar sənədi tapılmadı');
  if(row.visibility==='private'&&!(row.invited as string[]).includes(orgId))throw new NotFoundException('Bazar sənədi tapılmadı');
  const company=await tx.marketCompany.findUnique({where:{organizationId:orgId}});if(company?.status!=='approved')throw new NotFoundException('Bazar sənədi tapılmadı');
  const listing=await tx.marketListing.findFirst({where:{organizationId:orgId,...(row.region?{region:row.region}: {})}});if(row.visibility==='open'&&!listing)throw new NotFoundException('Bölgə üzrə uyğun RFQ tapılmadı');
  if(row.visibility==='open'){
    const ids=(bodyData(row).lines||[]).map(line=>line.itemId);const offered=await tx.marketListing.count({where:{organizationId:orgId,itemId:{in:ids}}});if(!offered)throw new NotFoundException('Kateqoriya üzrə uyğun RFQ tapılmadı');
  }
  return row;
 }
 async catalog(query:string,category:string,region:string){
  const rows=await this.prisma.marketItem.findMany({where:{status:'approved',...(query?{name:{contains:query,mode:'insensitive' as const}}:{}),...(category?{category}: {})},orderBy:{name:'asc'},take:200,select:{id:true,name:true,category:true,brand:true,model:true,manufacturer:true,origin:true,unit:true,attributes:true,updatedAt:true}});
  const listings=await this.prisma.marketListing.findMany({where:{itemId:{in:rows.map(row=>row.id)},...(region?{region}: {})}});
  const companies=await this.prisma.marketCompany.findMany({where:{organizationId:{in:listings.map(l=>l.organizationId)},status:'approved'},select:{organizationId:true,name:true,region:true}});
  return rows.map(row=>({...row,suppliers:listings.filter(l=>l.itemId===row.id&&companies.some(c=>c.organizationId===l.organizationId)).map(l=>({id:l.organizationId,name:companies.find(c=>c.organizationId===l.organizationId)!.name,region:l.region,availability:l.availability,quantity:l.quantity,leadDays:l.leadDays,updatedAt:l.updatedAt}))}));
 }
 async myCompany(ctx:TenantCtx){const orgId=this.org(ctx);return this.prisma.marketCompany.findUnique({where:{organizationId:orgId}});}
 async workspace(ctx:TenantCtx){
  const organizationId=this.org(ctx);
  const [company,projects,locations,members,companies,items,grants]=await Promise.all([
   this.myCompany(ctx),this.prisma.project.findMany({where:{organizationId},select:{id:true,name:true}}),this.prisma.location.findMany({where:{organizationId},select:{id:true,name:true}}),
   ctx.seat==='direktor'?this.prisma.organizationMember.findMany({where:{organizationId,accountId:{not:null}},select:{accountId:true,seatRole:true,account:{select:{name:true}}}}):[],
   this.prisma.marketCompany.findMany({where:{status:'approved'},select:{organizationId:true,name:true,region:true}}),
   this.prisma.marketItem.findMany({where:{ownerId:organizationId},select:{id:true,name:true,status:true,reason:true}}),
   ctx.seat==='direktor'?this.prisma.marketAcceptanceGrant.findMany({where:{organizationId}}):[],
  ]);
  return {organizationId,accountId:ctx.accountId,seat:ctx.seat,admin:ctx.kind==='admin'&&ctx.seat==='direktor',company,projects,locations,members:members.map(m=>({accountId:m.accountId,seat:m.seatRole,account:m.account})),companies,items,grants};
 }
 async registerCompany(ctx:TenantCtx,body:Row){
  this.tenant.allow(ctx,'org');const orgId=this.org(ctx);const voen=input(body.voen,'VÖEN',10);if(!/^\d{10}$/.test(voen))throw new BadRequestException('VÖEN 10 rəqəm olmalıdır');
  const documents=strings(body.documents);if(!documents.length)throw new BadRequestException('Hüquqi sənəd tələb olunur');
  await this.files.requireOwn(ctx,documents,'commercial');
  return this.prisma.marketCompany.upsert({where:{organizationId:orgId},update:{name:input(body.name,'Hüquqi ad',300),voen,region:input(body.region,'Region',100),documents,status:'pending',reviewedBy:null,reviewedAt:null,reason:''},create:{organizationId:orgId,name:input(body.name,'Hüquqi ad',300),voen,region:input(body.region,'Region',100),documents}});
 }
 async moderation(ctx:TenantCtx){this.admin(ctx);return {companies:await this.prisma.marketCompany.findMany({where:{status:{in:['pending','changes']}}}),items:await this.prisma.marketItem.findMany({where:{status:'pending'}}),payments:await this.prisma.marketPayment.findMany({where:{status:'pending'}})};}
 async moderate(ctx:TenantCtx,kind:string,id:string,body:Row){
  this.admin(ctx);const status=input(body.status,'Status',20);if(!['approved','changes','suspended','rejected'].includes(status))throw new BadRequestException('Status düzgün deyil');
  const reason=String(body.reason||'').trim();if(status!=='approved'&&!reason)throw new BadRequestException('Səbəb tələb olunur');
  return serializable(this.prisma,async tx=>{
   const candidate=kind==='company'?await tx.marketCompany.findUnique({where:{organizationId:id}}):kind==='item'?await tx.marketItem.findUnique({where:{id}}):null;
   if(!candidate)throw new NotFoundException('Moderasiya qeydi tapılmadı');
   if(status==='approved'){
    const documents=candidate.documents as string[];
    const organizationId='organizationId' in candidate?candidate.organizationId:candidate.ownerId;
    const count=await tx.blobFile.count({where:{id:{in:documents},organizationId,scanStatus:'clean'}});
    if(count!==new Set(documents).size)throw new BadRequestException('Bütün sənədlər antivirus yoxlamasından keçməlidir');
   }
   const row=kind==='company'?await tx.marketCompany.update({where:{organizationId:id},data:{status,reason,reviewedBy:ctx.accountId,reviewedAt:new Date()}}):kind==='item'?await tx.marketItem.update({where:{id},data:{status,reason,reviewedBy:ctx.accountId}}):null;
   if(!row)throw new BadRequestException('Moderasiya növü düzgün deyil');await this.event(tx,ctx,`${kind}:${id}`,'moderation',{status,reason});return row;
  });
 }
 async proposeItem(ctx:TenantCtx,body:Row){
  await this.newAllowed(ctx);const name=input(body.name,'Məhsul',500),unit=input(body.unit,'Vahid',50),brand=String(body.brand||'').trim(),model=String(body.model||'').trim();
  const duplicates=await this.prisma.marketItem.findMany({where:{status:'approved',unit,brand,model,name:{equals:name,mode:'insensitive'}},select:{id:true,name:true,brand:true,model:true,unit:true}});
  if(duplicates.length)return {created:false,matches:duplicates};
  const documents=strings(body.documents);await this.files.requireOwn(ctx,documents,'certificate');
  const row=await this.prisma.marketItem.create({data:{ownerId:this.org(ctx),name,unit,brand,model,category:input(body.category,'Kateqoriya',100),manufacturer:String(body.manufacturer||'').trim(),origin:String(body.origin||'').trim(),attributes:asJson(body.attributes||{}),documents}});
  return {created:true,item:row,matches:[]};
 }
 async listing(ctx:TenantCtx,itemId:string,body:Row){
  this.trade(ctx);await this.verified(ctx);const item=await this.prisma.marketItem.findFirst({where:{id:itemId,status:'approved'}});if(!item)throw new NotFoundException('Məhsul tapılmadı');
  const availability=input(body.availability,'Mövcudluq',100),region=input(body.region,'Region',100);const quantity=body.quantity==null||body.quantity===''?null:decimal(body.quantity,'Təxmini miqdar');const leadDays=body.leadDays==null||body.leadDays===''?null:Number(body.leadDays);if(leadDays!=null&&(!Number.isInteger(leadDays)||leadDays<0))throw new BadRequestException('Təminat müddəti düzgün deyil');
  return this.prisma.marketListing.upsert({where:{organizationId_itemId:{organizationId:this.org(ctx),itemId}},update:{availability,region,quantity,leadDays},create:{organizationId:this.org(ctx),itemId,availability,region,quantity,leadDays}});
 }
 private async rfqLines(value:unknown):Promise<Line[]>{
  const rows=records(value,'RFQ sətirləri');if(!rows.length)throw new BadRequestException('Ən azı bir məhsul seçin');const seen=new Set<string>();const result:Line[]=[];
  for(const row of rows){const itemId=input(row.itemId,'Məhsul ID-si',150);if(seen.has(itemId))throw new BadRequestException('Məhsul RFQ-də təkrarlanır');seen.add(itemId);const item=await this.prisma.marketItem.findFirst({where:{id:itemId,status:'approved'}});if(!item)throw new BadRequestException('Təsdiqlənməmiş məhsul var');const qty=decimal(row.qty,'Miqdar',false);if(qty.decimalPlaces()>3)throw new BadRequestException('Miqdar dəqiqliyi ən çox 3-dür');result.push({id:randomUUID(),itemId,name:item.name,unit:item.unit,qty:qty.toFixed(3),spec:String(row.spec||'').slice(0,4000)});}
  return result;
 }
 async createRfq(ctx:TenantCtx,body:Row){
  await this.newAllowed(ctx);const lines=await this.rfqLines(body.lines);const visibility=body.visibility==='private'?'private':'open';const invited=strings(body.invited);if(visibility==='private'&&!invited.length)throw new BadRequestException('Təchizatçıları seçin');if(invited.includes(this.org(ctx)))throw new BadRequestException('Öz şirkətinizə RFQ göndərilə bilməz');
  const count=await this.prisma.marketCompany.count({where:{organizationId:{in:invited},status:'approved'}});if(count!==invited.length)throw new BadRequestException('Dəvət edilən şirkət təsdiqlənməyib');
  const data:CaseData={title:input(body.title,'Sorğu adı',300),lines,address:input(body.address,'Çatdırılma ünvanı',1000),requiredDate:date(body.requiredDate),files:strings(body.files)};
  await this.files.requireOwn(ctx,data.files,'commercial');
  return this.mutation(ctx,body.key,'create-rfq',{...body,key:undefined},this.org(ctx),async tx=>{const row=await tx.marketCase.create({data:{kind:'rfq',buyerId:this.org(ctx),status:'sent',category:input(body.category,'Kateqoriya',100),region:input(body.region,'Region',100),visibility,invited,data:asJson(data)}});await this.event(tx,ctx,row.id,'rfq-created',{title:data.title});return row;});
 }
 async cases(ctx:TenantCtx,kind:string){
  await this.verified(ctx);const orgId=this.org(ctx);if(!['rfq','order'].includes(kind))throw new BadRequestException('Sənəd növü düzgün deyil');
  const rows=await this.prisma.marketCase.findMany({where:kind==='order'?{kind,OR:[{buyerId:orgId},{supplierId:orgId}]}:{kind,OR:[{buyerId:orgId},{visibility:'open',status:{not:'draft'}},{invited:{array_contains:[orgId]}}]},orderBy:{updatedAt:'desc'},take:200});
  const allowed=[];for(const row of rows){try{await this.caseFor(ctx,row.id);allowed.push(this.caseView(ctx,row));}catch(error){if(!(error instanceof NotFoundException))throw error;}}
  return allowed;
 }
 private caseView(ctx:TenantCtx,row:MarketCase){
  if(['direktor','satinalma','muhasib'].includes(ctx.seat||''))return row;
  const data=bodyData(row);return {...row,data:{...data,lines:data.lines.map(({unitNet,vatRate,...rest})=>rest),receipts:data.receipts?.map(r=>({...r,lines:r.lines.map(({net,gross,...rest})=>rest)})),deliveryCost:undefined,payment:undefined}};
 }
 async detail(ctx:TenantCtx,id:string){
  const row=await this.caseFor(ctx,id);const bids=row.kind==='rfq'?await this.prisma.marketBid.findMany({where:{rfqId:id,...(row.buyerId!==this.org(ctx)?{supplierId:this.org(ctx)}:{})},orderBy:{createdAt:'desc'}}):[];
  if(!['direktor','satinalma','muhasib'].includes(ctx.seat||'')&&row.kind==='rfq')throw new ForbiddenException('Təklif qiymətlərinə girişiniz yoxdur');
  const messages=await this.prisma.marketMessage.findMany({where:{caseId:id,...(row.kind==='rfq'&&row.buyerId!==this.org(ctx)?{OR:[{organizationId:this.org(ctx)},{recipientId:this.org(ctx)}]}:{})},orderBy:{createdAt:'asc'},take:200});
  return {case:this.caseView(ctx,row),bids,messages:['direktor','satinalma','muhasib'].includes(ctx.seat||'')?messages:[]};
 }
 async bid(ctx:TenantCtx,id:string,body:Row){
  await this.newAllowed(ctx);const rfq=await this.caseFor(ctx,id);if(rfq.kind!=='rfq'||rfq.buyerId===this.org(ctx)||!['sent','bids'].includes(rfq.status))throw new BadRequestException('RFQ təklif qəbul etmir');const source=bodyData(rfq);const rows=records(body.lines,'Təklif sətirləri');if(!rows.length)throw new BadRequestException('Təklif sətri tələb olunur');
  const seen=new Set<string>();const lines=rows.map(row=>{const sourceLine=source.lines.find(l=>l.id===row.lineId);if(!sourceLine||seen.has(sourceLine.id))throw new BadRequestException('Uyğunsuz və ya təkrar təklif sətri');seen.add(sourceLine.id);const qty=decimal(row.qty,'Təklif miqdarı',false),unitNet=decimal(row.unitNet,'Qiymət'),vatRate=decimal(row.vatRate,'ƏDV');if(qty.greaterThan(sourceLine.qty)||qty.decimalPlaces()>3||unitNet.decimalPlaces()>6||vatRate.greaterThan(100))throw new BadRequestException('Miqdar və ya ƏDV düzgün deyil');return {...sourceLine,qty:qty.toFixed(3),unitNet:unitNet.toFixed(6),vatRate:vatRate.toString()};});
  const leadDays=Number(body.leadDays||0);if(!Number.isInteger(leadDays)||leadDays<0||leadDays>3650)throw new BadRequestException('Təminat müddəti düzgün deyil');
  const validUntil=date(body.validUntil);if(validUntil<today())throw new BadRequestException('Təklifin etibarlılıq tarixi keçib');
  await this.files.requireOwn(ctx,strings(body.files),'commercial');
  return this.mutation(ctx,body.key,'bid',body,id,async tx=>{const current=await tx.marketCase.findUniqueOrThrow({where:{id}});if(!['sent','bids'].includes(current.status))throw new ConflictException('RFQ artıq təklif qəbul etmir');const latest=await tx.marketBid.findFirst({where:{rfqId:id,supplierId:this.org(ctx)},orderBy:{revision:'desc'}});const bid=await tx.marketBid.create({data:{rfqId:id,supplierId:this.org(ctx),revision:(latest?.revision||0)+1,data:asJson({lines,deliveryCost:decimal(body.deliveryCost??0,'Çatdırılma').toFixed(2),payment:input(body.payment,'Ödəniş şərti'),validUntil,leadDays,files:strings(body.files)})}});await tx.marketCase.update({where:{id},data:{status:'bids'}});await this.event(tx,ctx,id,'bid-created',{bidId:bid.id,revision:bid.revision});return bid;});
 }
 async selectBid(ctx:TenantCtx,id:string,bidId:string,body:Row){
  await this.newAllowed(ctx);const rfq=await this.caseFor(ctx,id);if(rfq.buyerId!==this.org(ctx)||rfq.kind!=='rfq')throw new NotFoundException('RFQ tapılmadı');
  return this.mutation(ctx,body.key,'select-bid',{id,bidId,contractId:String(body.contractId||'')},id,async tx=>{const current=await tx.marketCase.findUniqueOrThrow({where:{id}});if(!['sent','bids'].includes(current.status))throw new ConflictException('RFQ artıq seçilib');const bid=await tx.marketBid.findFirst({where:{id:bidId,rfqId:id}});if(!bid)throw new NotFoundException('Təklif tapılmadı');const latest=await tx.marketBid.findFirst({where:{rfqId:id,supplierId:bid.supplierId},orderBy:{revision:'desc'}});if(latest?.id!==bid.id)throw new BadRequestException('Təklifin yeni versiyası var');const data=bid.data as unknown as CaseData;if(!data.validUntil||data.validUntil<today())throw new BadRequestException('Təklif köhnəlib');const source=bodyData(current);
   const contractId=String(body.contractId||'');if(contractId&&!await tx.contract.findFirst({where:{id:contractId,organizationId:current.buyerId}}))throw new BadRequestException('Müqavilə bu şirkətə aid deyil');
   const siblingBids=await tx.marketBid.findMany({where:{rfqId:id},select:{id:true}});const previousOrders=await tx.marketCase.findMany({where:{kind:'order',selectedBidId:{in:siblingBids.map(b=>b.id)}}});
   const allocated=previousOrders.flatMap(o=>bodyData(o).lines);for(const line of data.lines){const requested=source.lines.find(l=>l.id===line.id);const previous=allocated.filter(l=>l.id===line.id).reduce((s,l)=>s.plus(l.qty),new Prisma.Decimal(0));if(!requested||previous.plus(line.qty).greaterThan(requested.qty))throw new BadRequestException('Seçilən təklif RFQ-nin bölüşdürülməmiş qalığını aşır');}
   const order=await tx.marketCase.create({data:{kind:'order',buyerId:current.buyerId,supplierId:bid.supplierId,selectedBidId:bid.id,status:'created',category:current.category,region:current.region,visibility:'private',invited:[],data:asJson({...source,...data,files:[...new Set([...source.files,...data.files])],title:source.title,lines:data.lines,deliveries:[],receipts:[],contractId,sourceRfqId:id})}});
   const complete=source.lines.every(line=>[...allocated,...data.lines].filter(l=>l.id===line.id).reduce((s,l)=>s.plus(l.qty),new Prisma.Decimal(0)).equals(line.qty));
   await tx.marketCase.update({where:{id},data:{status:complete?'selected':'bids'}});await this.event(tx,ctx,order.id,'order-created',{rfqId:id,bidId});return order;
  });
 }
 async confirmOrder(ctx:TenantCtx,id:string,body:Row){
  await this.verified(ctx);this.trade(ctx);return this.mutation(ctx,body.key,'confirm-order',{id},id,async tx=>{const row=await this.caseFor(ctx,id,tx);if(row.kind!=='order'||row.supplierId!==this.org(ctx))throw new ForbiddenException('Sifarişi yalnız təchizatçı təsdiqləyir');if(row.status!=='created')throw new ConflictException('Sifariş artıq işlənib');const result=await tx.marketCase.update({where:{id},data:{status:'confirmed'}});await this.event(tx,ctx,id,'supplier-confirmed',{});return result;});
 }
 async message(ctx:TenantCtx,id:string,body:Row){
  const row=await this.caseFor(ctx,id);await this.verified(ctx);this.trade(ctx);const text=input(body.text,'Mesaj');
  await this.files.requireOwn(ctx,strings(body.attachments),'commercial');
  const recipientId=row.kind==='rfq'&&row.buyerId===this.org(ctx)?input(body.recipientId,'Mesajın təchizatçısı',150):row.buyerId===this.org(ctx)?row.supplierId!:row.buyerId;
  if(row.kind==='rfq'&&row.buyerId===this.org(ctx))await this.caseFor({...ctx,orgId:recipientId},id);
  return serializable(this.prisma,async tx=>{const message=await tx.marketMessage.create({data:{caseId:row.id,organizationId:this.org(ctx),accountId:ctx.accountId,recipientId,text,attachments:strings(body.attachments)}});await this.notify(tx,recipientId,`message:${message.id}`,'Yeni mesaj',row.id);return message;});
 }

 async deliver(ctx:TenantCtx,id:string,body:Row){
  this.trade(ctx);return this.mutation(ctx,body.key,'delivery',body,id,async tx=>{
   const order=await this.caseFor(ctx,id,tx);if(order.kind!=='order'||order.supplierId!==this.org(ctx)||!['confirmed','delivered','part_received'].includes(order.status))throw new BadRequestException('Sifariş çatdırılmaya hazır deyil');
   const data=bodyData(order),seen=new Set<string>();const lines=(records(body.lines,'Çatdırılma')).map(row=>{
    const source=data.lines.find(l=>l.id===row.lineId);if(!source||seen.has(source.id))throw new BadRequestException('Sətir düzgün deyil');seen.add(source.id);
    const qty=decimal(row.qty,'Çatdırılma miqdarı',false);const previous=(data.deliveries||[]).flatMap(d=>d.lines).filter(l=>l.lineId===source.id).reduce((sum,l)=>sum.plus(l.qty),new Prisma.Decimal(0));
    const rejected=(data.disputes||[]).filter(d=>d.lineId===source.id&&d.status==='resolved').reduce((sum,d)=>sum.plus(d.rejectedQty||0),new Prisma.Decimal(0)).plus((data.returns||[]).filter(r=>r.lineId===source.id&&r.status==='confirmed').reduce((sum,r)=>sum.plus(r.qty),new Prisma.Decimal(0)));
    if(previous.plus(qty).greaterThan(decimal(source.qty,'Sifariş').plus(rejected))||qty.decimalPlaces()>3)throw new BadRequestException('Çatdırılma sifariş qalığını aşır');return {lineId:source.id,qty:qty.toFixed(3)};
   });if(!lines.length)throw new BadRequestException('Çatdırılma sətri tələb olunur');
   const delivery:Delivery={id:randomUUID(),lines,proof:input(body.proof,'Çatdırılma sübutu',1000),createdAt:new Date().toISOString()};
   await this.files.requireOwn(ctx,[delivery.proof],'commercial');
   const result=await tx.marketCase.update({where:{id},data:{status:'delivered',data:asJson({...data,files:[...new Set([...data.files,delivery.proof])],deliveries:[...(data.deliveries||[]),delivery]})}});await this.event(tx,ctx,id,'delivered',delivery);return result;
  });
 }
 async grantAcceptance(ctx:TenantCtx,body:Row){
  this.tenant.allow(ctx,'members');const orgId=this.org(ctx),accountId=input(body.accountId,'İstifadəçi',150),projectId=String(body.projectId||''),locationId=String(body.locationId||'');
  const member=await this.prisma.organizationMember.findFirst({where:{organizationId:orgId,accountId}});if(!member)throw new BadRequestException('İstifadəçi şirkət üzvü deyil');
  if(projectId&&!await this.prisma.project.findFirst({where:{id:projectId,organizationId:orgId}}))throw new NotFoundException('Layihə tapılmadı');
  if(locationId&&!await this.prisma.location.findFirst({where:{id:locationId,organizationId:orgId}}))throw new NotFoundException('Anbar tapılmadı');
  const limit=decimal(body.limit,'Qəbul limiti',false);
  return this.prisma.marketAcceptanceGrant.upsert({where:{organizationId_accountId_projectId_locationId:{organizationId:orgId,accountId,projectId,locationId}},update:{limit,active:body.active!==false},create:{organizationId:orgId,accountId,projectId,locationId,limit}});
 }
 private async acceptancePermission(tx:Prisma.TransactionClient,ctx:TenantCtx,projectId:string,locationId:string,total:Prisma.Decimal){
  if(ctx.seat==='direktor')return;
  const grant=await tx.marketAcceptanceGrant.findUnique({where:{organizationId_accountId_projectId_locationId:{organizationId:this.org(ctx),accountId:ctx.accountId,projectId,locationId}}});
  if(!grant?.active||total.greaterThan(grant.limit))throw new ForbiddenException('Qəbul layihə/anbar səlahiyyətini və ya məbləğ limitini aşır');
 }
 async receive(ctx:TenantCtx,id:string,body:Row){
  this.org(ctx);return this.mutation(ctx,body.key,'receipt',body,id,async tx=>{
   const order=await this.caseFor(ctx,id,tx);if(order.kind!=='order'||order.buyerId!==this.org(ctx)||!['delivered','part_received'].includes(order.status))throw new BadRequestException('Sifariş qəbul üçün hazır deyil');
   const data=bodyData(order),projectId=data.projectId||String(body.projectId||''),locationId=data.locationId||String(body.locationId||'');
   if(data.projectId&&body.projectId&&data.projectId!==body.projectId||data.locationId&&body.locationId&&data.locationId!==body.locationId)throw new BadRequestException('Sifarişin ERP əlaqəsi dəyişdirilə bilməz');
   if(projectId&&!await tx.project.findFirst({where:{id:projectId,organizationId:order.buyerId}}))throw new NotFoundException('Layihə tapılmadı');
   if(locationId&&!await tx.location.findFirst({where:{id:locationId,organizationId:order.buyerId}}))throw new NotFoundException('Anbar tapılmadı');
   const receipts=data.receipts||[],seen=new Set<string>();let total=new Prisma.Decimal(0);
   const lines=(records(body.lines,'Qəbul')).map(row=>{
    const source=data.lines.find(l=>l.id===row.lineId);if(!source||seen.has(source.id))throw new BadRequestException('Qəbul sətri düzgün deyil');seen.add(source.id);
    const previous=receipts.flatMap(r=>r.lines).filter(l=>l.lineId===source.id);
    const delivered=(data.deliveries||[]).flatMap(d=>d.lines).filter(l=>l.lineId===source.id).reduce((sum,l)=>sum.plus(l.qty),new Prisma.Decimal(0));
    const resolved=(data.disputes||[]).filter(d=>d.lineId===source.id&&d.status==='resolved'),returned=(data.returns||[]).filter(r=>r.lineId===source.id&&r.status==='confirmed').reduce((sum,r)=>sum.plus(r.qty),new Prisma.Decimal(0));
    const rejected=resolved.reduce((sum,d)=>sum.plus(d.rejectedQty||0),new Prisma.Decimal(0));
    const result=settlementLine({ordered:source.qty,delivered:delivered.minus(rejected).minus(returned),previousAccepted:previous.reduce((sum,l)=>sum.plus(l.accepted),new Prisma.Decimal(0)).minus(returned),previousDisputed:previous.reduce((sum,l)=>sum.plus(l.disputed),new Prisma.Decimal(0)).minus(resolved.reduce((sum,d)=>sum.plus(d.qty),new Prisma.Decimal(0))),accepted:row.accepted||0,disputed:row.disputed||0,unitNet:source.unitNet,vatRate:source.vatRate});
    total=total.plus(result.gross);return {lineId:source.id,...result};
   });if(!lines.length||lines.every(l=>decimal(l.accepted,'Qəbul').plus(l.disputed).isZero()))throw new BadRequestException('Qəbul və ya mübahisə miqdarı tələb olunur');
   await this.acceptancePermission(tx,ctx,projectId,locationId,total);
   const policy=await this.policy(tx);const proof=String(body.proof||'').trim();if((policy.requiredProofCategories as string[]).includes(order.category)&&!proof)throw new BadRequestException('Bu kateqoriya üçün imzalı qəbul sənədi tələb olunur');
   if(proof)await this.files.requireOwn(ctx,[proof],'commercial');
   const receipt:Receipt={id:randomUUID(),acceptedAt:today(),lines,proof,projectId,locationId,awaitingTariff:false};
   receipt.awaitingTariff=!(await this.billReceipt(tx,order,receipt));
   const next=[...receipts,receipt];const complete=data.lines.every(line=>next.flatMap(r=>r.lines).filter(l=>l.lineId===line.id).reduce((sum,l)=>sum.plus(l.accepted),new Prisma.Decimal(0)).minus((data.returns||[]).filter(r=>r.lineId===line.id&&r.status==='confirmed').reduce((sum,r)=>sum.plus(r.qty),new Prisma.Decimal(0))).equals(line.qty));
   const disputes=[...(data.disputes||[]),...lines.filter(l=>decimal(l.disputed,'Mübahisə').greaterThan(0)).map(line=>({id:randomUUID(),receiptId:receipt.id,lineId:line.lineId,qty:line.disputed,status:'open' as const}))];
   await tx.marketCase.update({where:{id},data:{status:complete?'closed':'part_received',data:asJson({...data,files:[...new Set([...data.files,...(proof?[proof]:[])])],receipts:next,disputes})}});await this.event(tx,ctx,id,'received',receipt);
   await this.erpReceipt(tx,ctx,order,receipt);
   return receipt;
  });
 }
 private async billReceipt(tx:Prisma.TransactionClient,order:MarketCase,receipt:Receipt){
  const net=receipt.lines.reduce((sum,l)=>sum.plus(l.net),new Prisma.Decimal(0)),gross=receipt.lines.reduce((sum,l)=>sum.plus(l.gross),new Prisma.Decimal(0));if(net.isZero())return true;
  const rules=await tx.marketTariff.findMany({where:{active:true}}),policy=await this.policy(tx);let complete=true;
  for(const side of ['buyer','supplier'] as const){
   const companyId=side==='buyer'?order.buyerId:order.supplierId!;
   const tariff=chooseTariff(rules.map(rule=>({...rule,side:rule.side as Tariff['side'],scope:rule.scope as Tariff['scope'],basis:rule.basis as Tariff['basis'],rate:rule.rate.toString()})),{side,companyId,category:order.category,contractId:bodyData(order).contractId||'',acceptedAt:receipt.acceptedAt});
   if(!tariff){complete=false;continue;}const base=tariff.basis==='net'?net:gross,amount=commission(base,tariff.rate);
   await tx.marketCharge.upsert({where:{receiptId_side:{receiptId:receipt.id,side}},update:{},create:{orderId:order.id,receiptId:receipt.id,organizationId:companyId,side,acceptedAt:receipt.acceptedAt,dueAt:plusDays(receipt.acceptedAt,policy.dueDays),base,rate:tariff.rate,amount,tariff:asJson(tariff)}});
  }return complete;
 }
 async reconcileTariffs(ctx:TenantCtx,id:string,body:Row){
  this.admin(ctx);return this.mutation(ctx,body.key,'reconcile-tariffs',{id},id,async tx=>{const order=await tx.marketCase.findFirst({where:{id,kind:'order'}});if(!order)throw new NotFoundException('Sifariş tapılmadı');const data=bodyData(order),receipts=data.receipts||[];for(const receipt of receipts)if(receipt.awaitingTariff)receipt.awaitingTariff=!(await this.billReceipt(tx,order,receipt));await tx.marketCase.update({where:{id},data:{data:asJson({...data,receipts})}});await this.event(tx,ctx,id,'tariffs-reconciled',{pending:receipts.filter(r=>r.awaitingTariff).length});return {pending:receipts.filter(r=>r.awaitingTariff).length};});
 }
 async saveTariff(ctx:TenantCtx,body:Row){
  this.admin(ctx);const side=input(body.side,'Tərəf',20),scope=input(body.scope,'Tarif səviyyəsi',20),basis=input(body.basis,'Komissiya bazası',20);if(!['buyer','supplier'].includes(side)||!['contract','company','category','default'].includes(scope)||!['net','gross'].includes(basis))throw new BadRequestException('Tarif parametri düzgün deyil');
  const target=scope==='default'?'*':input(body.target,'Tarif obyekti',200),rate=decimal(body.rate,'Faiz'),effectiveFrom=date(body.effectiveFrom),effectiveTo=body.effectiveTo?date(body.effectiveTo):null;if(rate.greaterThan(100)||effectiveTo&&effectiveTo<effectiveFrom)throw new BadRequestException('Faiz və ya tarix düzgün deyil');
  return serializable(this.prisma,async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('market-tariffs'))`;const overlap=await tx.marketTariff.findFirst({where:{side,scope,target,active:true,effectiveFrom:{lte:effectiveTo||'9999-12-31'},OR:[{effectiveTo:null},{effectiveTo:{gte:effectiveFrom}}]}});if(overlap)throw new BadRequestException('Tarifin tarixləri mövcud tariflə üst-üstə düşür');const row=await tx.marketTariff.create({data:{side,scope,target,basis,rate,effectiveFrom,effectiveTo}});await this.event(tx,ctx,'tariffs','tariff-created',row);return row;});
 }
 async finance(ctx:TenantCtx,month:string){
  this.org(ctx);if(!['direktor','muhasib'].includes(ctx.seat||''))throw new ForbiddenException('Maliyyə səlahiyyətiniz yoxdur');
  const charges=await this.prisma.marketCharge.findMany({where:{organizationId:this.org(ctx)},orderBy:{dueAt:'asc'}}),policy=await this.policy();
  const rows=charges.map(c=>{const effective=Prisma.Decimal.max(0,c.amount.minus(c.credit)),paid=Prisma.Decimal.min(c.paid,effective);return {...c,amount:c.amount.toString(),paid:c.paid.toString(),credit:c.credit.toString(),...debtStage({acceptedAt:c.acceptedAt,amount:effective,paid,today:today(),...policy})};});
  return {charges:rows,statement:monthlyStatement(rows.map(row=>({...row,amount:new Prisma.Decimal(row.amount).minus(row.credit).toFixed(2),paid:Prisma.Decimal.min(row.paid,new Prisma.Decimal(row.amount).minus(row.credit)).toFixed(2)})),month||today().slice(0,7)),payments:await this.prisma.marketPayment.findMany({where:{organizationId:this.org(ctx)},orderBy:{createdAt:'desc'}})};
 }
 async submitPayment(ctx:TenantCtx,id:string,body:Row){
  this.org(ctx);if(!['direktor','muhasib'].includes(ctx.seat||''))throw new ForbiddenException('Ödəniş qeydi səlahiyyətiniz yoxdur');
  await this.files.requireOwn(ctx,[input(body.proof,'Bank qəbzi',1000)],'commercial');
  return this.mutation(ctx,body.key,'submit-payment',body,id,async tx=>{const charge=await tx.marketCharge.findFirst({where:{id,organizationId:this.org(ctx)}});if(!charge)throw new NotFoundException('Borc tapılmadı');const amount=decimal(body.amount,'Ödəniş',false);if(amount.greaterThan(charge.amount.minus(charge.credit).minus(charge.paid)))throw new BadRequestException('Ödəniş qalıq borcdan çoxdur');const payment=await tx.marketPayment.create({data:{chargeId:id,organizationId:this.org(ctx),amount,proof:input(body.proof,'Bank qəbzi',1000)}});await this.event(tx,ctx,charge.orderId,'payment-submitted',{paymentId:payment.id});return payment;});
 }
 async reviewPayment(ctx:TenantCtx,id:string,body:Row){
  this.admin(ctx);return this.mutation(ctx,body.key,'review-payment',body,id,async tx=>{const payment=await tx.marketPayment.findUnique({where:{id}});if(!payment)throw new NotFoundException('Ödəniş tapılmadı');if(payment.status!=='pending')throw new ConflictException('Ödəniş artıq yoxlanıb');const accepted=body.accepted===true;if(accepted){const charge=await tx.marketCharge.findUniqueOrThrow({where:{id:payment.chargeId}});if(payment.amount.greaterThan(charge.amount.minus(charge.credit).minus(charge.paid)))throw new BadRequestException('Ödəniş qalıq borcu aşır');await tx.marketCharge.update({where:{id:charge.id},data:{paid:{increment:payment.amount}}});}const result=await tx.marketPayment.update({where:{id},data:{status:accepted?'approved':'rejected',reviewedBy:ctx.accountId,reviewedAt:new Date(),note:String(body.note||'').slice(0,4000)}});await this.event(tx,ctx,payment.chargeId,'payment-reviewed',{paymentId:id,accepted});return result;});
 }
 async settings(ctx:TenantCtx){this.admin(ctx);return {policy:await this.policy(),tariffs:await this.prisma.marketTariff.findMany({orderBy:{createdAt:'desc'}})};}
 async savePolicy(ctx:TenantCtx,body:Row){
  this.admin(ctx);const dueDays=Number(body.dueDays),warnDays=Number(body.warnDays),restrictDays=Number(body.restrictDays);debtStage({dueDays,warnDays,restrictDays,acceptedAt:today(),today:today(),amount:1,paid:0});const requiredProofCategories=strings(body.requiredProofCategories);
  return this.prisma.marketPolicy.upsert({where:{id:'default'},update:{dueDays,warnDays,restrictDays,requiredProofCategories},create:{id:'default',dueDays,warnDays,restrictDays,requiredProofCategories}});
 }
 private async erpReceipt(tx:Prisma.TransactionClient,ctx:TenantCtx,order:MarketCase,receipt:Receipt){
  const data=bodyData(order);if(!data.erpLinked||!data.locationId||!data.projectId)return;
  const project=await tx.project.findFirst({where:{id:data.projectId,organizationId:order.buyerId}}),location=await tx.location.findFirst({where:{id:data.locationId,organizationId:order.buyerId}});if(!project||!location)throw new BadRequestException('ERP əlaqəsi tapılmadı');
  let amount=new Prisma.Decimal(0);
  for(const accepted of receipt.lines){const qty=decimal(accepted.accepted,'Qəbul');if(qty.isZero())continue;const line=data.lines.find(l=>l.id===accepted.lineId)!;let material=await tx.material.findFirst({where:{name:line.name,unit:line.unit,organizationId:order.buyerId}});if(!material)material=await tx.material.create({data:{organizationId:order.buyerId,name:line.name,unit:line.unit,qty:0,min:0,location:location.name,price:line.unitNet!}});await tx.stock.upsert({where:{materialId_locationId:{materialId:material.id,locationId:location.id}},update:{qty:{increment:qty}},create:{organizationId:order.buyerId,materialId:material.id,locationId:location.id,qty}});await tx.material.update({where:{id:material.id},data:{qty:{increment:qty}}});await tx.movement.create({data:{organizationId:order.buyerId,materialId:material.id,material:material.name,locationId:location.id,type:'medaxil',qty,unit:line.unit,project:project.name,date:receipt.acceptedAt,by:ctx.name,from:`MARKET:${order.id}:${receipt.id}`}});await tx.stockLot.create({data:{organizationId:order.buyerId,materialId:material.id,locationId:location.id,code:material.id,batch:`MARKET:${order.id}`,qty,unitCost:line.unitNet!,qr:`MARKET:${receipt.id}:${line.id}`}});
   const poId=`market-${order.id}-${line.id}`,po=await tx.purchaseOrder.findFirst({where:{id:poId,organizationId:order.buyerId}});if(po){const received=(po.receivedQty||new Prisma.Decimal(0)).plus(qty);await tx.purchaseOrder.update({where:{id:po.id},data:{materialId:material.id,receivedQty:received,status:received.greaterThanOrEqualTo(po.qty)?'qebul':'yoldadir'}});}amount=amount.plus(accepted.gross);}
  if(amount.greaterThan(0)){const supplier=await tx.marketCompany.findUnique({where:{organizationId:order.supplierId!}});await tx.payable.create({data:{organizationId:order.buyerId,supplier:supplier?.name||order.supplierId!,poId:`MARKET:${order.id}:${receipt.id}`,amount,status:'acik',date:receipt.acceptedAt}});}
 }
 async linkErp(ctx:TenantCtx,id:string,body:Row){
  this.trade(ctx);return this.mutation(ctx,body.key,'link-erp',body,id,async tx=>{const order=await this.caseFor(ctx,id,tx);if(order.kind!=='order'||order.buyerId!==this.org(ctx))throw new NotFoundException('Sifariş tapılmadı');const data=bodyData(order);if(data.erpLinked)throw new ConflictException('Sifariş artıq ERP-yə bağlanıb');const projectId=input(body.projectId,'Layihə',150),locationId=input(body.locationId,'Anbar',150);const project=await tx.project.findFirst({where:{id:projectId,organizationId:this.org(ctx)}}),location=await tx.location.findFirst({where:{id:locationId,organizationId:this.org(ctx)}});if(!project||!location)throw new NotFoundException('Layihə və ya anbar tapılmadı');
   const linked={...data,projectId,locationId,erpLinked:true};const result=await tx.marketCase.update({where:{id},data:{data:asJson(linked)}});const supplier=await tx.marketCompany.findUnique({where:{organizationId:order.supplierId!}});
   for(const line of data.lines)await tx.purchaseOrder.create({data:{id:`market-${order.id}-${line.id}`,organizationId:order.buyerId,supplier:supplier?.name||order.supplierId!,item:line.name,unit:line.unit,qty:line.qty,amount:decimal(line.qty,'Miqdar').mul(line.unitNet!).mul(new Prisma.Decimal(1).plus(decimal(line.vatRate,'ƏDV').div(100))).toDecimalPlaces(2),status:'tesdiq',eta:data.requiredDate,receivedQty:0}});
   await this.event(tx,ctx,id,'erp-linked',{projectId,locationId});for(const receipt of data.receipts||[])await this.erpReceipt(tx,ctx,result,receipt);return result;
  });
 }
 async recommendDispute(ctx:TenantCtx,id:string,disputeId:string,body:Row){
  this.admin(ctx);return this.mutation(ctx,body.key,'recommend-dispute',body,id,async tx=>{const order=await tx.marketCase.findFirst({where:{id,kind:'order'}});if(!order)throw new NotFoundException('Sifariş tapılmadı');const data=bodyData(order),dispute=data.disputes?.find(d=>d.id===disputeId);if(!dispute||dispute.status!=='open')throw new BadRequestException('Açıq mübahisə tapılmadı');dispute.recommendation=input(body.note,'Moderator tövsiyəsi');await tx.marketCase.update({where:{id},data:{data:asJson(data)}});await this.event(tx,ctx,id,'non-binding-recommendation',{disputeId,note:dispute.recommendation});return {disputeId,note:dispute.recommendation,binding:false};});
 }
 async resolveDispute(ctx:TenantCtx,id:string,disputeId:string,body:Row){
  return this.mutation(ctx,body.key,'resolve-dispute',body,id,async tx=>{
   const order=await this.caseFor(ctx,id,tx);if(order.buyerId!==this.org(ctx)||order.kind!=='order')throw new ForbiddenException('Mübahisəni alıcının səlahiyyətli əməkdaşı bağlayır');
   const data=bodyData(order),dispute=data.disputes?.find(d=>d.id===disputeId);if(!dispute||dispute.status!=='open')throw new ConflictException('Açıq mübahisə tapılmadı');
   const accepted=decimal(body.acceptedQty,'Qəbul edilən miqdar'),rejected=decimal(body.rejectedQty,'Qaytarılan miqdar');if(!accepted.plus(rejected).equals(dispute.qty)||accepted.decimalPlaces()>3||rejected.decimalPlaces()>3)throw new BadRequestException('Qəbul və qaytarma mübahisəli miqdara bərabər olmalıdır');
   const line=data.lines.find(l=>l.id===dispute.lineId)!,net=accepted.mul(line.unitNet!).toDecimalPlaces(2),gross=net.mul(new Prisma.Decimal(1).plus(decimal(line.vatRate,'ƏDV').div(100))).toDecimalPlaces(2);
   const original=data.receipts!.find(r=>r.id===dispute.receiptId)!;await this.acceptancePermission(tx,ctx,original.projectId,original.locationId,gross);
   const proof=input(body.proof,'Qərarın sənədi',1000),note=input(body.note,'Razılaşdırılmış nəticə');
   await this.files.requireOwn(ctx,[proof],'commercial');data.files=[...new Set([...data.files,proof])];
   const receipt:Receipt={id:randomUUID(),acceptedAt:today(),lines:[{lineId:line.id,accepted:accepted.toFixed(3),disputed:'0.000',net:net.toFixed(2),gross:gross.toFixed(2)}],proof,projectId:original.projectId,locationId:original.locationId,awaitingTariff:false};
   receipt.awaitingTariff=!(await this.billReceipt(tx,order,receipt));
   Object.assign(dispute,{status:'resolved',acceptedQty:accepted.toFixed(3),rejectedQty:rejected.toFixed(3),note});
   data.receipts=[...(data.receipts||[]),receipt];await tx.marketCase.update({where:{id},data:{data:asJson(data),status:'part_received'}});await this.erpReceipt(tx,ctx,order,receipt);await this.event(tx,ctx,id,'dispute-resolved',{dispute,receiptId:receipt.id,proof});return receipt;
  });
 }
 async requestReturn(ctx:TenantCtx,id:string,body:Row){
  return this.mutation(ctx,body.key,'request-return',body,id,async tx=>{
   const order=await this.caseFor(ctx,id,tx);if(order.kind!=='order'||order.buyerId!==this.org(ctx))throw new ForbiddenException('Qaytarmanı yalnız alıcı yaradır');const data=bodyData(order);
   const receipt=data.receipts?.find(r=>r.id===body.receiptId),accepted=receipt?.lines.find(l=>l.lineId===body.lineId);if(!receipt||!accepted)throw new BadRequestException('Qəbul sətri tapılmadı');const qty=decimal(body.qty,'Qaytarma miqdarı',false);
   const reserved=(data.returns||[]).filter(r=>r.receiptId===receipt.id&&r.lineId===body.lineId).reduce((sum,r)=>sum.plus(r.qty),new Prisma.Decimal(0));if(qty.plus(reserved).greaterThan(accepted.accepted)||qty.decimalPlaces()>3)throw new BadRequestException('Qaytarma qəbul edilmiş qalıq miqdarı aşır');
   const line=data.lines.find(l=>l.id===body.lineId)!;const gross=qty.mul(line.unitNet!).mul(new Prisma.Decimal(1).plus(decimal(line.vatRate,'ƏDV').div(100)));await this.acceptancePermission(tx,ctx,receipt.projectId,receipt.locationId,gross);
   const request:ReturnRecord={id:randomUUID(),receiptId:receipt.id,lineId:line.id,qty:qty.toFixed(3),status:'requested',requestedBy:ctx.accountId,note:input(body.note,'Qaytarma səbəbi')};await tx.marketCase.update({where:{id},data:{data:asJson({...data,returns:[...(data.returns||[]),request]})}});await this.event(tx,ctx,id,'return-requested',request);return request;
  });
 }
 async confirmReturn(ctx:TenantCtx,id:string,returnId:string,body:Row){
  this.trade(ctx);return this.mutation(ctx,body.key,'confirm-return',body,id,async tx=>{
   const order=await this.caseFor(ctx,id,tx);if(order.kind!=='order'||order.supplierId!==this.org(ctx))throw new ForbiddenException('Qaytarılan malın qəbulunu təchizatçı təsdiqləyir');
   const data=bodyData(order),record=data.returns?.find(r=>r.id===returnId);if(!record||record.status!=='requested')throw new ConflictException('Gözləyən qaytarma tapılmadı');
   const proof=input(body.proof,'Qaytarılan malın qəbul sənədi',1000),line=data.lines.find(l=>l.id===record.lineId)!,qty=decimal(record.qty,'Qaytarma'),net=qty.mul(line.unitNet!).toDecimalPlaces(2),gross=net.mul(new Prisma.Decimal(1).plus(decimal(line.vatRate,'ƏDV').div(100))).toDecimalPlaces(2);
   await this.files.requireOwn(ctx,[proof],'commercial');data.files=[...new Set([...data.files,proof])];
   const charges=await tx.marketCharge.findMany({where:{receiptId:record.receiptId}}),credits=[];
   for(const charge of charges){const basis=(charge.tariff as unknown as Tariff).basis==='net'?net:gross;const credit=Prisma.Decimal.min(decimal(commission(basis,charge.rate),'Düzəliş'),charge.amount.minus(charge.credit));await tx.marketCharge.update({where:{id:charge.id},data:{credit:{increment:credit}}});credits.push({chargeId:charge.id,amount:credit.toFixed(2),originalRate:charge.rate.toString()});}
   if(data.erpLinked&&data.locationId&&data.projectId){
    const material=await tx.material.findFirst({where:{name:line.name,unit:line.unit,organizationId:order.buyerId}});if(!material)throw new BadRequestException('ERP materialı tapılmadı');const stock=await tx.stock.findUnique({where:{materialId_locationId:{materialId:material.id,locationId:data.locationId}}});const reservations=await tx.stockReservation.findMany({where:{organizationId:order.buyerId,materialId:material.id,locationId:data.locationId,status:'active'}});const transfers=await tx.shipmentLine.findMany({where:{materialId:material.id,shipment:{organizationId:order.buyerId,fromLocationId:data.locationId,status:{in:['waiting_sender','sent']}}}});const reserved=reservations.reduce((sum,row)=>sum.plus(row.qty),new Prisma.Decimal(0)).plus(transfers.reduce((sum,row)=>sum.plus(row.qty),new Prisma.Decimal(0)));if(!stock||stock.qty.minus(qty).lessThan(reserved))throw new BadRequestException('Qaytarma üçün sərbəst anbar qalığı kifayət etmir; aktiv rezerv və transferlər qorunmalıdır');
    const lot=await tx.stockLot.findFirst({where:{organizationId:order.buyerId,qr:`MARKET:${record.receiptId}:${line.id}`,materialId:material.id,locationId:data.locationId}});
    if(!lot||lot.qty.lessThan(qty))throw new BadRequestException('Qəbul partiyasında qaytarma üçün qalıq kifayət etmir');
    await tx.stockLot.update({where:{id:lot.id},data:{qty:{decrement:qty}}});
    const po=await tx.purchaseOrder.findFirst({where:{id:`market-${order.id}-${line.id}`,organizationId:order.buyerId}});
    if(po){if(!po.receivedQty||po.receivedQty.lessThan(qty))throw new BadRequestException('Sifarişin qəbul qalığı kifayət etmir');await tx.purchaseOrder.update({where:{id:po.id},data:{receivedQty:{decrement:qty},status:'yoldadir'}});}
    await tx.stock.update({where:{id:stock.id},data:{qty:{decrement:qty}}});await tx.material.update({where:{id:material.id},data:{qty:{decrement:qty}}});const project=await tx.project.findUniqueOrThrow({where:{id:data.projectId}});await tx.movement.create({data:{organizationId:order.buyerId,material:material.name,materialId:material.id,locationId:data.locationId,unit:line.unit,type:'mexaric',qty,project:project.name,date:today(),by:ctx.name,from:`MARKET-RETURN:${order.id}:${returnId}`}});
    const supplier=await tx.marketCompany.findUnique({where:{organizationId:order.supplierId!}});await tx.payable.create({data:{organizationId:order.buyerId,supplier:supplier?.name||order.supplierId!,poId:`MARKET-RETURN:${order.id}:${returnId}`,amount:gross.negated(),status:'acik',date:today()}});
   }
   Object.assign(record,{status:'confirmed',proof});await tx.marketCase.update({where:{id},data:{status:'part_received',data:asJson(data)}});await this.event(tx,ctx,id,'return-confirmed',{returnId,proof,credits,net:net.toFixed(2),gross:gross.toFixed(2)});return {returnId,credits};
  });
 }
 async events(ctx:TenantCtx,id:string){const row=await this.caseFor(ctx,id);if(!['direktor','satinalma','muhasib'].includes(ctx.seat||''))throw new ForbiddenException('Kommersiya tarixçəsinə girişiniz yoxdur');return this.prisma.marketEvent.findMany({where:{caseId:id,...(row.kind==='rfq'&&row.buyerId!==this.org(ctx)?{organizationId:{in:[this.org(ctx),row.buyerId]}}:{})},orderBy:{createdAt:'asc'}});}
 async reminders(ctx:TenantCtx){
  const organizationId=this.org(ctx),policy=await this.policy();
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reminders:${organizationId}`}))`;
   const charges=await tx.marketCharge.findMany({where:{organizationId}});let created=0;
   for(const charge of charges){
    const effective=Prisma.Decimal.max(0,charge.amount.minus(charge.credit)),paid=Prisma.Decimal.min(charge.paid,effective),state=debtStage({acceptedAt:charge.acceptedAt,amount:effective,paid,today:today(),...policy});
    if(!['overdue','warning','restricted'].includes(state.stage))continue;
    for(const channel of ['app','email','sms']){
     const reference=`${charge.id}:${state.stage}`,where={organizationId_channel_kind_reference:{organizationId,channel,kind:'commission-due',reference}};
     if(await tx.messageOutbox.findUnique({where}))continue;
     await tx.messageOutbox.create({data:{organizationId,channel,kind:'commission-due',reference,status:channel==='app'?'available':'awaiting_provider',payload:asJson({chargeId:charge.id,balance:state.balance,dueAt:charge.dueAt,stage:state.stage,href:'/market'})}});
     if(channel==='app'){await tx.notice.create({data:{organizationId,kind:'odeme',text:`Bazar komissiyasi: ${state.balance} AZN`,dueOn:new Date(charge.dueAt+'T12:00:00Z')}});created++;}
    }
   }
   return {created,providerConnected:false};
  });
 }
}
