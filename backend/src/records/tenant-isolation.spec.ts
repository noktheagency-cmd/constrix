import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RecordsService } from './records.service';
import { resources } from './resources';
import { TenantDataService } from '../prisma/tenant-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../platform/tenant.service';
import { AuthUser } from '../auth/auth.service';

describe('legacy ERP tenant boundary',()=>{
 const actor={name:'A',role:'director',email:'a@test.local'} as AuthUser;
 const spec={route:'materials',delegate:'material'};
 const setup=()=>{
  const owned={id:'a',organizationId:'org-a',name:'Own',price:10};
  const model={findMany:jest.fn().mockResolvedValue([owned]),findUnique:jest.fn(async({where}:{where:Record<string,unknown>})=>where.id==='a'&&where.organizationId==='org-a'?owned:null),findFirst:jest.fn(),create:jest.fn(),update:jest.fn(),delete:jest.fn()};
  const db={material:model,$transaction:jest.fn(),auditEntry:{create:jest.fn()}};
  const tenant={load:jest.fn().mockResolvedValue({orgId:'org-a',seat:'direktor'}),allow:jest.fn(),requireOrg:jest.fn().mockReturnValue('org-a')};
  const scope=new TenantDataService(db as unknown as PrismaService,tenant as unknown as TenantService);
  return {service:new RecordsService(db as unknown as PrismaService,scope),scope,db,model};
 };
 it('all generic root resources have a tenant field',()=>{
  for(const resource of resources){const model=Prisma.dmmf.datamodel.models.find(m=>m.name[0].toLowerCase()+m.name.slice(1)===resource.delegate);expect(model?.fields.some(f=>f.name==='organizationId')).toBe(true);}
 });
 it('list filters organization and does not expose its internal field',async()=>{
  const {service,model}=setup();const rows=await service.findAll(spec,actor);
  expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:'org-a'}}));
  expect(rows).toEqual([{id:'a',name:'Own',price:10}]);
 });
 it('foreign IDs cannot be read, updated or removed',async()=>{
  const {service,db}=setup();
  await expect(service.findOne(spec,'b',actor)).rejects.toThrow(NotFoundException);
  await expect(service.update(spec,'b',{name:'attack'},actor)).rejects.toThrow(NotFoundException);
  await expect(service.remove(spec,'b',actor)).rejects.toThrow(NotFoundException);
  expect(db.$transaction).not.toHaveBeenCalled();
 });
 it('rejects spoofed organization before writing',async()=>{
  const {service,db}=setup();await expect(service.create(spec,{name:'x',organizationId:'org-b'},actor)).rejects.toThrow(ForbiddenException);expect(db.$transaction).not.toHaveBeenCalled();
 });
 it('does not permit nested relation injection',async()=>{
  const {scope}=setup();expect(()=>scope.scalarData('material',{name:'x',organization:{connect:{id:'org-b'}}})).toThrow(BadRequestException);
 });
 it('validates foreign scalar references against the same organization',async()=>{
  const {scope,model}=setup();model.findFirst.mockResolvedValue(null);
  await expect(scope.references('stock',{materialId:'foreign'},'org-a')).rejects.toThrow(NotFoundException);
  expect(model.findFirst).toHaveBeenCalledWith({where:{id:'foreign',organizationId:'org-a'}});
 });
 it('blocks taking another parents child row ID',async()=>{
  const {service,db}=setup();
  Object.assign(db,{smeta:{findUnique:jest.fn().mockResolvedValue({id:'sm-a'})},smetaLine:{findFirst:jest.fn().mockResolvedValue({id:'foreign',smetaId:'sm-b'})}});
  await expect(service.update({route:'smetas',delegate:'smeta',children:[{field:'lines',foreignKey:'smetaId'}]},'sm-a',{lines:[{id:'foreign',name:'x'}]},actor)).rejects.toThrow(NotFoundException);
  expect(db.$transaction).not.toHaveBeenCalled();
 });
 it('audit entries are append-only',async()=>{
  const {service,db}=setup();Object.assign(db,{auditEntry:{findUnique:jest.fn().mockResolvedValue({id:'audit-a'})}});
  await expect(service.update({route:'audit',delegate:'auditEntry'},'audit-a',{detail:'erase'},actor)).rejects.toThrow(ForbiddenException);
  await expect(service.remove({route:'audit',delegate:'auditEntry'},'audit-a',actor)).rejects.toThrow(ForbiddenException);
 });
 it('quantity users do not receive prices and cannot overwrite them',async()=>{
  const {service}=setup();const warehouse={...actor,role:'warehouse'} as AuthUser;
  expect(await service.findOne(spec,'a',warehouse)).toEqual({id:'a',name:'Own'});
  await expect(service.update(spec,'a',{price:1},warehouse)).rejects.toThrow(ForbiddenException);
 });
});
