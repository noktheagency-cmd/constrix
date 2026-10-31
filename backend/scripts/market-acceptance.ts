import {PrismaClient} from '@prisma/client';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import bcrypt from 'bcryptjs';
import assert from 'node:assert/strict';
import {PrismaService} from '../src/prisma/prisma.service';
import {TenantService,TenantCtx} from '../src/platform/tenant.service';
import {BlobFilesService} from '../src/records/blob-files.service';
import {MarketService} from '../src/platform/market.service';
import {verifyActs} from './act-acceptance';
import {verifyTemplateDb} from './template-acceptance';

async function main(){
 const schema=`market_qa_${randomUUID().replace(/-/g,'')}`;
 assert(/^market_qa_[a-f0-9]{32}$/.test(schema));
 const base=new PrismaClient(),url=new URL(process.env.DATABASE_URL!);url.searchParams.set('schema',schema);
 await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
 const db=new PrismaClient({datasourceUrl:url.toString()});const checks:string[]=[];let passed=false;
 const check=(label:string)=>{checks.push(label);console.log(`PASS ${label}`)};
 try{
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe',windowsHide:true});
  const prisma=db as PrismaService,tenant=new TenantService(prisma),files=new BlobFilesService(prisma,tenant),market=new MarketService(prisma,tenant,files);
  const context=(orgId:string,kind='tikinti',seat='direktor'):TenantCtx=>({accountId:`account-${orgId}`,orgId,kind,seat,email:`${orgId}@test.invalid`,name:orgId,accountRole:'director'});
  const buyer=context('qa-buyer'),supplier=context('qa-supplier','material'),other=context('qa-other','material'),admin=context('qa-admin','admin');
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Baku'}).format(new Date());
  for(const ctx of [buyer,supplier,other,admin]){
   await db.organization.create({data:{id:ctx.orgId!,kind:ctx.kind as any,name:ctx.name}});
   await db.account.create({data:{id:ctx.accountId,email:ctx.email,passwordHash:await bcrypt.hash('Constrix-QA-Local-2026!',10),name:ctx.name,role:'director',title:'QA',initials:'QA',userId:ctx.accountId,activeOrgId:ctx.orgId}});
   await db.organizationMember.create({data:{organizationId:ctx.orgId!,accountId:ctx.accountId,name:ctx.name,seatRole:'direktor'}});
  }
  // Only isolated QA schema contains these clean fixture documents; upload/AV runs separately.
  async function document(ctx:TenantCtx){const bytes=Buffer.from('Local QA delivery proof');return db.blobFile.create({data:{organizationId:ctx.orgId!,uploadedBy:ctx.accountId,name:'qa-proof.txt',mime:'text/plain',kind:'commercial',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),original:Uint8Array.from(bytes),scanStatus:'clean',scanNote:'Isolated acceptance fixture'}})}
  const buyerDoc=await document(buyer),supplierDoc=await document(supplier),otherDoc=await document(other);
  for(const [index,ctx,doc] of [[1,buyer,buyerDoc],[2,supplier,supplierDoc],[3,other,otherDoc]] as const){await market.registerCompany(ctx,{name:ctx.name,region:'Bakı',voen:`990000000${index}`,documents:[doc.id]});await market.moderate(admin,'company',ctx.orgId!,{status:'approved'});}
  const proposal:any=await market.proposeItem(supplier,{name:'QA sement',unit:'ton',category:'Sement',documents:[]});await market.moderate(admin,'item',proposal.item.id,{status:'approved'});await market.listing(supplier,proposal.item.id,{availability:'Anbarda',region:'Bakı',quantity:100,leadDays:2});await market.listing(other,proposal.item.id,{availability:'Anbarda',region:'Bakı',quantity:100,leadDays:2});
  assert.equal((await market.catalog('','','')).length,1);check('approved public catalogue; no subscription required');
  const rfq:any=await market.createRfq(buyer,{key:randomUUID(),title:'QA RFQ',category:'Sement',region:'Bakı',address:'QA sahəsi',requiredDate:day,visibility:'private',invited:[supplier.orgId],files:[buyerDoc.id],lines:[{itemId:proposal.item.id,qty:100}]});
  await assert.rejects(()=>market.detail(other,rfq.id));check('uninvited company cannot read private RFQ');
  await market.message(supplier,rfq.id,{text:'Məxfi təklif',attachments:[supplierDoc.id]});
  const lineId=rfq.data.lines[0].id;
  const bid:any=await market.bid(supplier,rfq.id,{key:randomUUID(),validUntil:day,payment:'Bank köçürməsi',deliveryCost:0,leadDays:2,files:[supplierDoc.id],lines:[{lineId,qty:100,unitNet:10,vatRate:0}]});
  assert.equal((await market.detail(supplier,rfq.id)).bids.length,1);check('supplier sees own bid; buyer can select versioned quote');
  const order:any=await market.selectBid(buyer,rfq.id,bid.id,{key:randomUUID()});await market.confirmOrder(supplier,order.id,{key:randomUUID()});
  const project=await db.project.create({data:{organizationId:buyer.orgId,name:'QA layihə',clientName:'QA',district:'QA',city:'Bakı',address:'QA',phase:'QA',budget:1000,start:day,end:day,manager:'QA',status:'aktiv',type:'QA',floors:1,area:1}});
  const location=await db.location.create({data:{organizationId:buyer.orgId,name:'QA anbar',kind:'anbar',projectId:project.id}});
  await market.linkErp(buyer,order.id,{key:randomUUID(),projectId:project.id,locationId:location.id});
  assert.equal(await db.stock.count(),0);assert.equal(await db.payable.count(),0);check('order and ERP link do not create stock or debt before acceptance');
  await market.deliver(supplier,order.id,{key:randomUUID(),proof:supplierDoc.id,lines:[{lineId,qty:100}]});
  await assert.rejects(()=>market.receive({...buyer,accountId:'unassigned',seat:'anbardar'},order.id,{key:randomUUID(),proof:buyerDoc.id,lines:[{lineId,accepted:1,disputed:0}]}));check('unassigned warehouse account cannot accept goods');
  const accept={key:randomUUID(),proof:buyerDoc.id,lines:[{lineId,accepted:60,disputed:5}]};
  const [receipt,replay]:any[]=await Promise.all([market.receive(buyer,order.id,accept),market.receive(buyer,order.id,accept)]);assert.equal(receipt.id,replay.id);
  assert.equal((await db.stock.findFirstOrThrow()).qty.toString(),'60');assert.equal(await db.payable.count(),1);assert.equal(await db.marketCharge.count(),0);assert.equal(receipt.awaitingTariff,true);check('missing tariff holds both settlements without inventing rates');
  for(const side of ['buyer','supplier'])await market.saveTariff(admin,{side,scope:'default',target:'*',rate:side==='buyer'?1:2,basis:'net',effectiveFrom:day});
  await market.reconcileTariffs(admin,order.id,{key:randomUUID()});assert.equal(await db.marketCharge.count(),2);
  const charges=await db.marketCharge.findMany({orderBy:{side:'asc'}});assert.deepEqual(charges.map(c=>c.amount.toString()),['6','12']);check('concurrent same-key receipt posts stock and two-party fees exactly once; disputed 5 excluded');
  const before=await db.marketEvent.count();await assert.rejects(()=>market.receive(buyer,order.id,{key:randomUUID(),lines:[{lineId,accepted:36,disputed:0}]}));assert.equal((await db.stock.findFirstOrThrow()).qty.toString(),'60');assert.equal(await db.marketEvent.count(),before);check('over-acceptance rolls back stock, fees and audit');
  const current:any=await db.marketCase.findUniqueOrThrow({where:{id:order.id}}),dispute=current.data.disputes[0];
  await market.resolveDispute(buyer,order.id,dispute.id,{key:randomUUID(),acceptedQty:3,rejectedQty:2,proof:buyerDoc.id,note:'QA razılaşma'});
  await market.receive(buyer,order.id,{key:randomUUID(),lines:[{lineId,accepted:35,disputed:0}]});
  await market.deliver(supplier,order.id,{key:randomUUID(),proof:supplierDoc.id,lines:[{lineId,qty:2}]});await market.receive(buyer,order.id,{key:randomUUID(),lines:[{lineId,accepted:2,disputed:0}]});assert.equal((await db.marketCase.findUniqueOrThrow({where:{id:order.id}})).status,'closed');check('dispute split and replacement delivery complete order without over-acceptance');
  const returned:any=await market.requestReturn(buyer,order.id,{key:randomUUID(),receiptId:receipt.id,lineId,qty:10,note:'QA qaytarma'});await market.confirmReturn(supplier,order.id,returned.id,{key:randomUUID(),proof:supplierDoc.id});
  assert.equal((await db.stock.findFirstOrThrow()).qty.toString(),'90');assert.equal((await db.purchaseOrder.findFirstOrThrow()).receivedQty?.toString(),'90');assert.equal((await db.stockLot.findFirstOrThrow({where:{qr:`MARKET:${receipt.id}:${lineId}`}})).qty.toString(),'50');assert.equal((await db.marketCharge.findFirstOrThrow({where:{receiptId:receipt.id,side:'buyer'}})).credit.toString(),'1');check('return reverses stock, source lot, PO quantity and original commission rate');
  await market.deliver(supplier,order.id,{key:randomUUID(),proof:supplierDoc.id,lines:[{lineId,qty:10}]});await market.receive(buyer,order.id,{key:randomUUID(),lines:[{lineId,accepted:10,disputed:0}]});assert.equal((await db.marketCase.findUniqueOrThrow({where:{id:order.id}})).status,'closed');check('replacement after return closes order at net accepted quantity');
  const charge=await db.marketCharge.findFirstOrThrow({where:{receiptId:receipt.id,side:'buyer'}});const payment:any=await market.submitPayment(buyer,charge.id,{key:randomUUID(),amount:2,proof:buyerDoc.id});assert.equal((await db.marketCharge.findUniqueOrThrow({where:{id:charge.id}})).paid.toString(),'0');await market.reviewPayment(admin,payment.id,{key:randomUUID(),accepted:true,note:'QA bank check'});assert.equal((await db.marketCharge.findUniqueOrThrow({where:{id:charge.id}})).paid.toString(),'2');check('proof submission does not mark paid until independent moderator review');
  const actChecks=await verifyActs(db,buyer,project.id,location.id,day);
  check(await verifyTemplateDb(db,buyer,other,day));
  const uploaded:any=await files.upload(buyer,Buffer.from('Harmless CONSTRIX QA document v1'),{name:'qa-safe.txt',kind:'commercial',parentId:'',key:randomUUID()});assert.equal(uploaded.scanStatus,'clean');
  const version:any=await files.upload(buyer,Buffer.from('Harmless CONSTRIX QA document v2'),{name:'qa-safe.txt',kind:'commercial',parentId:uploaded.id,key:randomUUID()});assert.equal(version.version,2);assert.equal((await db.blobFile.findUniqueOrThrow({where:{id:uploaded.id}})).sha256,uploaded.sha256);await assert.rejects(()=>files.requireOwn(supplier,[uploaded.id]));await assert.rejects(()=>files.download(supplier,uploaded.id));check('real antivirus upload, immutable file versions and cross-company download guards');
  await db.blobFile.update({where:{id:version.id},data:{scanStatus:'quarantined'}});await assert.rejects(()=>files.download(buyer,version.id));await assert.rejects(()=>files.requireOwn(buyer,[version.id]));check('quarantined documents cannot be attached or downloaded');
  const prior=new Date(day+'T12:00:00Z');prior.setUTCDate(prior.getUTCDate()-8);const acceptedAt=prior.toISOString().slice(0,10);
  await db.marketCharge.create({data:{orderId:order.id,receiptId:`qa-reminder-${randomUUID()}`,organizationId:buyer.orgId!,side:'buyer',acceptedAt,dueAt:day,base:1000,rate:1,amount:10,tariff:{id:'qa-reminder',rate:'1',basis:'net'}}});
  await Promise.all([market.reminders(buyer),market.reminders(buyer)]);await market.reminders(buyer);assert.equal(await db.notice.count({where:{organizationId:buyer.orgId!,text:{startsWith:'Bazar komiss'}}}),1);assert.equal(await db.messageOutbox.count({where:{organizationId:buyer.orgId!,kind:'commission-due'}}),3);check('concurrent reminder runs create one app notification and one outbox item per channel');
  assert(await db.notice.count({where:{organizationId:supplier.orgId!,text:{startsWith:'Bazar:'}}})>0);assert.equal(await db.notice.count({where:{organizationId:other.orgId!}}),0);check('market workflow notifications reach participants without notifying unrelated companies');
  const result={passed:true,isolatedSchema:schema,checks,actChecks,checkedAt:new Date().toISOString()};writeFileSync('../docs/source-audit/market-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,marketChecks:checks.length,actChecks:actChecks.length}));passed=true;
 }finally{
  await db.$disconnect();
  // Fixed prefix + UUID verified above; never the application/public schema.
  if(passed&&process.env.MARKET_QA_UI==='1'){mkdirSync('.local-backups',{recursive:true});writeFileSync('.local-backups/market-ui-schema.json',JSON.stringify({schema}));console.log('QA fixture retained for localhost UI verification');}else await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await base.$disconnect();
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
