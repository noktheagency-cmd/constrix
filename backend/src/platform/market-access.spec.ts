import {ForbiddenException,NotFoundException} from '@nestjs/common';
import {MarketService} from './market.service';
import {TenantCtx} from './tenant.service';

describe('Market commercial privacy',()=>{
 const ctx:TenantCtx={accountId:'account-a',orgId:'supplier-a',seat:'satinalma',name:'A',email:'a@test.invalid',accountRole:'user',kind:'material'};
 const rfq={id:'rfq',kind:'rfq',buyerId:'buyer',supplierId:null,status:'sent',visibility:'private',invited:['supplier-a'],region:'Bakı',data:{files:[],lines:[{id:'line',itemId:'cement',qty:'10'}]}};
 function setup(row:unknown=rfq){
  const db:any={marketCase:{findUnique:jest.fn().mockResolvedValue(row)},marketCompany:{findUnique:jest.fn().mockResolvedValue({status:'approved'})},marketListing:{findFirst:jest.fn().mockResolvedValue({}),count:jest.fn().mockResolvedValue(1)},marketBid:{findMany:jest.fn().mockResolvedValue([])},marketMessage:{findMany:jest.fn().mockResolvedValue([]),create:jest.fn().mockImplementation(({data})=>data)}};
  const tenant:any={requireOrg:(c:TenantCtx)=>c.orgId,admin:jest.fn(()=>{throw new ForbiddenException()})};
  return {db,service:new MarketService(db,tenant,{requireOwn:jest.fn().mockResolvedValue(undefined)} as any)};
 }
 it('does not expose a private RFQ to an uninvited company',async()=>{const {service}=setup();await expect(service.detail({...ctx,orgId:'competitor'},'rfq')).rejects.toThrow(NotFoundException);});
 it('does not expose another buyer’s order',async()=>{const {service}=setup({...rfq,kind:'order',supplierId:'other'});await expect(service.detail(ctx,'rfq')).rejects.toThrow(NotFoundException);});
 it('returns only a supplier’s own quotes and directed messages',async()=>{const {service,db}=setup();await service.detail(ctx,'rfq');expect(db.marketBid.findMany.mock.calls[0][0].where).toEqual({rfqId:'rfq',supplierId:'supplier-a'});expect(db.marketMessage.findMany.mock.calls[0][0].where.OR).toEqual([{organizationId:'supplier-a'},{recipientId:'supplier-a'}]);});
 it('requires an approved supplier for invited RFQs',async()=>{const {service,db}=setup();db.marketCompany.findUnique.mockResolvedValue({status:'pending'});await expect(service.detail(ctx,'rfq')).rejects.toThrow(NotFoundException);});
 it('blocks RFQ quote access for warehouse seats',async()=>{const {service,db}=setup();await expect(service.detail({...ctx,seat:'anbardar'},'rfq')).rejects.toThrow(ForbiddenException);expect(db.marketMessage.findMany).not.toHaveBeenCalled();});
 it('masks price fields and commercial chat on field order views',async()=>{const {service}=setup({...rfq,kind:'order',supplierId:ctx.orgId,data:{files:[],payment:'bank',deliveryCost:'50',lines:[{id:'line',unitNet:'10',vatRate:'18'}],receipts:[{lines:[{accepted:'1',net:'10',gross:'11.8'}]}]}});const view=await service.detail({...ctx,seat:'anbardar'},'rfq');expect(JSON.stringify(view)).not.toMatch(/unitNet|vatRate|gross|payment|deliveryCost/);expect(view.messages).toEqual([]);});
 it('addresses buyer order messages to the supplier',async()=>{const {service}=setup({...rfq,kind:'order',buyerId:ctx.orgId,supplierId:'supplier-b'});const message=await service.message(ctx,'rfq',{text:'Salam',attachments:[]});expect(message.recipientId).toBe('supplier-b');});
});
