import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const payload = JSON.parse(readFileSync(path.join(root, 'docs/source-audit/import-payload.json'), 'utf8'));
const prisma = new PrismaClient();
const orgId = 'seed-org-afez';
const id = text => createHash('sha256').update(text).digest('hex').slice(0, 20);
const round = (n, digits=2) => Math.round(Number(n) * 10**digits) / 10**digits;
const chunkCreate = async (model, data) => { for (let i=0;i<data.length;i+=300) await model.createMany({data:data.slice(i,i+300),skipDuplicates:true}); };
const run = async () => {
  if (!await prisma.organization.findUnique({where:{id:orgId}})) throw new Error('Target organization not found');
  // All creates are additive and stable by source row. Existing operational records are never wiped.
  for (const book of payload.books) {
    const original = readFileSync(path.join(root,book.file));
    if (createHash('sha256').update(original).digest('hex') !== book.sha256) throw new Error('Source changed: '+book.file);
    await prisma.sourceWorkbook.upsert({where:{id:book.id},update:{},create:{id:book.id,organizationId:orgId,name:book.file,kind:book.kind,sha256:book.sha256,original}});
    for (const sheet of book.sheets) await prisma.sourceSheet.upsert({where:{id:sheet.id},update:{rows:sheet.rows},create:{...sheet,workbookId:book.id}});
  }
  const projectId='source-xocali-60'; const smetaId='source-xocali-smeta';
  // Correct the first parser's numeric column-number heading, only in our unapproved import.
  await prisma.actLine.deleteMany({where:{act:{projectId,status:'qaralama'},name:'2',unit:'3',code:'1',qty:4,smetaLineId:'src-sl-3'}});
  await prisma.smetaLine.deleteMany({where:{id:'src-sl-3',smetaId,name:'2',unit:'3',houseNo:'',qty:4}});
  const budget=round(payload.smeta.filter(l=>l.kind==='work').reduce((s,l)=>s+l.qty*l.unitPrice,0));
  await prisma.project.upsert({where:{id:projectId},update:{},create:{id:projectId,organizationId:orgId,name:'Xocalı · Təzəbinə · 60 ev (Excel)',clientName:'Xankəndi, Ağdərə və Xocalı Bərpa, Tikinti və İdarəetmə Xidməti',district:'Xocalı',city:'Xocalı',address:'Təzəbinə kəndi',phase:'Excel idxalı — yoxlama gözləyir',progress:0,budget,spent:0,start:'',end:'',manager:'',crew:0,status:'plan',type:'Yaşayış',floors:0,area:0,smetaId,note:'Mənbə: Nakopitel F2.xlsx. Təsdiq və faktiki anbar/maliyyə əməliyyatı yaradılmayıb.'}});
  await prisma.smeta.upsert({where:{id:smetaId},update:{},create:{id:smetaId,projectId,version:1,status:'qaralama'}});
  await prisma.project.updateMany({where:{id:projectId,status:'plan',spent:0},data:{budget}});
  const smetaLines=payload.smeta.map(l=>({id:'src-sl-'+l.row,smetaId,sort:l.row,code:l.code,name:l.name,unit:l.unit,qty:round(l.qty,3),unitPrice:round(l.unitPrice),doneQty:0,billedQty:0,laborHours:0,kind:l.kind,houseNo:l.houseNo,section:l.section}));
  await chunkCreate(prisma.smetaLine,smetaLines);
  const workMap=new Map(smetaLines.filter(l=>l.kind==='work').map(l=>[l.houseNo+'|'+l.code+'|'+l.name,l]));
  const unmatched=[];
  for (const source of payload.acts) {
    const actId='src-f2-'+id(source.sheet);
    const lines=source.lines.filter(l=>l.kind==='work').map(l=>{
      const match=workMap.get(l.houseNo+'|'+l.code+'|'+l.name);
      if (!match) unmatched.push({sheet:source.sheet,row:l.row,house:l.houseNo,code:l.code});
      return {id:actId+'-'+l.row,actId,sort:l.row,smetaLineId:match?.id||'source-unmatched-'+id(source.sheet+'|'+l.row),code:l.code,name:l.name,unit:l.unit,unitPrice:round(l.unitPrice),qty:round(l.qty,3),cumulativeQty:round(l.qty,3)};
    });
    const net=round(lines.reduce((s,l)=>s+l.qty*l.unitPrice,0));
    // Sheet names and in-document months disagree. Keep the source label; do not invent approval/date/VAT.
    await prisma.$transaction(async tx=>{
      const existing = await tx.act.findUnique({where:{id:actId},select:{status:true}});
      await tx.act.upsert({where:{id:actId},update:existing?.status === 'qaralama' ? {client:source.client,net,gross:net} : {},create:{id:actId,number:source.sheet.trim()+' · Excel',projectId,project:'Xocalı · Təzəbinə · 60 ev (Excel)',client:source.client,contractNumber:'96/25',period:'',date:'',net,vat:0,gross:net,status:'qaralama'}});
      for (let i=0;i<lines.length;i+=300) await tx.actLine.createMany({data:lines.slice(i,i+300),skipDuplicates:true});
    },{timeout:120000});
  }
  for (const source of payload.purchases) {
    const actId='src-pa-'+id(source.sheet);
    const lines=source.lines.map((l,sort)=>{const {sourceRow,...fields}=l;return {...fields,id:actId+'-'+sourceRow,sort};});
    await prisma.purchaseAct.upsert({where:{id:actId},update:{},create:{id:actId,number:'Excel · '+source.sheet,organizationId:orgId,projectId,project:'Xocalı · Təzəbinə · 60 ev (Excel)',objectName:source.objectName||'Xocalı evlər',person:source.person,date:source.date,status:'qaralama',net:round(lines.reduce((s,l)=>s+l.amount,0)),note:'alış aktı.xlsx / '+source.sheet+' · Mənbə tarix: '+source.dateLabel,lines:{create:lines}}});
  }
  await prisma.purchaseAct.upsert({where:{id:'src-pa-adjust'},update:{},create:{id:'src-pa-adjust',number:'Excel · Akta əlavə',organizationId:orgId,projectId,project:'Xocalı · Təzəbinə · 60 ev (Excel)',objectName:'Fortis Group · qiymət fərqləri',date:'',status:'qaralama',net:round(payload.adjustments.reduce((s,l)=>s+l.diffAmount,0)),note:'alış aktı.xlsx / Akta əlavə',adjustments:{create:payload.adjustments.map(({row,...l},sort)=>({...l,id:'src-adjust-'+row,sort}))}}});
  const boqId='source-azcdg-boq';
  await prisma.boqBook.upsert({where:{id:boqId},update:{},create:{id:boqId,organizationId:orgId,profit:0,vat:0,management:'AZCDG-ARTM-STR-BOQ-0001-R01 ISCG.xlsx — mənbə xətaları var, təsdiq tələb olunur',sheets:{create:payload.books[2].sheets.map((s,sort)=>({id:'src-boq-sheet-'+sort,sort,name:s.name}))},lines:{create:payload.boq.map((l,sort)=>{const {row,...fields}=l;return {...fields,id:'src-boq-'+id(l.sheet+'|'+row),sort}})},costs:{create:payload.costs.map((c,sort)=>({...c,id:'src-cost-'+sort,row:undefined,kind:c.kind==='dolayi'?'indirect':'overhead',sort}))}}});
  const counts={books:await prisma.sourceWorkbook.count({where:{organizationId:orgId}}),sheets:await prisma.sourceSheet.count({where:{workbook:{organizationId:orgId}}}),cells:payload.books.reduce((s,b)=>s+b.sheets.reduce((n,sheet)=>n+sheet.cellCount,0),0),purchaseActs:await prisma.purchaseAct.count({where:{id:{startsWith:'src-pa-'}}}),purchaseLines:await prisma.purchaseActLine.count({where:{actId:{startsWith:'src-pa-'}}}),adjustments:await prisma.purchaseActAdjust.count({where:{id:{startsWith:'src-adjust-'}}}),smetaLines:await prisma.smetaLine.count({where:{smetaId}}),actLines:await prisma.actLine.count({where:{actId:{startsWith:'src-f2-'}}}),boqLines:await prisma.boqLine.count({where:{bookId:boqId}}),unmatchedActLines:unmatched};
  writeFileSync(path.join(root,'docs/source-audit/import-result.json'),JSON.stringify(counts,null,2));
  console.log(JSON.stringify({...counts,unmatchedActLines:unmatched.length}));
};
try { await run(); } catch(e) { console.error(e.code||e.message); process.exitCode=1; } finally { await prisma.$disconnect(); }
