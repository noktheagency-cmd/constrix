import {
  BadRequestException,
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
    const organizationId=await this.scope.allow(user,spec.route);
    const data=await this.safeData(spec,this.bodyOf(body),organizationId,false);
    if(['acts','purchase-acts','forma3'].includes(spec.route)&&data.status!=='qaralama')throw new ForbiddenException('Akt yalnız qaralama kimi yaradılır');
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
    const before=await this.findOne(spec, id,user);
    if(spec.route==='audit')throw new ForbiddenException('Audit qeydi dəyişdirilə bilməz');
    const organizationId=await this.scope.allow(user,spec.route);
    this.writeRole(user,spec);
    const data=await this.safeData(spec,this.bodyOf(body),organizationId,true,id);
    if(['acts','purchase-acts','forma3'].includes(spec.route)){
      const previous=before as Row;
      if(data.status!==undefined&&data.status!==previous.status)throw new ForbiddenException('Aktın statusu xüsusi təsdiq əməliyyatı ilə dəyişir');
      if(previous.status!=='qaralama')throw new ForbiddenException('Təsdiqlənmiş aktın məzmunu dəyişmir');
    }
    try {
      const row = await this.prisma.$transaction(async tx=>{
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
    const before=await this.findOne(spec, id,user);
    const organizationId=await this.scope.allow(user,spec.route);
    this.writeRole(user,spec);
    if(['audit','expenses','invoices','payables','journal'].includes(spec.route))throw new ForbiddenException('Maliyyə və audit qeydi silinmir. Düzəliş əməliyyatı yaradın.');
    await this.prisma.$transaction(async tx=>{
      if(['acts','purchase-acts','forma3'].includes(spec.route)){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;const fresh=await this.delegate(spec,tx).findUnique({where:{id,organizationId}}) as Row|null;if(!fresh||fresh.status!=='qaralama')throw new ForbiddenException('Təsdiqlənmiş sənəd silinmir. Əvvəl düzəliş üçün qaytarın.');}
      await this.delegate(spec,tx).delete({where:{id,organizationId}});
      await this.log(tx,organizationId,user,'Silindi',spec,before,null);
    });
  }

  private async safeData(spec:ResourceSpec,input:Row,orgId:string,update:boolean,parentId?:string){
    if(input.organizationId!=null&&input.organizationId!==orgId)throw new ForbiddenException('Başqa şirkətə yazmaq olmaz');
    const children=new Set(spec.children?.map(c=>c.field)||[]);
    const scalars=this.scope.scalarData(spec.delegate,Object.fromEntries(Object.entries(input).filter(([key])=>!children.has(key))),update);
    await this.scope.references(spec.delegate,scalars,orgId);
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
