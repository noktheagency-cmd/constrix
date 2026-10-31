import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {AuthUser} from '../auth/auth.service';
import {PrismaService} from '../prisma/prisma.service';
import {TenantService} from '../platform/tenant.service';
import {can} from '../auth/access';
import {serializable} from '../prisma/serializable';

@Injectable()
export class ActWorkflowsService{
 constructor(private readonly prisma:PrismaService,private readonly tenant:TenantService){}
 private async context(user:AuthUser,purchase=false){
  const ctx=await this.tenant.load(user);this.tenant.allow(ctx,purchase?'catalog':'boq');
  if(!can(user.role,purchase?'supply':'acts'))throw new ForbiddenException('Bu əməliyyat rolunuza uyğun deyil');
  return {...ctx,orgId:this.tenant.requireOrg(ctx)};
 }
 private key(value:unknown){const key=String(value||'');if(!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw new BadRequestException('Əməliyyat açarı düzgün deyil');return key;}
 async daily(user:AuthUser,id:string,body:Record<string,unknown>,measure:boolean){
  const ctx=await this.tenant.load(user);this.tenant.allow(ctx,'weather');
  if(!['director','pm'].includes(user.role))throw new ForbiddenException('Gündəlik təsdiqi və ölçmə rəhbər səlahiyyəti tələb edir');
  const organizationId=this.tenant.requireOrg(ctx);
  return this.transition({...ctx,orgId:organizationId},user,id,measure?'measure-daily':'approve-daily',body,async tx=>{
   const report=await tx.dailyReport.findFirst({where:{id,organizationId},include:{lines:true,machines:true,attendance:true}});
   if(!report)throw new NotFoundException('Gündəlik tapılmadı');
   if(!measure){
    if(report.status!=='gonderilib')throw new ConflictException('Yalnız göndərilmiş gündəlik təsdiqlənir');
    await tx.dailyReport.update({where:{id},data:{status:'tesdiq',measuredAt:'',measuredBy:''}});
    return {before:report,after:{status:'tesdiq',measuredAt:''}};
   }
   if(report.status!=='tesdiq'||report.measuredAt!=='')throw new ConflictException('Gündəlik təsdiqlənməyib və ya həcmi artıq ölçülüb');
   const project=await tx.project.findFirst({where:{id:report.projectId,organizationId}});
   const smeta=await tx.smeta.findFirst({where:{projectId:report.projectId,organizationId},include:{lines:true},orderBy:{version:'desc'}});
   if(!project||!smeta||!report.lines.length)throw new BadRequestException('Layihə, smeta və iş həcmləri yoxlanmalıdır');
   const date=new Date().toISOString().slice(0,10);
   if(await tx.closedPeriod.findFirst({where:{organizationId,value:date.slice(0,7)}}))throw new BadRequestException('Qapalı maliyyə dövründə ölçmə xərci yazılmır');
   let laborHours=new Prisma.Decimal(0),machineCost=new Prisma.Decimal(0);
   const seen=new Set<string>();
   for(const row of report.lines){
    const source=smeta.lines.find(line=>line.id===row.smetaLineId&&line.kind==='work');
    if(!source||seen.has(source.id)||!row.qty.greaterThan(0)||source.doneQty.plus(row.qty).greaterThan(source.qty))throw new BadRequestException('Təkrar iş, uyğun olmayan smeta və ya qalıq həcm aşılması');
    seen.add(source.id);source.doneQty=source.doneQty.plus(row.qty);laborHours=laborHours.plus(row.qty.mul(source.laborHours));
    await tx.smetaLine.update({where:{id:source.id},data:{doneQty:source.doneQty}});
   }
   const site=await tx.location.findFirst({where:{organizationId,projectId:project.id}});
   for(const row of report.machines){
    const asset=await tx.asset.findFirst({where:{id:row.assetId,organizationId}});
    if(!asset||!row.hours.greaterThan(0)||row.hours.greaterThan(24))throw new BadRequestException('Texnika və moto-saatı yoxlayın');
    const fuel=row.hours.mul(asset.fuelPerHour||0).toDecimalPlaces(3);
    if(fuel.greaterThan(0)){
     const material=await tx.material.findFirst({where:{id:'MAT-DSL',organizationId}});
     const piles=material?await tx.stock.findMany({where:{organizationId,materialId:material.id}}):[];
     const reservedByStock=new Map<string,Prisma.Decimal>();for(const reservation of material?await tx.stockReservation.findMany({where:{organizationId,materialId:material.id,status:'active'}}):[])reservedByStock.set(reservation.locationId,(reservedByStock.get(reservation.locationId)||new Prisma.Decimal(0)).plus(reservation.qty));
     for(const line of material?await tx.shipmentLine.findMany({where:{materialId:material.id,shipment:{organizationId,fromLocationId:{in:piles.map(row=>row.locationId)},status:{in:['waiting_sender','sent']}}},include:{shipment:{select:{fromLocationId:true}}}}):[]){const locationId=line.shipment.fromLocationId;if(locationId)reservedByStock.set(locationId,(reservedByStock.get(locationId)||new Prisma.Decimal(0)).plus(line.qty));}
     const free=(stock:typeof piles[number])=>stock.qty.minus(reservedByStock.get(stock.locationId)||new Prisma.Decimal(0));
     const pile=piles.find(stock=>stock.locationId===site?.id&&free(stock).greaterThanOrEqualTo(fuel))||piles.find(stock=>stock.locationId==='LOC-MERKEZ'&&free(stock).greaterThanOrEqualTo(fuel));
     if(!material||!pile||material.qty.lessThan(fuel))throw new BadRequestException('Dizel qalığı moto-saatı örtmür');
     await tx.stock.update({where:{id:pile.id},data:{qty:{decrement:fuel}}});await tx.material.update({where:{id:material.id},data:{qty:{decrement:fuel}}});
     await tx.movement.create({data:{organizationId,materialId:material.id,material:material.name,locationId:pile.locationId,type:'mexaric',qty:fuel,unit:material.unit,project:project.name,date,by:user.name,from:`DAILY:${id}`}});
    }
    await tx.asset.update({where:{id:asset.id},data:{hours:{increment:row.hours}}});machineCost=machineCost.plus(row.hours.mul(asset.rate||0));
   }
   const attendees=new Set<string>();let attendedHours=new Prisma.Decimal(0);
   for(const row of report.attendance){if(attendees.has(row.personId)||!row.hours.greaterThan(0)||row.hours.greaterThan(24)||!await tx.person.findFirst({where:{id:row.personId,organizationId}}))throw new BadRequestException('HR işçi və saat məlumatını yoxlayın');attendees.add(row.personId);attendedHours=attendedHours.plus(row.hours);}
   const laborCost=(attendees.size?attendedHours:laborHours).mul(8).toDecimalPlaces(2);machineCost=machineCost.toDecimalPlaces(2);
   for(const [category,vendor,amount] of [['Əmək haqqı',attendees.size?'Tabel':'İşəmuzd',laborCost],['Texnika','Daxili park',machineCost]] as const){if(amount.greaterThan(0))await tx.expense.create({data:{organizationId,category,vendor,project:project.name,amount,date}});}
   const plan=smeta.lines.reduce((sum,line)=>sum.plus(line.qty.mul(line.unitPrice)),new Prisma.Decimal(0)),done=smeta.lines.reduce((sum,line)=>sum.plus(line.doneQty.mul(line.unitPrice)),new Prisma.Decimal(0));
   await tx.project.update({where:{id:project.id},data:{progress:plan.greaterThan(0)?Math.min(100,done.div(plan).mul(100).toDecimalPlaces(0).toNumber()):0,spent:{increment:laborCost.plus(machineCost)}}});
   const measuredAt=new Date().toISOString();await tx.dailyReport.update({where:{id},data:{measuredAt,measuredBy:user.name,laborCost,machineCost}});
   return {before:report,after:{measuredAt,measuredBy:user.name,laborCost: laborCost.toString(),machineCost:machineCost.toString()}};
  });
 }
 async approveF2(user:AuthUser,id:string,keyInput:unknown){
  const ctx=await this.context(user),key=this.key(keyInput),hash=createHash('sha256').update(`approve-f2:${id}`).digest('hex');
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId:ctx.orgId,key}}});
   if(replay){if(replay.requestHash!==hash||replay.accountId!==ctx.accountId)throw new ConflictException('Əməliyyat açarı təkrarlanır');return {id,replayed:true};}
   const act=await tx.act.findFirst({where:{id,organizationId:ctx.orgId},include:{lines:true}});
   if(!act)throw new NotFoundException('Akt tapılmadı');
   if(act.status!=='qaralama')throw new ConflictException('Akt artıq işlənib');
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(act.period)||!/^\d{4}-\d{2}-\d{2}$/.test(act.date)||!act.lines.length)throw new BadRequestException('Aktın dövrü, tarixi və iş sətirləri yoxlanmalıdır');
   const smeta=await tx.smeta.findFirst({where:{projectId:act.projectId,organizationId:ctx.orgId},include:{lines:true},orderBy:{version:'desc'}});
   if(!smeta)throw new BadRequestException('Smeta tapılmadı');
   const previous=await tx.actLine.findMany({where:{act:{projectId:act.projectId,organizationId:ctx.orgId,status:{in:['tesdiq','faktura']}},actId:{not:id}}});
   const seen=new Set<string>();let net=new Prisma.Decimal(0);
   for(const row of act.lines){
    const source=smeta.lines.find(l=>l.id===row.smetaLineId);
    if(!source||seen.has(row.smetaLineId)||!row.qty.greaterThan(0))throw new BadRequestException('Təkrar və ya uyğunsuz smeta sətri var');seen.add(row.smetaLineId);
    const used=previous.filter(l=>l.smetaLineId===row.smetaLineId).reduce((sum,l)=>sum.plus(l.qty),new Prisma.Decimal(0));
    if(used.plus(row.qty).greaterThan(source.qty)||used.plus(row.qty).greaterThan(source.doneQty))throw new BadRequestException(`${row.name}: müqavilə və ya ölçülmüş həcm qalığı aşılır`);
    if(!row.unitPrice.equals(source.unitPrice))throw new BadRequestException('Vahid qiymət təsdiqlənmiş smeta ilə uyğun deyil');
    net=net.plus(row.qty.mul(row.unitPrice));
   }
   if(!net.toDecimalPlaces(2).equals(act.net))throw new BadRequestException('Akt yekunu iş sətirləri ilə uyğun deyil');
   await tx.act.update({where:{id},data:{status:'tesdiq'}});
   await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:user.name,role:user.role,action:'Forma-2 təsdiqi',detail:JSON.stringify({id,key,before:'qaralama',after:'tesdiq',net:act.net.toString()})}});
   await tx.operationReceipt.create({data:{organizationId:ctx.orgId,accountId:ctx.accountId,key,requestHash:hash,command:'approve-f2',changedBooks:['acts']}});
   return {id,replayed:false};
  });
 }
 async receivePurchase(user:AuthUser,id:string,body:Record<string,unknown>){
  const ctx=await this.context(user,true),key=this.key(body.key),locationId=String(body.locationId||''),
   receivedAt=String(body.receivedAt||new Date().toISOString()),linesInput=Array.isArray(body.lines)?body.lines as Record<string,unknown>[]:[];
  if(!linesInput.length)throw new BadRequestException('Qəbul edilən sətir miqdarlarını daxil edin');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(receivedAt)||Number.isNaN(Date.parse(receivedAt)))throw new BadRequestException('Qəbul tarixi düzgün deyil');
  const normalized=linesInput.map(line=>({purchaseActLineId:String(line.purchaseActLineId||''),acceptedQty:String(line.acceptedQty||'0'),disputedQty:String(line.disputedQty||'0'),note:String(line.note||'').trim(),disputeReason:String(line.disputeReason||'').trim()})).sort((a,b)=>a.purchaseActLineId.localeCompare(b.purchaseActLineId));
  if(normalized.some(line=>!/^\d+(?:\.\d{1,3})?$/.test(line.acceptedQty)||!/^\d+(?:\.\d{1,3})?$/.test(line.disputedQty)))throw new BadRequestException('Qəbul və mübahisəli miqdarı 3 onluq rəqəm dəqiqliyi ilə daxil edin');
  const hash=createHash('sha256').update(JSON.stringify({id,locationId,receivedAt:body.receivedAt||'',lines:normalized})).digest('hex');
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId:ctx.orgId,key}}});
   if(replay){if(replay.requestHash!==hash||replay.accountId!==ctx.accountId)throw new ConflictException('Əməliyyat açarı təkrarlanır');return {id,replayed:true};}
   const [act,location]=await Promise.all([tx.purchaseAct.findFirst({where:{id,organizationId:ctx.orgId},include:{lines:true,adjustments:true}}),tx.location.findFirst({where:{id:locationId,organizationId:ctx.orgId}})]);
   if(!act||!location)throw new NotFoundException('Akt və ya anbar tapılmadı');
   if(!['qaralama','qismən'].includes(act.status))throw new ConflictException('Akt artıq bağlanıb');
   if(!act.date||!act.lines.length)throw new BadRequestException('Aktın tarixi və materialları yoxlanmalıdır');
   if(act.adjustments.length)throw new BadRequestException('Qiymət fərqi əlavəsini ayrıca maliyyə düzəlişi kimi yoxlayın');
   const historicalLines=await tx.purchaseReceiptLine.findMany({where:{purchaseLineId:{in:act.lines.map(line=>line.id)},receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}}});
   const receivedByLine=new Map<string,Prisma.Decimal>(),payableByLine=new Map<string,Prisma.Decimal>();for(const line of historicalLines){receivedByLine.set(line.purchaseLineId,(receivedByLine.get(line.purchaseLineId)||new Prisma.Decimal(0)).plus(line.acceptedQty));payableByLine.set(line.purchaseLineId,(payableByLine.get(line.purchaseLineId)||new Prisma.Decimal(0)).plus(line.acceptedQty.minus(line.replacementQty)));}
   if(act.lines.some(line=>!(receivedByLine.get(line.id)||new Prisma.Decimal(0)).equals(line.receivedQty||0)||!(payableByLine.get(line.id)||new Prisma.Decimal(0)).equals(line.payableQty||0)))throw new ConflictException('Qəbul tarixçəsi və akt qalığı uzlaşmır; reconciliation tələb olunur');
   const requested=new Map<string,{accepted:Prisma.Decimal;disputed:Prisma.Decimal;note:string;disputeReason:string}>();
   for(const input of normalized){const accepted=new Prisma.Decimal(input.acceptedQty),disputed=new Prisma.Decimal(input.disputedQty);if(requested.has(input.purchaseActLineId)||!accepted.greaterThanOrEqualTo(0)||!disputed.greaterThanOrEqualTo(0))throw new BadRequestException('Qəbul sətirləri təkrarlanır və ya miqdar düzgün deyil');requested.set(input.purchaseActLineId,{accepted,disputed,note:input.note,disputeReason:input.disputeReason});}
   if([...requested.keys()].some(lineId=>!act.lines.some(line=>line.id===lineId)))throw new BadRequestException('Alış aktına aid olmayan sətir var');
   const receipt=await tx.purchaseReceipt.create({data:{organizationId:ctx.orgId,actId:id,locationId,receivedAt,receivedBy:user.name,note:String(body.note||'')}});
   const amounts=new Map<string,Prisma.Decimal>();let net=new Prisma.Decimal(0),hasActivity=false;const lots:unknown[]=[],payables:string[]=[],receiptLines:unknown[]=[];
   if(act.lines.some(row=>!row.qty.greaterThan(0)||row.unitPrice.isNegative()||row.amount.isNegative()))throw new BadRequestException('Akt sətirlərində material miqdarı və məbləğ yoxlanmalıdır');
   for(const row of act.lines){
    const input=requested.get(row.id);if(!input||input.accepted.isZero()&&input.disputed.isZero())continue;
    const accepted=input.accepted,disputed=input.disputed,remaining=row.qty.minus(row.receivedQty||0).minus(row.closedQty||0);
    if(accepted.plus(disputed).greaterThan(remaining))throw new BadRequestException(`${row.materialName}: qəbul və mübahisəli miqdar sifariş qalığını aşır`);
    if(disputed.greaterThan(0)&&!input.disputeReason)throw new BadRequestException(`${row.materialName}: mübahisəli miqdar üçün səbəb yazın`);
    hasActivity=true;
    let replacement= new Prisma.Decimal(0);
    if(accepted.greaterThan(0)){
    const disputes=await tx.purchaseReceiptLine.findMany({where:{purchaseLineId:row.id,disputeStatus:'acıq',disputedQty:{gt:0},receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}},orderBy:{receipt:{createdAt:'asc'}}});
    let replacementLeft=accepted;
    for(const dispute of disputes){if(replacementLeft.isZero())break;const creditRequests=await tx.purchaseDisputeResolution.findMany({where:{organizationId:ctx.orgId,sourceReceiptLineId:dispute.id,kind:'credit',status:'pending'}}),reserved=creditRequests.reduce((n,item)=>n.plus(item.qty),new Prisma.Decimal(0)),open=Prisma.Decimal.max(0,dispute.disputedQty.minus(dispute.resolvedQty).minus(reserved));if(!open.greaterThan(0))continue;const resolve=Prisma.Decimal.min(open,replacementLeft);replacement=replacement.plus(resolve);replacementLeft=replacementLeft.minus(resolve);const resolved=dispute.resolvedQty.plus(resolve);await tx.purchaseReceiptLine.update({where:{id:dispute.id},data:{resolvedQty:resolved,disputeStatus:resolved.greaterThanOrEqualTo(dispute.disputedQty)?'hell':'acıq'}});}
    const billable=accepted.minus(replacement);
    let material=row.materialId?await tx.material.findFirst({where:{id:row.materialId,organizationId:ctx.orgId}}):await tx.material.findFirst({where:{name:row.materialName,unit:row.unit,organizationId:ctx.orgId}});
    if(row.materialId&&!material)throw new NotFoundException('Material tapılmadı');
    if(!material)material=await tx.material.create({data:{organizationId:ctx.orgId,name:row.materialName,unit:row.unit,qty:0,min:0,location:location.name,price:row.unitPrice}});
    await tx.stock.upsert({where:{materialId_locationId:{materialId:material.id,locationId}},update:{qty:{increment:accepted}},create:{organizationId:ctx.orgId,materialId:material.id,locationId,qty:accepted}});
    await tx.material.update({where:{id:material.id},data:{qty:{increment:accepted}}});
    await tx.purchaseActLine.update({where:{id:row.id},data:{materialId:material.id}});
    await tx.movement.create({data:{organizationId:ctx.orgId,materialId:material.id,material:material.name,locationId,type:'medaxil',qty:accepted,unit:row.unit,project:act.project,date:receivedAt.slice(0,10),by:user.name,from:`${act.number}:${receipt.id}`}});
    const lot=await tx.stockLot.create({data:{organizationId:ctx.orgId,materialId:material.id,locationId,code:material.id,batch:`${act.number}:${receipt.id}`,qty:accepted,unitCost:row.amount.div(row.qty),qr:`PA:${row.id}:${key}`}});lots.push({id:lot.id,materialId:material.id,locationId,qty:accepted.toString(),unit:row.unit});
    if(billable.greaterThan(0)){const alreadyPayable=row.payableQty||new Prisma.Decimal(0),previousDue=row.amount.mul(alreadyPayable).div(row.qty).toDecimalPlaces(2),cumulativeDue=row.amount.mul(alreadyPayable.plus(billable)).div(row.qty).toDecimalPlaces(2),lineAmount=cumulativeDue.minus(previousDue);const supplier=row.firmName||'Təchizatçı göstərilməyib';amounts.set(supplier,(amounts.get(supplier)||new Prisma.Decimal(0)).plus(lineAmount));net=net.plus(lineAmount);}
    if(accepted.greaterThan(0))await tx.purchaseActLine.update({where:{id:row.id},data:{receivedQty:{increment:accepted},payableQty:{increment:accepted.minus(replacement)}}});
    }
    const receiptLine=await tx.purchaseReceiptLine.create({data:{receiptId:receipt.id,purchaseLineId:row.id,acceptedQty:accepted,replacementQty:replacement,disputedQty:disputed,disputeStatus:disputed.greaterThan(0)?'acıq':'yoxdur',note:input.note,disputeReason:input.disputeReason}});receiptLines.push({id:receiptLine.id,purchaseActLineId:row.id,acceptedQty:accepted.toString(),replacementQty:replacement.toString(),disputedQty:disputed.toString(),disputeStatus:disputed.greaterThan(0)?'acıq':'yoxdur',disputeReason:input.disputeReason});
   }
   if(!hasActivity)throw new BadRequestException('Ən azı bir sətirdə qəbul və ya mübahisəli miqdar daxil edin');
   for(const [supplier,amount]of amounts){const payable=await tx.payable.create({data:{organizationId:ctx.orgId,supplier,poId:act.id,amount,status:'acik',date:receivedAt.slice(0,10)}});payables.push(payable.id);}
   const updatedLines=await tx.purchaseActLine.findMany({where:{actId:id}}),openDisputes=await tx.purchaseReceiptLine.count({where:{disputeStatus:'acıq',disputedQty:{gt:0},receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}}}),complete=updatedLines.every(line=>line.receivedQty.plus(line.closedQty).greaterThanOrEqualTo(line.qty))&&openDisputes===0,nextStatus=complete?'tesdiq':'qismən';
   await tx.purchaseAct.update({where:{id},data:{status:nextStatus}});
   await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:user.name,role:user.role,action:'Alış aktı qəbulu',detail:JSON.stringify({id,key,receiptId:receipt.id,locationId,before:act.status,after:nextStatus,net:net.toString(),lines:receiptLines})}});
   await tx.operationReceipt.create({data:{organizationId:ctx.orgId,accountId:ctx.accountId,key,requestHash:hash,command:'receive-purchase',changedBooks:{documentId:id,receiptId:receipt.id,lots,payables,receiptLines} as Prisma.InputJsonValue}});
   return {id,receiptId:receipt.id,status:nextStatus,replayed:false};
  },120000);
 }
 async returnF2(user:AuthUser,id:string,body:Record<string,unknown>){
  const ctx=await this.context(user);return this.transition(ctx,user,id,'return-f2',body,async tx=>{
   const act=await tx.act.findFirst({where:{id,organizationId:ctx.orgId},include:{lines:true}});if(!act)throw new NotFoundException('Forma-2 tapılmadı');
   if(act.status!=='tesdiq'||act.invoiceId||await tx.invoice.findFirst({where:{organizationId:ctx.orgId,actId:id,status:{not:'legv'}}}))throw new ConflictException('Yalnız fakturasız təsdiqlənmiş Forma-2 qaytarılır');
   if(await tx.forma3.findFirst({where:{organizationId:ctx.orgId,projectId:act.projectId,status:'tesdiq',period:{gte:act.period}}}))throw new ConflictException('Əvvəl bu həcmi daxil edən Forma-3-ü qaralamaya qaytarın');
   await tx.act.update({where:{id},data:{status:'qaralama'}});return {before:act,after:{status:'qaralama'}};
  });
 }
 async transitionF3(user:AuthUser,id:string,body:Record<string,unknown>,approve:boolean){
  const ctx=await this.context(user);return this.transition(ctx,user,id,approve?'approve-f3':'return-f3',body,async tx=>{
   const doc=await tx.forma3.findFirst({where:{id,organizationId:ctx.orgId},include:{lines:true}});if(!doc)throw new NotFoundException('Forma-3 tapılmadı');
   if(doc.status!==(approve?'qaralama':'tesdiq'))throw new ConflictException('Forma-3 statusu artıq dəyişib');
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(doc.period)||!doc.lines.length)throw new BadRequestException('Forma-3 dövrü və sətirləri yoxlanmalıdır');
   if(approve){
    const acts=await tx.act.findMany({where:{organizationId:ctx.orgId,projectId:doc.projectId,status:{in:['tesdiq','faktura']},period:{lte:doc.period}},include:{lines:true}});if(!acts.length)throw new BadRequestException('Təsdiqlənmiş Forma-2 yoxdur');
    const smeta=await tx.smeta.findFirst({where:{organizationId:ctx.orgId,projectId:doc.projectId},orderBy:{version:'desc'},include:{lines:true}});if(!smeta)throw new BadRequestException('Smeta tapılmadı');
    if(doc.kind==='yekun'&&(await tx.act.count({where:{organizationId:ctx.orgId,projectId:doc.projectId,status:'qaralama'}})||smeta.lines.some(l=>{const used=acts.flatMap(a=>a.lines).filter(r=>r.smetaLineId===l.id).reduce((n,r)=>n.plus(r.qty),new Prisma.Decimal(0));return used.lessThan(l.qty)})))throw new BadRequestException('Yekun Forma-3 üçün açıq həcm və qaralama olmamalıdır');
    const seen=new Set<string>();for(const line of doc.lines){
     const source=smeta.lines.find(l=>l.id===line.smetaLineId);if(!source||seen.has(source.id))throw new BadRequestException('Smeta sətri uyğun deyil');seen.add(source.id);
     const qty=(prior:boolean)=>acts.filter(a=>prior?a.period<doc.period:a.period===doc.period).flatMap(a=>a.lines).filter(l=>l.smetaLineId===source.id).reduce((n,l)=>n.plus(l.qty),new Prisma.Decimal(0));
     const prior=qty(true),period=qty(false),cumulative=prior.plus(period);
     const remain=Prisma.Decimal.max(0,source.qty.minus(cumulative));
     if(!line.priorValue.equals(prior.mul(source.unitPrice).toDecimalPlaces(2))||!line.periodValue.equals(period.mul(source.unitPrice).toDecimalPlaces(2))||!line.remainQty.equals(remain)||!line.remainValue.equals(remain.mul(source.unitPrice).toDecimalPlaces(2)))throw new BadRequestException('Forma-3 dövr və qalıq hesabı mənbə ilə uyğun deyil');
     if(!line.priorQty.equals(prior)||!line.periodQty.equals(period)||!line.cumulativeQty.equals(cumulative)||!line.smetaQty.equals(source.qty)||!line.smetaValue.equals(source.qty.mul(source.unitPrice).toDecimalPlaces(2))||!line.cumulativeValue.equals(cumulative.mul(source.unitPrice).toDecimalPlaces(2)))throw new BadRequestException('Forma-3 mənbə Forma-2/smeta ilə fərqlənir. Qaralamanı yeniləyin');
    }
    if(smeta.lines.some(l=>!seen.has(l.id)))throw new BadRequestException('Forma-3-də smeta sətirləri çatışmır');
    for(const field of ['smetaValue','priorValue','periodValue','cumulativeValue','remainValue'] as const){const sum=doc.lines.reduce((n,l)=>n.plus(l[field]),new Prisma.Decimal(0));if(!sum.toDecimalPlaces(2).equals(doc[field]))throw new BadRequestException('Forma-3 yekunu sətirlərlə uyğun deyil');}
    const contract=await tx.contract.findFirst({where:{organizationId:ctx.orgId,projectId:doc.projectId,number:doc.contractNumber}});if(!contract)throw new BadRequestException('Forma-3 üçün müqavilə və vergi dərəcəsi yoxlanmalıdır');
    const invoices=await tx.invoice.findMany({where:{organizationId:ctx.orgId,project:doc.project,actId:{not:null},status:{not:'legv'}}});const recovered=invoices.reduce((n,i)=>n.plus(i.advance||0),new Prisma.Decimal(0)),retention=doc.cumulativeValue.mul(contract.retentionPct).div(100).toDecimalPlaces(2),vat=doc.cumulativeValue.mul(contract.vat).toDecimalPlaces(2),advance=Prisma.Decimal.max(0,contract.value.mul(contract.advancePct).div(100).toDecimalPlaces(2).minus(recovered)),payable=Prisma.Decimal.max(0,doc.cumulativeValue.plus(vat).minus(recovered).minus(retention)).toDecimalPlaces(2);
    if(!doc.retention.equals(retention)||!doc.vat.equals(vat)||!doc.advanceBalance.equals(advance)||!doc.payable.equals(payable))throw new BadRequestException('Forma-3 maliyyə yekunu müqavilə və qaimələrlə uyğun deyil. Yeniləyin');
   }
   await tx.forma3.update({where:{id},data:{status:approve?'tesdiq':'qaralama'}});return {before:doc,after:{status:approve?'tesdiq':'qaralama'}};
  });
 }
 async purchaseReceipts(user:AuthUser,id:string){
  const ctx=await this.resolutionContext(user,(await this.tenant.load(user)).seat==='muhasib'?'finance':'warehouse'),act=await this.prisma.purchaseAct.findFirst({where:{id,organizationId:ctx.orgId},select:{id:true}});
  if(!act)throw new NotFoundException('Alış aktı tapılmadı');
  return this.prisma.purchaseReceipt.findMany({where:{organizationId:ctx.orgId,actId:id},include:{lines:{include:{purchaseLine:{select:{materialName:true,unit:true}}}}},orderBy:{createdAt:'asc'}});
 }
 private async resolutionContext(user:AuthUser,area:'warehouse'|'finance'){
  const ctx=await this.tenant.load(user);this.tenant.allow(ctx,area);return {...ctx,orgId:this.tenant.requireOrg(ctx)};
 }
 async purchaseDisputeResolutions(user:AuthUser,id:string){
  const ctx=await this.resolutionContext(user,(await this.tenant.load(user)).seat==='muhasib'?'finance':'warehouse');
  if(!await this.prisma.purchaseAct.findFirst({where:{id,organizationId:ctx.orgId},select:{id:true}}))throw new NotFoundException('Alış aktı tapılmadı');
  return this.prisma.purchaseDisputeResolution.findMany({where:{organizationId:ctx.orgId,actId:id},orderBy:{createdAt:'asc'}});
 }
 async purchaseSupplierReconciliation(user:AuthUser){
  const seat=(await this.tenant.load(user)).seat,ctx=await this.resolutionContext(user,seat==='muhasib'?'finance':'warehouse');
  const [acts,payables,resolutions]=await Promise.all([
   this.prisma.purchaseAct.findMany({where:{organizationId:ctx.orgId},include:{lines:true,receipts:{where:{reversedAt:null},include:{lines:true}}},orderBy:{date:'desc'}}),
   this.prisma.payable.findMany({where:{organizationId:ctx.orgId}}),
   this.prisma.purchaseDisputeResolution.findMany({where:{organizationId:ctx.orgId,kind:'credit'},select:{id:true,actId:true,purchaseLineId:true,qty:true,status:true,payableId:true}}),
  ]);
  const creditPayableById=new Map(resolutions.filter(row=>row.payableId).map(row=>[row.payableId!,row]));
  const result:Record<string,unknown>[]=[];
  for(const act of acts){
   const suppliers=[...new Set(act.lines.map(line=>(line.firmName||'Təchizatçı göstərilməyib').trim()))];
   for(const supplier of suppliers){
    const lines=act.lines.filter(line=>(line.firmName||'Təchizatçı göstərilməyib').trim()===supplier),lineIds=new Set(lines.map(line=>line.id));
    const openDisputed=act.receipts.flatMap(receipt=>receipt.lines).filter(line=>lineIds.has(line.purchaseLineId)&&line.disputeStatus==='acıq').reduce((sum,line)=>sum.plus(line.disputedQty.minus(line.resolvedQty)),new Prisma.Decimal(0));
    const pendingCreditQty=resolutions.filter(row=>row.actId===act.id&&lineIds.has(row.purchaseLineId)&&row.status==='pending').reduce((sum,row)=>sum.plus(row.qty),new Prisma.Decimal(0));
    const relevantPayables=payables.filter(row=>(row.poId===act.id&&row.supplier.trim()===supplier)||creditPayableById.get(row.id)?.actId===act.id&&lines.some(line=>line.id===creditPayableById.get(row.id)?.purchaseLineId));
    const openPayable=relevantPayables.filter(row=>row.status==='acik').reduce((sum,row)=>sum.plus(row.amount),new Prisma.Decimal(0));
    const orderedQty=lines.reduce((sum,line)=>sum.plus(line.qty),new Prisma.Decimal(0)),receivedQty=lines.reduce((sum,line)=>sum.plus(line.receivedQty),new Prisma.Decimal(0)),closedQty=lines.reduce((sum,line)=>sum.plus(line.closedQty),new Prisma.Decimal(0)),payableQty=lines.reduce((sum,line)=>sum.plus(line.payableQty),new Prisma.Decimal(0));
    const remainingQty=Prisma.Decimal.max(0,orderedQty.minus(receivedQty).minus(closedQty));
    const status=openDisputed.greaterThan(0)?'mübahisə açıq':remainingQty.greaterThan(0)?'miqdar açıq':openPayable.isNegative()?'kredit açıq':openPayable.greaterThan(0)?'borc açıq':'uzlaşıb';
    result.push({actId:act.id,actNumber:act.number,date:act.date,status,supplier,orderedQty:orderedQty.toNumber(),receivedQty:receivedQty.toNumber(),payableQty:payableQty.toNumber(),closedQty:closedQty.toNumber(),remainingQty:remainingQty.toNumber(),openDisputedQty:openDisputed.toNumber(),pendingCreditQty:pendingCreditQty.toNumber(),...(['director','procurement','accountant'].includes(user.role)?{netOpenPayable:openPayable.toNumber(),payableCount:relevantPayables.length}:{})});
   }
  }
  return {generatedAt:new Date().toISOString(),rows:result};
 }
 async requestPurchaseDisputeResolution(user:AuthUser,id:string,body:Record<string,unknown>){
  const ctx=await this.resolutionContext(user,'warehouse');
  if(!['direktor','satinalma'].includes(ctx.seat||''))throw new ForbiddenException('Təchizatçı qərarı üçün satınalma səlahiyyəti tələb olunur');
  const key=this.key(body.key),kind=String(body.kind||''),lineId=String(body.purchaseActLineId||''),sourceId=String(body.sourceReceiptLineId||''),reason=String(body.reason||'').trim(),qtyRaw=String(body.qty||'');
  if(!['credit','shortage-close'].includes(kind)||!reason||!/^\d+(?:\.\d{1,3})?$/.test(qtyRaw))throw new BadRequestException('Qərar növü, səbəb və miqdar tələb olunur');
  const qty=new Prisma.Decimal(qtyRaw);if(!qty.greaterThan(0))throw new BadRequestException('Miqdar sıfırdan böyük olmalıdır');
  if(kind==='credit'&&!sourceId)throw new BadRequestException('Kredit üçün mübahisəli qəbul sətri seçilməlidir');
  if(kind==='shortage-close'&&ctx.seat!=='direktor')throw new ForbiddenException('Qalıq miqdarın bağlanmasını yalnız rəhbər tələb edə bilər');
  const proofFileIds=Array.isArray(body.proofFileIds)?[...new Set(body.proofFileIds.map(String))]:[];
  if(kind==='credit'&&!proofFileIds.length)throw new BadRequestException('Təchizatçı krediti üçün təsdiqedici sənəd əlavə edin');
  if(proofFileIds.length&&await this.prisma.blobFile.count({where:{id:{in:proofFileIds},organizationId:ctx.orgId,kind:'commercial',scanStatus:'clean'}})!==proofFileIds.length)throw new BadRequestException('Təsdiqedici sənəd təşkilata aid deyil və ya yoxlamadan keçməyib');
  const request={actId:id,kind,lineId,sourceId,qty:qty.toString(),reason,proofFileIds};
  const hash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId:ctx.orgId,key}}});if(replay){if(replay.requestHash!==hash||replay.accountId!==ctx.accountId)throw new ConflictException('Əməliyyat açarı başqa sorğuya aiddir');return {id,replayed:true};}
   const [act,line]=await Promise.all([tx.purchaseAct.findFirst({where:{id,organizationId:ctx.orgId}}),tx.purchaseActLine.findFirst({where:{id:lineId,actId:id}})]);
   if(!act||!line)throw new NotFoundException('Alış aktı və ya material sətri tapılmadı');if(!['qismən','qaralama'].includes(act.status))throw new ConflictException('Alış aktı artıq bağlanıb');
   let sourceReceiptLineId:string|null=null;
   if(kind==='credit'){
    const source=await tx.purchaseReceiptLine.findFirst({where:{id:sourceId,purchaseLineId:line.id,disputeStatus:'acıq',receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}}});
    if(!source)throw new NotFoundException('Açıq mübahisə sətri tapılmadı');
    const pending=await tx.purchaseDisputeResolution.findMany({where:{organizationId:ctx.orgId,sourceReceiptLineId:sourceId,status:'pending'}}),reserved=pending.reduce((n,item)=>n.plus(item.qty),new Prisma.Decimal(0));
    if(qty.plus(source.resolvedQty).plus(reserved).greaterThan(source.disputedQty))throw new BadRequestException('Kredit miqdarı açıq mübahisə qalığını aşır');sourceReceiptLineId=source.id;
    if(await tx.purchaseDisputeResolution.findFirst({where:{organizationId:ctx.orgId,purchaseLineId:line.id,kind:'shortage-close',status:'pending'}}))throw new ConflictException('Eyni sətirdə qalıq bağlama sorğusu gözləyir');
   }else{
    const pending=await tx.purchaseDisputeResolution.findMany({where:{organizationId:ctx.orgId,purchaseLineId:line.id,status:'pending'}}),reserved=pending.reduce((n,item)=>n.plus(item.qty),new Prisma.Decimal(0)),remaining=line.qty.minus(line.receivedQty).minus(line.closedQty);
    if(pending.some(item=>item.kind==='credit'))throw new ConflictException('Eyni sətirdə təchizatçı krediti sorğusu gözləyir');
    if(qty.plus(reserved).greaterThan(remaining))throw new BadRequestException('Bağlanacaq miqdar sifariş qalığını aşır');
   }
   const resolution=await tx.purchaseDisputeResolution.create({data:{organizationId:ctx.orgId,actId:id,purchaseLineId:line.id,sourceReceiptLineId,kind,qty,reason,proofFileIds:proofFileIds as Prisma.InputJsonValue,status:'pending',requestedBy:user.name,requestedById:ctx.accountId,requestedAt:new Date().toISOString()}});
   await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:user.name,role:user.role,action:'Alış mübahisəsi qərar sorğusu',detail:JSON.stringify({id,key,resolutionId:resolution.id,...request})}});
   await tx.operationReceipt.create({data:{organizationId:ctx.orgId,accountId:ctx.accountId,key,requestHash:hash,command:'request-purchase-dispute-resolution',changedBooks:{documentId:id,resolutionId:resolution.id} as Prisma.InputJsonValue}});
   return {id,resolutionId:resolution.id,status:'pending',replayed:false};
  },120000);
 }
 async reviewPurchaseDisputeResolution(user:AuthUser,id:string,body:Record<string,unknown>){
  const resolutionId=String(body.resolutionId||''),decision=String(body.decision||''),reviewReason=String(body.reason||'').trim(),key=this.key(body.key);
  if(!resolutionId||!['approve','reject'].includes(decision))throw new BadRequestException('Qərar seçimi düzgün deyil');
  const ctx=await this.resolutionContext(user,'finance');
  if(!['direktor','muhasib'].includes(ctx.seat||''))throw new ForbiddenException('Maliyyə təsdiqi səlahiyyəti tələb olunur');
  const hash=createHash('sha256').update(JSON.stringify({id,resolutionId,decision,reviewReason})).digest('hex');
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId:ctx.orgId,key}}});if(replay){if(replay.requestHash!==hash||replay.accountId!==ctx.accountId)throw new ConflictException('Əməliyyat açarı başqa sorğuya aiddir');return {id,resolutionId,replayed:true};}
   const resolution=await tx.purchaseDisputeResolution.findFirst({where:{id:resolutionId,actId:id,organizationId:ctx.orgId,status:'pending'}});
   if(!resolution)throw new NotFoundException('Gözləyən qərar sorğusu tapılmadı');
   if(resolution.kind==='shortage-close'&&ctx.seat!=='direktor')throw new ForbiddenException('Qalıq miqdarın bağlanmasını yalnız rəhbər təsdiqləyə bilər');
   if(resolution.kind==='credit'&&!['direktor','muhasib'].includes(ctx.seat||''))throw new ForbiddenException('Təchizatçı krediti maliyyə təsdiqi tələb edir');
   const now=new Date().toISOString();let payableId:string|null=null;
   if(decision==='approve'){
    const line=await tx.purchaseActLine.findFirst({where:{id:resolution.purchaseLineId,actId:id}});if(!line)throw new NotFoundException('Alış aktı sətri tapılmadı');
    if(resolution.kind==='credit'){
     const source=resolution.sourceReceiptLineId?await tx.purchaseReceiptLine.findFirst({where:{id:resolution.sourceReceiptLineId,disputeStatus:'acıq',receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}}}):null;
     if(!source||source.resolvedQty.plus(resolution.qty).greaterThan(source.disputedQty))throw new ConflictException('Mübahisə qalığı dəyişib; qərarı yenidən yoxlayın');
     const amount=line.amount.mul(resolution.qty).div(line.qty).toDecimalPlaces(2),payable=await tx.payable.create({data:{organizationId:ctx.orgId,supplier:line.firmName||'Təchizatçı göstərilməyib',poId:`DISPUTE-CREDIT:${resolution.id}`,amount:amount.negated(),status:'acik',date:now.slice(0,10)}});payableId=payable.id;
     if(line.receivedQty.plus(line.closedQty).plus(resolution.qty).greaterThan(line.qty))throw new ConflictException('Kredit miqdarı sifarişin bağlanmamış qalığını aşır');
     const resolved=source.resolvedQty.plus(resolution.qty);await tx.purchaseReceiptLine.update({where:{id:source.id},data:{resolvedQty:resolved,disputeStatus:resolved.greaterThanOrEqualTo(source.disputedQty)?'hell':'acıq'}});
    }else{
     const otherPending=await tx.purchaseDisputeResolution.findMany({where:{organizationId:ctx.orgId,purchaseLineId:line.id,status:'pending',id:{not:resolution.id}}}),reserved=otherPending.reduce((n,item)=>n.plus(item.qty),new Prisma.Decimal(0));
     if(line.receivedQty.plus(line.closedQty).plus(reserved).plus(resolution.qty).greaterThan(line.qty))throw new ConflictException('Bağlanacaq qalıq miqdarı dəyişib');
     let toResolve=resolution.qty;const open=await tx.purchaseReceiptLine.findMany({where:{purchaseLineId:line.id,disputeStatus:'acıq',disputedQty:{gt:0},receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}},orderBy:{receipt:{createdAt:'asc'}}});
     for(const dispute of open){if(toResolve.isZero())break;const qty=Prisma.Decimal.min(toResolve,dispute.disputedQty.minus(dispute.resolvedQty));const resolved=dispute.resolvedQty.plus(qty);toResolve=toResolve.minus(qty);await tx.purchaseReceiptLine.update({where:{id:dispute.id},data:{resolvedQty:resolved,disputeStatus:resolved.greaterThanOrEqualTo(dispute.disputedQty)?'hell':'acıq'}});}
    }
    await tx.purchaseActLine.update({where:{id:line.id},data:{closedQty:{increment:resolution.qty}}});
   }
   await tx.purchaseDisputeResolution.update({where:{id:resolution.id},data:{status:decision==='approve'?'approved':'rejected',reviewedBy:user.name,reviewedById:ctx.accountId,reviewedAt:now,reviewReason,payableId}});
   const lines=await tx.purchaseActLine.findMany({where:{actId:id}}),openDisputes=await tx.purchaseReceiptLine.count({where:{disputeStatus:'acıq',disputedQty:{gt:0},receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}}}),complete=lines.every(line=>line.receivedQty.plus(line.closedQty).greaterThanOrEqualTo(line.qty))&&openDisputes===0;
   await tx.purchaseAct.update({where:{id},data:{status:complete?'tesdiq':'qismən'}});
   await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:now,actor:user.name,role:user.role,action:'Alış mübahisəsi qərar baxışı',detail:JSON.stringify({id,key,resolutionId,decision,reviewReason,payableId})}});
   await tx.operationReceipt.create({data:{organizationId:ctx.orgId,accountId:ctx.accountId,key,requestHash:hash,command:'review-purchase-dispute-resolution',changedBooks:{documentId:id,resolutionId,decision,payableId} as Prisma.InputJsonValue}});
   return {id,resolutionId,status:decision==='approve'?'approved':'rejected',payableId,replayed:false};
  },120000);
 }
 async reversePurchase(user:AuthUser,id:string,body:Record<string,unknown>){
  const ctx=await this.context(user,true);return this.transition(ctx,user,id,'return-purchase',body,async tx=>{
   const act=await tx.purchaseAct.findFirst({where:{id,organizationId:ctx.orgId},include:{lines:true,adjustments:true}});if(!act)throw new NotFoundException('Alış aktı tapılmadı');if(act.status!=='tesdiq')throw new ConflictException('Yalnız təsdiqlənmiş alış aktı qaytarılır');
   if(await tx.purchaseDisputeResolution.findFirst({where:{organizationId:ctx.orgId,actId:id,status:'approved',kind:{in:['credit','shortage-close']}}}))throw new ConflictException('Təsdiqlənmiş kredit və ya qalıq bağlama qərarını əvvəl maliyyə/akt uzlaşdırmasında həll edin');
   if(await tx.purchaseReceiptLine.findFirst({where:{replacementQty:{gt:0},receipt:{organizationId:ctx.orgId,actId:id,reversedAt:null}}}))throw new ConflictException('Əvəz malı olan qəbulu avtomatik ləğv etmək olmaz; mübahisə və stok uzlaşdırması tələb olunur');
   const postings=await tx.operationReceipt.findMany({where:{organizationId:ctx.orgId,command:'receive-purchase',changedBooks:{path:['documentId'],equals:id}},orderBy:{createdAt:'asc'}});
   if(!postings.length)throw new BadRequestException('Köhnə qəbulun partiya və borc əlaqələri yoxdur. Manual maliyyə uzlaşdırılması tələb olunur');
   const effects=postings.map(posting=>posting.changedBooks as unknown as {lots:{id:string;materialId:string;locationId:string;qty:string;unit:string}[];payables:string[];receiptId:string});
   const payableIds=effects.flatMap(effect=>effect.payables),allLots=effects.flatMap(effect=>effect.lots);
   const payables=await tx.payable.findMany({where:{organizationId:ctx.orgId,id:{in:payableIds}}});if(payables.length!==payableIds.length||payables.some(p=>p.status!=='acik'))throw new BadRequestException('Ödənilmiş və ya dəyişdirilmiş borcu əvvəl maliyyədə uzlaşdırın');
   for(const effect of allLots){const qty=new Prisma.Decimal(effect.qty),lot=await tx.stockLot.findFirst({where:{id:effect.id,organizationId:ctx.orgId}}),stock=await tx.stock.findFirst({where:{materialId:effect.materialId,locationId:effect.locationId,organizationId:ctx.orgId}}),material=await tx.material.findFirst({where:{id:effect.materialId,organizationId:ctx.orgId}});
    const reservations=await tx.stockReservation.findMany({where:{organizationId:ctx.orgId,materialId:effect.materialId,locationId:effect.locationId,status:'active'}}),transfers=await tx.shipmentLine.findMany({where:{materialId:effect.materialId,shipment:{organizationId:ctx.orgId,fromLocationId:effect.locationId,status:{in:['waiting_sender','sent']}}}}),reserved=reservations.reduce((sum,row)=>sum.plus(row.qty),new Prisma.Decimal(0)).plus(transfers.reduce((sum,row)=>sum.plus(row.qty),new Prisma.Decimal(0)));
    if(!lot||lot.qty.lessThan(qty)||!stock||stock.qty.minus(qty).lessThan(reserved)||!material||material.qty.lessThan(qty))throw new BadRequestException('Material artıq istifadə, rezerv və ya transferə ayrılıb; tam qaytarma üçün sərbəst qalıq çatmır');
    await tx.stockLot.update({where:{id:lot.id},data:{qty:{decrement:qty}}});await tx.stock.update({where:{id:stock.id},data:{qty:{decrement:qty}}});await tx.material.update({where:{id:material.id},data:{qty:{decrement:qty}}});
    await tx.movement.create({data:{organizationId:ctx.orgId,materialId:material.id,material:material.name,locationId:effect.locationId,type:'mexaric',qty,unit:effect.unit,project:act.project,date:new Date().toISOString().slice(0,10),by:user.name,from:`REVERSAL:${act.id}`}});
   }
   for(const payable of payables){await tx.payable.update({where:{id:payable.id},data:{status:'legv'}});await tx.payable.create({data:{organizationId:ctx.orgId,supplier:payable.supplier,poId:`REVERSAL:${payable.id}`,amount:payable.amount.negated(),status:'legv',date:new Date().toISOString().slice(0,10)}});}
   const reversedAt=new Date().toISOString(),reversalReason=String(body.reason||'').trim();
   await tx.purchaseReceipt.updateMany({where:{id:{in:effects.map(effect=>effect.receiptId)},organizationId:ctx.orgId,actId:id},data:{reversedAt,reversedBy:user.name,reversalReason}});
   await tx.purchaseActLine.updateMany({where:{actId:id},data:{receivedQty:0,payableQty:0,closedQty:0}});
   await tx.purchaseAct.update({where:{id},data:{status:'legv'}});return {before:act,after:{status:'legv'},receipts:effects.map(effect=>effect.receiptId),payables:payableIds,lots:allLots};
  });
 }
 async reverseInvoice(user:AuthUser,id:string,body:Record<string,unknown>){
  const ctx=await this.context(user);if(!['direktor','muhasib'].includes(ctx.seat||''))throw new ForbiddenException('Qaimə düzəlişi maliyyə səlahiyyəti tələb edir');
  return this.transition(ctx,user,id,'return-invoice',body,async tx=>{
   const invoice=await tx.invoice.findFirst({where:{id,organizationId:ctx.orgId}});if(!invoice)throw new NotFoundException('Qaimə tapılmadı');
   if(!['gonderilib','gecikir','qaralama'].includes(invoice.status)||invoice.amount.lessThanOrEqualTo(0))throw new BadRequestException('Ödənilmiş və ya ləğv edilmiş qaimə bu əməliyyatla qaytarılmır');
   if(await tx.closedPeriod.findFirst({where:{organizationId:ctx.orgId,value:invoice.issued.slice(0,7)}}))throw new BadRequestException('Qapalı maliyyə dövründə qaimə dəyişmir');
   await tx.invoice.update({where:{id},data:{status:'legv'}});
   const reversal=await tx.invoice.create({data:{organizationId:ctx.orgId,client:invoice.client,project:invoice.project,amount:invoice.amount.negated(),net:invoice.net?.negated(),vat:invoice.vat?.negated(),advance:invoice.advance?.negated(),retention:invoice.retention?.negated(),workNet:invoice.workNet?.negated(),issued:new Date().toISOString().slice(0,10),due:new Date().toISOString().slice(0,10),status:'legv',actId:invoice.actId}});
   if(invoice.actId)await tx.act.updateMany({where:{id:invoice.actId,organizationId:ctx.orgId,invoiceId:id},data:{status:'tesdiq',invoiceId:null}});
   return {before:invoice,reversal};
  });
 }
 private async transition(ctx:{orgId:string;accountId:string},user:AuthUser,id:string,command:string,body:Record<string,unknown>,work:(tx:Prisma.TransactionClient)=>Promise<unknown>){
  const key=this.key(body.key),reason=String(body.reason||'').trim();if(command.startsWith('return')&&!reason)throw new BadRequestException('Düzəliş səbəbini yazın');
  const hash=createHash('sha256').update(JSON.stringify({command,id,reason})).digest('hex');
  return serializable(this.prisma,async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId:ctx.orgId,key}}});if(replay){if(replay.requestHash!==hash||replay.accountId!==ctx.accountId)throw new ConflictException('Əməliyyat açarı başqa sorğuya aiddir');return {id,replayed:true};}
   const snapshot=await work(tx);await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:user.name,role:user.role,action:command,detail:JSON.stringify({id,key,reason,snapshot})}});await tx.operationReceipt.create({data:{organizationId:ctx.orgId,accountId:ctx.accountId,key,requestHash:hash,command,changedBooks:JSON.parse(JSON.stringify({documentId:id,reason,snapshot})) as Prisma.InputJsonValue}});return {id,replayed:false};
  },120000);
 }
}
