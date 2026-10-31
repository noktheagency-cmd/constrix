import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rethrowPrisma } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { ChildSpec, ResourceSpec } from './resources';
import { AuthUser } from '../auth/auth.service';
import { TenantDataService } from '../prisma/tenant-data.service';

type Row = Record<string, unknown>;

type ModelDelegate = {
  findMany(args: object): Promise<unknown[]>;
  findUnique(args: object): Promise<unknown>;
  create(args: object): Promise<unknown>;
  update(args: object): Promise<unknown>;
  delete(args: object): Promise<unknown>;
};

const HIDDEN = new Set(['createdAt', 'updatedAt','organizationId','passwordHash']);

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serialize(value: unknown): unknown {
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map((item) => serialize(item));
  if (!isRow(value)) return value;

  const out: Row = {};
  for (const [key, item] of Object.entries(value)) {
    if (HIDDEN.has(key)) continue;
    out[key] = serialize(item);
  }
  return out;
}

function present(value: unknown, spec: ResourceSpec): unknown {
  const row = serialize(value);
  if (!isRow(row) || !spec.children) return row;

  for (const child of spec.children) {
    const items = row[child.field];
    if (!Array.isArray(items)) continue;
    const rows = items as unknown[];
    row[child.field] = rows.map((item) => {
      if (!isRow(item)) return item;
      const copy = { ...item };
      delete copy[child.foreignKey];
      delete copy.sort;
      return copy;
    });
  }
  return row;
}

function lineData(item: unknown, index: number, child: ChildSpec): Row {
  if (!isRow(item))
    throw new BadRequestException(`${child.field} must be objects`);
  const row: Row = { ...item, sort: index };
  delete row[child.foreignKey];
  if (row.id === '' || row.id === null) delete row.id;
  return row;
}

function parentData(
  body: Row,
  spec: ResourceSpec,
  mode: 'create' | 'update',
): Row {
  const childFields = new Set(
    (spec.children ?? []).map((child) => child.field),
  );
  const data: Row = {};
  for (const [key, value] of Object.entries(body)) {
    if (HIDDEN.has(key) || childFields.has(key)) continue;
    if (mode === 'update' && key === 'id') continue;
    if (value === undefined) continue;
    data[key] = value;
  }
  if (mode === 'create' && (data.id === '' || data.id === null)) delete data.id;

  for (const child of spec.children ?? []) {
    if (!(child.field in body)) continue;
    const items = body[child.field];
    if (!Array.isArray(items)) {
      throw new BadRequestException(`${child.field} must be a list`);
    }
    const nested: Row = {
      create: items.map((item, index) => lineData(item, index, child)),
    };
    if (mode === 'update') nested.deleteMany = {};
    data[child.field] = nested;
  }
  return data;
}

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService,private readonly scope:TenantDataService) {}

  async findAll(spec: ResourceSpec,user:AuthUser) {
    const organizationId=await this.scope.allow(user,spec.route);
    return this.delegate(spec)
      .findMany({
        where:{organizationId},
        include: this.include(spec),
        orderBy: { id: 'asc' },
        take: 500,
      })
      .then((rows) => rows.map((row) => this.redact(present(row, spec),user)))
      .catch((error: unknown) => rethrowPrisma(error));
  }

  async findOne(spec: ResourceSpec, id: string,user:AuthUser) {
    const organizationId=await this.scope.allow(user,spec.route);
    const row = await this.delegate(spec).findUnique({
      where: { id,organizationId },
      include: this.include(spec),
    });
    if (!row) throw new NotFoundException(`Record ${id} was not found`);
    return this.redact(present(row, spec),user);
  }

  async create(spec: ResourceSpec, body: unknown,user:AuthUser) {
    if(spec.route==='shipments')throw new ForbiddenException('Transfer sənədi yalnız imzalı transfer workflow ilə yaradılır');
    const organizationId=await this.scope.allow(user,spec.route);
    const data=await this.safeData(spec,this.bodyOf(body),organizationId,false);
    if(spec.route==='requests'){
      data.status='gozleyir';data.author=user.name;data.decidedBy=null;data.decision=null;data.poId=null;data.fulfilledQty=0;
    }
    if(['acts','purchase-acts','forma3'].includes(spec.route)&&data.status!=='qaralama')throw new ForbiddenException('Akt yalnız qaralama kimi yaradılır');
    if(spec.route==='reports'){
      if(!['qaralama','gonderilib'].includes(String(data.status)))throw new ForbiddenException('Gündəlik yalnız qaralama və ya göndərilmiş kimi yaradılır');
      data.measuredAt='';data.measuredBy='';data.author=user.name;delete data.laborCost;delete data.machineCost;
    }
    this.writeRole(user,spec);
    try {
      const row = await this.prisma.$transaction(async tx=>{
        const result=await this.delegate(spec,tx).create({
        data: {...data,organizationId,...(spec.route==='audit'?{actor:user.name,role:user.role,at:new Date().toISOString()}: {})},
        include: this.include(spec),
        });
        if(spec.route!=='audit')await this.log(tx,organizationId,user,'Yaradıldı',spec,null,result);
        return result;
      });
      return this.redact(present(row, spec),user);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async update(spec: ResourceSpec, id: string, body: unknown,user:AuthUser) {
    if(spec.route==='shipments')throw new ForbiddenException('Transfer sənədi yalnız transfer workflow ilə dəyişir');
    const before=await this.findOne(spec, id,user);
    if(spec.route==='audit')throw new ForbiddenException('Audit qeydi dəyişdirilə bilməz');
    const organizationId=await this.scope.allow(user,spec.route);
    this.writeRole(user,spec);
    const data=await this.safeData(spec,this.bodyOf(body),organizationId,true,id);
    if(spec.route==='requests'){
      const previous=before as Row;
      if(['decidedBy','decision','author','fulfilledQty'].some((field)=>data[field]!==undefined&&JSON.stringify(data[field])!==JSON.stringify(previous[field])))throw new ForbiddenException('Tələbnamə müəllifi, qərarı və icra miqdarı xüsusi sorğu əməliyyatı ilə idarə olunur');
      if(data.status==='sifaris'&&previous.status!=='tesdiq')throw new ForbiddenException('Sifarişə yalnız rəhbər təsdiqli tələbnamə çevrilir');
      if(data.status!==undefined&&data.status!==previous.status&&(['tesdiq','anbar','redd','qaytarildi'].includes(String(data.status))||(['tesdiq','anbar','redd'].includes(String(previous.status))&&!(previous.status==='tesdiq'&&data.status==='sifaris'))))throw new ForbiddenException('Tələbnamə statusu xüsusi sorğu əməliyyatı ilə dəyişir');
      if(previous.status==='tesdiq'&&data.status==='sifaris'){
        const changed=Object.entries(data).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(previous[key]));
        if(changed.some(([key])=>!['status','poId'].includes(key)))throw new ForbiddenException('Təsdiqlənmiş tələbnamədə yalnız sifariş əlaqəsi yazıla bilər');
      }else{
        if(previous.status!=='gozleyir'&&previous.status!=='qaytarildi')throw new ForbiddenException('Yalnız açıq və ya düzəlişə qaytarılmış tələbnamə redaktə olunur');
        const advancing=['sifaris','teklif'].includes(String(data.status))&&['director','procurement','warehouse'].includes(user.role);
        if(advancing){
          const changed=Object.entries(data).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(previous[key]));
          if(changed.some(([key])=>!['status','poId'].includes(key)))throw new ForbiddenException('Tələb irəlilədikdən sonra onun mətni dəyişmir');
        }else if(user.role!=='director'&&previous.author!==user.name)throw new ForbiddenException('Tələbnaməni yalnız müəllifi və ya rəhbər redaktə edir');
      }
    }
    if(spec.route==='reports'){
      const previous=before as Row;
      if(previous.status==='tesdiq'||data.status==='tesdiq')throw new ForbiddenException('Gündəlik təsdiqi və ölçmə xüsusi əməliyyatla icra edilir');
      if(previous.status==='gonderilib' && (data.status!=='duzelis'||!['director','pm'].includes(user.role)))throw new ForbiddenException('Göndərilmiş gündəliyi yalnız rəhbər düzəlişə qaytarır');
      if(previous.status==='gonderilib')for(const key of Object.keys(data))if(key!=='status')delete data[key];
      for(const key of ['measuredAt','measuredBy','laborCost','machineCost'])delete data[key];data.author=previous.author;
    }
    if(['acts','purchase-acts','forma3'].includes(spec.route)){
      const previous=before as Row;
      if(data.status!==undefined&&data.status!==previous.status)throw new ForbiddenException('Aktın statusu xüsusi təsdiq əməliyyatı ilə dəyişir');
      if(previous.status!=='qaralama')throw new ForbiddenException('Təsdiqlənmiş aktın məzmunu dəyişmir');
    }
    let requestUpdatedAt: Date | undefined;
    if(spec.route==='requests'){
      const raw=await this.delegate(spec).findUnique({where:{id,organizationId}}) as Row|null;
      if(!raw||raw.status!==(before as Row).status)throw new ConflictException('Tələbnamə yenilənib. Məlumatı yenidən yükləyin.');
      requestUpdatedAt=raw.updatedAt instanceof Date?raw.updatedAt:undefined;
    }
    try {
      const row = await this.prisma.$transaction(async tx=>{
        if(spec.route==='stocks'){
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
          const fresh=await tx.stock.findFirst({where:{id,organizationId}});
          if(!fresh)throw new NotFoundException('Stok tapılmadı');
          if(!new Prisma.Decimal(String((before as Row).qty)).equals(fresh.qty))throw new ConflictException('Stok başqa əməliyyatla dəyişib. Məlumatı yenidən yükləyin.');
          const reservations=await tx.stockReservation.findMany({where:{organizationId,materialId:fresh.materialId,locationId:fresh.locationId,status:'active'}});
          const transferHolds=await tx.shipmentLine.findMany({where:{materialId:fresh.materialId,shipment:{organizationId,fromLocationId:fresh.locationId,status:{in:['waiting_sender','sent']}}}});
          const reserved=reservations.reduce((sum,item)=>sum.plus(item.qty),new Prisma.Decimal(0)).plus(transferHolds.reduce((sum,item)=>sum.plus(item.qty),new Prisma.Decimal(0)));
          if((reservations.length||transferHolds.length)&&((data.materialId!==undefined&&data.materialId!==fresh.materialId)||(data.locationId!==undefined&&data.locationId!==fresh.locationId)))throw new ConflictException('Aktiv rezerv və ya transfer gözləyən stokun materialı/anbarı dəyişdirilə bilməz');
          const nextQty=data.qty===undefined?fresh.qty:new Prisma.Decimal(String(data.qty));
          if(nextQty.lessThan(reserved))throw new ConflictException(`Bu anbarda ${reserved.toString()} vahid aktiv rezerv var; stok bundan aşağı salına bilməz`);
        }
        if(spec.route==='requests'){
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
          const fresh=await this.delegate(spec,tx).findUnique({where:{id,organizationId}}) as Row|null;
          const freshUpdated=fresh?.updatedAt;
          if(!fresh||!requestUpdatedAt||!(freshUpdated instanceof Date)||requestUpdatedAt.getTime()!==freshUpdated.getTime())throw new ConflictException('Tələbnamə yenilənib. Məlumatı yenidən yükləyin.');
        }
        if(spec.route==='reports'){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;const fresh=await this.delegate(spec,tx).findUnique({where:{id,organizationId}}) as Row|null;if(!fresh||fresh.status==='tesdiq'||fresh.status!==(before as Row).status)throw new ForbiddenException('Gündəlik statusu dəyişib. Yeniləyin');}
        if(['acts','purchase-acts','forma3'].includes(spec.route)){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;const fresh=await this.delegate(spec,tx).findUnique({where:{id,organizationId}}) as Row|null;if(!fresh||fresh.status!=='qaralama')throw new ForbiddenException('Sənəd artıq təsdiqlənib. Yeniləyin.');}
        const result=await this.delegate(spec,tx).update({
        where: { id,organizationId },
        data,
        include: this.include(spec),
        });
        await this.log(tx,organizationId,user,'Dəyişdirildi',spec,before,result);
        return result;
      });
      return this.redact(present(row, spec),user);
    } catch (error) {
      rethrowPrisma(error);
    }
  }

  async remove(spec: ResourceSpec, id: string,user:AuthUser) {
    if(spec.route==='shipments')throw new ForbiddenException('Transfer sənədi silinmir; gözləyən sənədi ləğv edin');
    const before=await this.findOne(spec, id,user);
    const organizationId=await this.scope.allow(user,spec.route);
    this.writeRole(user,spec);
    if(spec.route==='requests'&&!['gozleyir','qaytarildi'].includes(String((before as Row).status)))throw new ForbiddenException('Yalnız açıq və ya düzəlişə qaytarılmış tələbnamə silinir');
    if(['audit','expenses','invoices','payables','journal'].includes(spec.route))throw new ForbiddenException('Maliyyə və audit qeydi silinmir. Düzəliş əməliyyatı yaradın.');
    await this.prisma.$transaction(async tx=>{
      if(spec.route==='stocks'){
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
        const stock=await tx.stock.findFirst({where:{id,organizationId}});
        if(stock){const reservations=await tx.stockReservation.findMany({where:{organizationId,materialId:stock.materialId,locationId:stock.locationId,status:'active'}});const transfers=await tx.shipmentLine.findMany({where:{materialId:stock.materialId,shipment:{organizationId,fromLocationId:stock.locationId,status:{in:['waiting_sender','sent']}}}});if(reservations.length||transfers.length)throw new ConflictException('Stok aktiv tələb rezervində və ya transferdədir; əvvəl sənədi tamamlayın və ya ləğv edin');}
      }
      if(spec.route==='requests'){
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
        const fresh=await this.delegate(spec,tx).findUnique({where:{id,organizationId}}) as Row|null;
        if(!fresh||fresh.status!==(before as Row).status)throw new ConflictException('Tələbnamə yenilənib. Məlumatı yenidən yükləyin.');
      }
      if(spec.route==='reports'){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;const fresh=await this.delegate(spec,tx).findUnique({where:{id,organizationId}}) as Row|null;if(!fresh||!['qaralama','duzelis'].includes(String(fresh.status)))throw new ForbiddenException('Yalnız qaralama və ya düzəliş gündəliyi silinir');}
      if(['acts','purchase-acts','forma3'].includes(spec.route)){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;const fresh=await this.delegate(spec,tx).findUnique({where:{id,organizationId}}) as Row|null;if(!fresh||fresh.status!=='qaralama')throw new ForbiddenException('Təsdiqlənmiş sənəd silinmir. Əvvəl düzəliş üçün qaytarın.');}
      await this.delegate(spec,tx).delete({where:{id,organizationId}});
      await this.log(tx,organizationId,user,'Silindi',spec,before,null);
    });
  }

  private async safeData(spec:ResourceSpec,input:Row,orgId:string,update:boolean,parentId?:string){
    if(input.organizationId!=null&&input.organizationId!==orgId)throw new ForbiddenException('Başqa şirkətə yazmaq olmaz');
    if(spec.route==='reports' && input.photos!==undefined){
      if(!Array.isArray(input.photos)||input.photos.length>30||input.photos.some(id=>typeof id!=='string'))throw new BadRequestException('Ən çox 30 şəkil ID-si tələb olunur');
      const ids=[...new Set(input.photos as string[])];
      const count=await this.prisma.blobFile.count({where:{id:{in:ids},organizationId:orgId,kind:'project',scanStatus:'clean',mime:{in:['image/png','image/jpeg','image/webp']}}});
      if(count!==ids.length)throw new BadRequestException('Şəkil şirkətə aid deyil və ya təhlükəsizlik yoxlaması tamamlanmayıb');
      input={...input,photos:ids};
    }
    const children=new Set(spec.children?.map(c=>c.field)||[]);
    const scalars=this.scope.scalarData(spec.delegate,Object.fromEntries(Object.entries(input).filter(([key])=>!children.has(key))),update);
    await this.scope.references(spec.delegate,scalars,orgId);
    if(spec.route==='reports'){
      const report=parentId?await this.prisma.dailyReport.findFirst({where:{id:parentId,organizationId:orgId}}):null;
      const projectId=String(input.projectId||report?.projectId||'');
      if(input.status!==undefined&&!['qaralama','gonderilib','duzelis','tesdiq'].includes(String(input.status)))throw new BadRequestException('Gündəlik statusu düzgün deyil');
      for(const field of ['lines','attendance','machines']){
        if(input[field]===undefined)continue;
        if(!Array.isArray(input[field]))throw new BadRequestException('Gündəlik sətirləri siyahı olmalıdır');
        const seen=new Set<string>();
        for(const row of input[field] as Row[]){
          const id=String(row?.[field==='lines'?'smetaLineId':field==='attendance'?'personId':'assetId']||'');
          const value=Number(row?.[field==='lines'?'qty':'hours']);
          if(!id||seen.has(id)||!Number.isFinite(value)||value<=0||(field!=='lines'&&value>24))throw new BadRequestException('Təkrar sətir və ya düzgün olmayan həcm/saat');seen.add(id);
          if(field==='lines'&&!await this.prisma.smetaLine.findFirst({where:{id,kind:'work',smeta:{organizationId:orgId,projectId}}}))throw new BadRequestException('İş sətri bu layihənin smetasına aid deyil');
        }
      }
    }
    const meta=Prisma.dmmf.datamodel.models.find(m=>m.name[0].toLowerCase()+m.name.slice(1)===spec.delegate);
    for(const child of spec.children||[]){
      if(!(child.field in input))continue;
      if(!Array.isArray(input[child.field]))throw new BadRequestException('Sətirlər siyahı olmalıdır');
      const childModel=meta?.fields.find(f=>f.name===child.field)?.type;
      if(!childModel)throw new BadRequestException('Sətir növü düzgün deyil');
      const delegate=childModel[0].toLowerCase()+childModel.slice(1);
      const prepared:Row[]=[];
      for(const item of input[child.field] as unknown[]){
        if(!isRow(item))throw new BadRequestException('Sətir düzgün deyil');
        const row=this.scope.scalarData(delegate,item);
        delete row[child.foreignKey];
        if(delegate==='purchaseActLine'){delete row.receivedQty;delete row.payableQty;delete row.closedQty;}
        if(row.id){
          const exists=await this.scope.model(delegate).findFirst({where:{id:row.id}}) as Row|null;
          if(exists&&(!parentId||exists[child.foreignKey]!==parentId))throw new NotFoundException('Sətir tapılmadı');
        }
        await this.scope.references(delegate,row,orgId,[child.foreignKey]);
        prepared.push(row);
      }
      scalars[child.field]=prepared;
    }
    return parentData(scalars,spec,update?'update':'create');
  }
  private writeRole(user:AuthUser,spec:ResourceSpec){
    if(['warehouse','site'].includes(user.role)&&['purchase-acts','purchase-orders','invoices','expenses','payables','materials','quotes','suppliers'].includes(spec.route))throw new ForbiddenException('Qiymət və maliyyə qeydlərini yalnız səlahiyyətli əməkdaş dəyişir');
  }
  private redact(value:unknown,user:AuthUser):unknown{
    if(!['warehouse','site'].includes(user.role))return value;
    if(Array.isArray(value))return value.map(v=>this.redact(v,user));
    if(!isRow(value))return value;
    const privateFields=new Set(['price','unitPrice','amount','net','vat','gross','cashPaid','firmName','supplier','supplierId','cost','unitCost','budget','spent','value','rate','salary','hourlyRate','wage']);
    return Object.fromEntries(Object.entries(value).filter(([key])=>!privateFields.has(key)).map(([key,v])=>[key,this.redact(v,user)]));
  }
  private async log(tx:Prisma.TransactionClient,organizationId:string,user:AuthUser,action:string,spec:ResourceSpec,before:unknown,after:unknown){
    await tx.auditEntry.create({data:{organizationId,at:new Date().toISOString(),actor:user.name,role:user.role,action:`${spec.route}: ${action}`,detail:JSON.stringify({before:serialize(before),after:serialize(after)})}});
  }

  private bodyOf(body: unknown): Row {
    if (!isRow(body)) throw new BadRequestException('Body must be an object');
    return body;
  }

  private include(spec: ResourceSpec) {
    if (!spec.children?.length) return undefined;
    return Object.fromEntries(
      spec.children.map((child) => [child.field, { orderBy: { sort: 'asc' } }]),
    );
  }

  private delegate(spec: ResourceSpec,client:unknown=this.prisma): ModelDelegate {
    const models = client as Record<string, ModelDelegate>;
    const model = models[spec.delegate];
    if (!model) throw new NotFoundException(`Unknown resource ${spec.route}`);
    return model;
  }
}
