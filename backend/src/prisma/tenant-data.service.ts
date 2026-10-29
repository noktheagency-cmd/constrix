import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from './prisma.service';

const REFERENCES: Record<string,string> = {projectId:'project',clientId:'client',smetaId:'smeta',personId:'person',materialId:'material',locationId:'location',fromId:'location',toId:'location',assetId:'asset',driverId:'driver',recipeId:'recipe',plantId:'plant',contractId:'contract',invoiceId:'invoice',actId:'act',payrollId:'payroll',departmentId:'department',officeId:'office',terminalId:'terminal',companyId:'subCompany',complexId:'complex',buildingId:'building',unitId:'unit',buyerId:'buyer',requestId:'materialRequest',orderId:'workOrder',gearId:'gear'};
const models=Prisma.dmmf.datamodel.models;
type Delegate={findFirst(args:object):Promise<unknown>;findMany(args:object):Promise<unknown[]>};

@Injectable()
export class TenantDataService {
  constructor(private readonly prisma:PrismaService,private readonly tenant:TenantService){}
  async org(user:AuthUser){
    if(!user)throw new ForbiddenException('Giriş tələb olunur');
    return this.tenant.requireOrg(await this.tenant.load(user));
  }
  async allow(user:AuthUser,route:string){
    if(!user)throw new ForbiddenException('Giriş tələb olunur');
    const ctx=await this.tenant.load(user);
    const groups:Record<string,string>={users:'members',crews:'people',people:'people',offices:'people',departments:'people',terminals:'people',attendance:'people',leaves:'people','hr-payments':'people','hr-moves':'people',payrolls:'finance',invoices:'finance',expenses:'finance',payables:'finance',periods:'finance',audit:'finance',materials:'warehouse',stocks:'warehouse',locations:'warehouse',movements:'warehouse',shipments:'warehouse',suppliers:'catalog',quotes:'catalog','purchase-orders':'orders','purchase-acts':'catalog',requests:'warehouse',smetas:'boq',contracts:'boq',acts:'boq',forma3:'boq',reports:'weather',journal:'weather',documents:'files',changes:'boq',projects:'orders',clients:'orders'};
    this.tenant.allow(ctx,groups[route]||'orders');
    return this.tenant.requireOrg(ctx);
  }
  async requireOwned(delegate:string,id:string,orgId:string){
    const row=await this.model(delegate).findFirst({where:{id,organizationId:orgId}});
    if(!row)throw new NotFoundException('Qeyd tapılmadı');
    return row;
  }
  model(delegate:string):Delegate{return (this.prisma as unknown as Record<string,Delegate>)[delegate];}
  scalarData(delegate:string,input:Record<string,unknown>,update=false){
    const metadata=models.find(m=>m.name[0].toLowerCase()+m.name.slice(1)===delegate);
    if(!metadata)throw new BadRequestException('Resurs tapılmadı');
    const allowed=new Set(metadata.fields.filter(f=>f.kind!=='object').map(f=>f.name));
    const out:Record<string,unknown>={};
    for(const [key,value]of Object.entries(input)){
      if(['createdAt','updatedAt','organizationId'].includes(key)||(update&&key==='id'))continue;
      if(!allowed.has(key))throw new BadRequestException(`İcazəsiz sahə: ${key}`);
      if(value!==undefined)out[key]=value;
    }
    return out;
  }
  async references(delegate:string,data:Record<string,unknown>,orgId:string,exclude:string[]=[]){
    const metadata=models.find(m=>m.name[0].toLowerCase()+m.name.slice(1)===delegate);
    for(const [key,value]of Object.entries(data)){
      if(exclude.includes(key)||value==null||value==='')continue;
      if(key==='smetaLineId'){
        const row=await this.prisma.smetaLine.findFirst({where:{id:String(value),smeta:{organizationId:orgId}}});
        if(!row)throw new NotFoundException('Smeta sətri tapılmadı');
        continue;
      }
      const relation=metadata?.fields.find(f=>f.kind==='object'&&f.relationFromFields?.includes(key));
      const target=relation ? relation.type[0].toLowerCase()+relation.type.slice(1) : REFERENCES[key];
      if(!target)continue;
      const targetMeta=models.find(m=>m.name[0].toLowerCase()+m.name.slice(1)===target);
      if(!targetMeta?.fields.some(f=>f.name==='organizationId'))continue;
      if(typeof value!=='string')throw new BadRequestException('Əlaqə ID-si düzgün deyil');
      await this.requireOwned(target,value,orgId);
    }
  }
}
