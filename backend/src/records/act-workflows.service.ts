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
     const pile=piles.find(stock=>stock.locationId===site?.id&&stock.qty.greaterThanOrEqualTo(fuel))||piles.find(stock=>stock.locationId==='LOC-MERKEZ'&&stock.qty.greaterThanOrEqualTo(fuel));
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
  const ctx=await this.context(user,true),key=this.key(body.key),locationId=String(body.locationId||'');
  const hash=createHash('sha256').update(JSON.stringify({id,locationId})).digest('hex');
  return serializable(this.prisma,async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}))`;
   const replay=await tx.operationReceipt.findUnique({where:{organizationId_key:{organizationId:ctx.orgId,key}}});
   if(replay){if(replay.requestHash!==hash||replay.accountId!==ctx.accountId)throw new ConflictException('Əməliyyat açarı təkrarlanır');return {id,replayed:true};}
   const [act,location]=await Promise.all([tx.purchaseAct.findFirst({where:{id,organizationId:ctx.orgId},include:{lines:true,adjustments:true}}),tx.location.findFirst({where:{id:locationId,organizationId:ctx.orgId}})]);
   if(!act||!location)throw new NotFoundException('Akt və ya anbar tapılmadı');
   if(act.status!=='qaralama')throw new ConflictException('Akt artıq qəbul edilib');
   if(!act.date||!act.lines.length)throw new BadRequestException('Aktın tarixi və materialları yoxlanmalıdır');
   if(act.adjustments.length)throw new BadRequestException('Qiymət fərqi əlavəsini ayrıca maliyyə düzəlişi kimi yoxlayın');
   const amounts=new Map<string,Prisma.Decimal>();let net=new Prisma.Decimal(0);const lots:unknown[]=[],payables:string[]=[];
   for(const row of act.lines){
    if(!row.qty.greaterThan(0)||row.unitPrice.isNegative()||row.amount.isNegative())throw new BadRequestException('Material miqdarı və məbləği düzgün deyil');
    if(row.cashPaid?.greaterThan(0))throw new BadRequestException('Nağd ödənişi olan mənbə üçün ödəniş sənədi əvvəl maliyyədə uzlaşdırılmalıdır');
    let material=row.materialId?await tx.material.findFirst({where:{id:row.materialId,organizationId:ctx.orgId}}):await tx.material.findFirst({where:{name:row.materialName,unit:row.unit,organizationId:ctx.orgId}});
    if(row.materialId&&!material)throw new NotFoundException('Material tapılmadı');
    if(!material)material=await tx.material.create({data:{organizationId:ctx.orgId,name:row.materialName,unit:row.unit,qty:0,min:0,location:location.name,price:row.unitPrice}});
    await tx.stock.upsert({where:{materialId_locationId:{materialId:material.id,locationId}},update:{qty:{increment:row.qty}},create:{organizationId:ctx.orgId,materialId:material.id,locationId,qty:row.qty}});
    await tx.material.update({where:{id:material.id},data:{qty:{increment:row.qty}}});
    await tx.purchaseActLine.update({where:{id:row.id},data:{materialId:material.id}});
    await tx.movement.create({data:{organizationId:ctx.orgId,materialId:material.id,material:material.name,locationId,type:'medaxil',qty:row.qty,unit:row.unit,project:act.project,date:act.date,by:user.name,from:act.number}});
    const lot=await tx.stockLot.create({data:{organizationId:ctx.orgId,materialId:material.id,locationId,code:material.id,batch:act.number,qty:row.qty,unitCost:row.amount.div(row.qty),qr:`PA:${row.id}:${key}`}});lots.push({id:lot.id,materialId:material.id,locationId,qty:row.qty.toString(),unit:row.unit});
    const supplier=row.firmName||'Təchizatçı göstərilməyib';amounts.set(supplier,(amounts.get(supplier)||new Prisma.Decimal(0)).plus(row.amount));net=net.plus(row.amount);
   }
   if(!net.toDecimalPlaces(2).equals(act.net))throw new BadRequestException('Akt yekunu material sətirləri ilə uyğun deyil');
   for(const [supplier,amount]of amounts){const payable=await tx.payable.create({data:{organizationId:ctx.orgId,supplier,poId:act.id,amount,status:'acik',date:act.date}});payables.push(payable.id);}
   await tx.purchaseAct.update({where:{id},data:{status:'tesdiq'}});
   await tx.auditEntry.create({data:{organizationId:ctx.orgId,at:new Date().toISOString(),actor:user.name,role:user.role,action:'Alış aktı qəbulu',detail:JSON.stringify({id,key,locationId,before:'qaralama',after:'tesdiq',net:net.toString(),lines:act.lines.length})}});
   await tx.operationReceipt.create({data:{organizationId:ctx.orgId,accountId:ctx.accountId,key,requestHash:hash,command:'receive-purchase',changedBooks:{documentId:id,lots,payables,snapshot:JSON.parse(JSON.stringify(act))} as Prisma.InputJsonValue}});
   return {id,replayed:false};
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
 async reversePurchase(user:AuthUser,id:string,body:Record<string,unknown>){
  const ctx=await this.context(user,true);return this.transition(ctx,user,id,'return-purchase',body,async tx=>{
   const act=await tx.purchaseAct.findFirst({where:{id,organizationId:ctx.orgId},include:{lines:true,adjustments:true}});if(!act)throw new NotFoundException('Alış aktı tapılmadı');if(act.status!=='tesdiq')throw new ConflictException('Yalnız təsdiqlənmiş alış aktı qaytarılır');
   const posting=await tx.operationReceipt.findFirst({where:{organizationId:ctx.orgId,command:'receive-purchase',changedBooks:{path:['documentId'],equals:id}},orderBy:{createdAt:'desc'}});
   if(!posting)throw new BadRequestException('Köhnə qəbulun partiya və borc əlaqələri yoxdur. Manual maliyyə uzlaşdırılması tələb olunur');
   const effects=posting.changedBooks as unknown as {lots:{id:string;materialId:string;locationId:string;qty:string;unit:string}[];payables:string[]};
   const payables=await tx.payable.findMany({where:{organizationId:ctx.orgId,id:{in:effects.payables}}});if(payables.length!==effects.payables.length||payables.some(p=>p.status!=='acik'))throw new BadRequestException('Ödənilmiş və ya dəyişdirilmiş borcu əvvəl maliyyədə uzlaşdırın');
   for(const effect of effects.lots){const qty=new Prisma.Decimal(effect.qty),lot=await tx.stockLot.findFirst({where:{id:effect.id,organizationId:ctx.orgId}}),stock=await tx.stock.findFirst({where:{materialId:effect.materialId,locationId:effect.locationId,organizationId:ctx.orgId}}),material=await tx.material.findFirst({where:{id:effect.materialId,organizationId:ctx.orgId}});
    if(!lot||lot.qty.lessThan(qty)||!stock||stock.qty.lessThan(qty)||!material||material.qty.lessThan(qty))throw new BadRequestException('Material artıq istifadə edilib; tam qaytarma üçün qalıq çatmır');
    await tx.stockLot.update({where:{id:lot.id},data:{qty:{decrement:qty}}});await tx.stock.update({where:{id:stock.id},data:{qty:{decrement:qty}}});await tx.material.update({where:{id:material.id},data:{qty:{decrement:qty}}});
    await tx.movement.create({data:{organizationId:ctx.orgId,materialId:material.id,material:material.name,locationId:effect.locationId,type:'mexaric',qty,unit:effect.unit,project:act.project,date:new Date().toISOString().slice(0,10),by:user.name,from:`REVERSAL:${act.id}:${posting.key}`}});
   }
   for(const payable of payables){await tx.payable.update({where:{id:payable.id},data:{status:'legv'}});await tx.payable.create({data:{organizationId:ctx.orgId,supplier:payable.supplier,poId:`REVERSAL:${payable.id}`,amount:payable.amount.negated(),status:'legv',date:new Date().toISOString().slice(0,10)}});}
   await tx.purchaseAct.update({where:{id},data:{status:'qaralama'}});return {before:act,after:{status:'qaralama'},reversedPostingKey:posting.key,payables:effects.payables,lots:effects.lots};
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
