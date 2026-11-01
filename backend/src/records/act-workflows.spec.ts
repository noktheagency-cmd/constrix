import {BadRequestException,ConflictException,NotFoundException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
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
 it('replays purchase receipt with the same idempotency key and body without posting again',async()=>{
  const body={key:'purchase-receipt-key-001',locationId:'location-a',lines:[{purchaseActLineId:'line-a',acceptedQty:'1',disputedQty:'0',note:'',disputeReason:''}]};
  const requestHash=createHash('sha256').update(JSON.stringify({id:'purchase-a',locationId:'location-a',receivedAt:'',lines:body.lines})).digest('hex');
  const tx={
   $executeRaw:jest.fn(),
   operationReceipt:{findUnique:jest.fn().mockResolvedValue({accountId:'account-a',requestHash,changedBooks:{receiptId:'receipt-a'}})},
   purchaseReceipt:{create:jest.fn()},purchaseAct:{findFirst:jest.fn()},location:{findFirst:jest.fn()},
  };
  const db={$transaction:jest.fn(async fn=>fn(tx))};
  const tenant={load:jest.fn().mockResolvedValue({orgId:'org-a',accountId:'account-a',seat:'anbardar'}),allow:jest.fn(),requireOrg:jest.fn().mockReturnValue('org-a')};
  const service=new ActWorkflowsService(db as unknown as PrismaService,tenant as unknown as TenantService);
  await expect(service.receivePurchase({...user,role:'warehouse'},'purchase-a',body)).resolves.toEqual({id:'purchase-a',replayed:true});
  expect(tenant.allow).toHaveBeenCalledWith(expect.objectContaining({seat:'anbardar'}),'warehouse');
  expect(tx.purchaseReceipt.create).not.toHaveBeenCalled();expect(tx.purchaseAct.findFirst).not.toHaveBeenCalled();
 });
 it('rejects a changed purchase receipt body reusing the idempotency key',async()=>{
  const originalLines=[{purchaseActLineId:'line-a',acceptedQty:'1',disputedQty:'0',note:'',disputeReason:''}];
  const requestHash=createHash('sha256').update(JSON.stringify({id:'purchase-a',locationId:'location-a',receivedAt:'',lines:originalLines})).digest('hex');
  const tx={$executeRaw:jest.fn(),operationReceipt:{findUnique:jest.fn().mockResolvedValue({accountId:'account-a',requestHash})}};
  const db={$transaction:jest.fn(async fn=>fn(tx))};
  const tenant={load:jest.fn().mockResolvedValue({orgId:'org-a',accountId:'account-a',seat:'direktor'}),allow:jest.fn(),requireOrg:jest.fn().mockReturnValue('org-a')};
  const service=new ActWorkflowsService(db as unknown as PrismaService,tenant as unknown as TenantService);
  await expect(service.receivePurchase(user,'purchase-a',{key:'purchase-receipt-key-001',locationId:'location-a',lines:[{purchaseActLineId:'line-a',acceptedQty:'2',disputedQty:'0'}]})).rejects.toThrow(ConflictException);
 });
 it('allows warehouse receipt while cashPaid does not reduce payable before finance approval',async()=>{
  const line={id:'line-a',actId:'purchase-a',materialName:'Steel',unit:'ton',qty:new Prisma.Decimal(10),unitPrice:new Prisma.Decimal(10),amount:new Prisma.Decimal(100),cashPaid:new Prisma.Decimal(80),firmName:'Supplier A',materialId:null,receivedQty:new Prisma.Decimal(0),payableQty:new Prisma.Decimal(0),closedQty:new Prisma.Decimal(0)};
  const tx={
   $executeRaw:jest.fn(),
   operationReceipt:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn()},
   purchaseAct:{findFirst:jest.fn().mockResolvedValue({id:'purchase-a',organizationId:'org-a',number:'AA-QA',project:'',date:'2026-11-01',status:'qaralama',lines:[line],adjustments:[]}),update:jest.fn()},
   location:{findFirst:jest.fn().mockResolvedValue({id:'location-a',name:'QA warehouse'})},
   purchaseReceiptLine:{findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(0),create:jest.fn().mockResolvedValue({id:'receipt-line-a'})},
   purchaseReceipt:{create:jest.fn().mockResolvedValue({id:'receipt-a'})},
   material:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({id:'material-a',name:'Steel',unit:'ton'}),update:jest.fn()},
   stock:{upsert:jest.fn()},movement:{create:jest.fn()},stockLot:{create:jest.fn().mockResolvedValue({id:'lot-a'}),update:jest.fn()},
   purchaseActLine:{update:jest.fn(),findMany:jest.fn().mockResolvedValue([{...line,materialId:'material-a',receivedQty:new Prisma.Decimal(5),payableQty:new Prisma.Decimal(5)}])},
   payable:{create:jest.fn().mockResolvedValue({id:'payable-a'})},auditEntry:{create:jest.fn()},
  };
  const db={$transaction:jest.fn(async fn=>fn(tx))};
  const tenant={load:jest.fn().mockResolvedValue({orgId:'org-a',accountId:'warehouse-a',seat:'anbardar'}),allow:jest.fn(),requireOrg:jest.fn().mockReturnValue('org-a')};
  const service=new ActWorkflowsService(db as unknown as PrismaService,tenant as unknown as TenantService);
  const result=await service.receivePurchase({...user,role:'warehouse',name:'Warehouse'},'purchase-a',{key:'purchase-cash-key-001',locationId:'location-a',lines:[{purchaseActLineId:'line-a',acceptedQty:'5',disputedQty:'0'}]});
  expect(result).toMatchObject({status:'qismən',replayed:false});
  expect(tenant.allow).toHaveBeenCalledWith(expect.objectContaining({seat:'anbardar'}),'warehouse');
  expect(tx.stock.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{qty:{increment:new Prisma.Decimal(5)}}}));
  expect(tx.payable.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({amount:new Prisma.Decimal(50),supplier:'Supplier A'})}));
 });
});
