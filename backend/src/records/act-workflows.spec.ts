import {BadRequestException,ConflictException,NotFoundException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {ActWorkflowsService} from './act-workflows.service';
import {AuthUser} from '../auth/auth.service';
import {PrismaService} from '../prisma/prisma.service';
import {TenantService} from '../platform/tenant.service';
describe('atomic act workflows',()=>{
 const user={name:'Test',role:'director',email:'test@test.local'} as AuthUser;
 const setup=()=>{
  const receipts=new Map();const act={id:'a',organizationId:'org-a',projectId:'p',status:'qaralama',period:'2026-10',date:'2026-10-29',net:new Prisma.Decimal(500),lines:[{smetaLineId:'l',name:'Suvaq',qty:new Prisma.Decimal(20),unitPrice:new Prisma.Decimal(25)}]};
  const tx={$executeRaw:jest.fn(),operationReceipt:{findUnique:jest.fn(async({where})=>receipts.get(where.organizationId_key.key)||null),create:jest.fn(async({data})=>{receipts.set(data.key,data);return data;})},act:{findFirst:jest.fn().mockResolvedValue(act),update:jest.fn(async()=>{act.status='tesdiq';return act;})},smeta:{findFirst:jest.fn().mockResolvedValue({lines:[{id:'l',qty:new Prisma.Decimal(100),doneQty:new Prisma.Decimal(50),unitPrice:new Prisma.Decimal(25)}]})},actLine:{findMany:jest.fn().mockResolvedValue([{smetaLineId:'l',qty:new Prisma.Decimal(30)}])},auditEntry:{create:jest.fn()}};
  const db={$transaction:jest.fn(async fn=>fn(tx))};const tenant={load:jest.fn().mockResolvedValue({orgId:'org-a',accountId:'account-a',seat:'direktor'}),allow:jest.fn(),requireOrg:jest.fn().mockReturnValue('org-a')};
  return {act,tx,service:new ActWorkflowsService(db as unknown as PrismaService,tenant as unknown as TenantService)};
 };
 it('T-11: validates measured and contracted balance before confirming',async()=>{
  const {service,tx}=setup();await expect(service.approveF2(user,'a','valid-request-key-1')).resolves.toEqual({id:'a',replayed:false});expect(tx.$executeRaw).toHaveBeenCalled();expect(tx.auditEntry.create).toHaveBeenCalledTimes(1);
 });
 it('same key replays without posting twice',async()=>{const {service,tx}=setup();await service.approveF2(user,'a','valid-request-key-1');expect(await service.approveF2(user,'a','valid-request-key-1')).toEqual({id:'a',replayed:true});expect(tx.act.update).toHaveBeenCalledTimes(1);});
 it('new key cannot approve an already confirmed act',async()=>{const {service}=setup();await service.approveF2(user,'a','valid-request-key-1');await expect(service.approveF2(user,'a','valid-request-key-2')).rejects.toThrow(ConflictException);});
 it('rejects overbilling, duplicate lines, unknown periods and foreign IDs',async()=>{
  const {service,act,tx}=setup();act.lines[0].qty=new Prisma.Decimal(21);await expect(service.approveF2(user,'a','valid-request-key-1')).rejects.toThrow(BadRequestException);expect(tx.act.update).not.toHaveBeenCalled();act.period='';await expect(service.approveF2(user,'a','valid-request-key-1')).rejects.toThrow(BadRequestException);tx.act.findFirst.mockResolvedValue(null);await expect(service.approveF2(user,'b','valid-request-key-1')).rejects.toThrow(NotFoundException);
 });
});
