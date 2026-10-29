import {PrismaClient} from '@prisma/client';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const payload=JSON.parse(readFileSync(path.join(root,'docs/source-audit/import-payload.json'),'utf8'));
const p=new PrismaClient();
const result={books:[],native:[],warnings:[]};
try{
 for(const book of payload.books){
  const stored=await p.sourceWorkbook.findUniqueOrThrow({where:{id:book.id}});
  assert.equal(createHash('sha256').update(stored.original).digest('hex'),book.sha256);
  for(const sheet of book.sheets){
   const target=await p.sourceSheet.findUniqueOrThrow({where:{id:sheet.id}});
   // Prisma JSON transport normalizes floating tails. Exact numeric source text is retained separately.
   const normalize=rows=>rows.map(r=>({...r,cells:r.cells.map(c=>({...c,value:c.numericText??c.value}))}));
   assert.deepEqual(normalize(target.rows),normalize(sheet.rows));assert.deepEqual(target.columns,sheet.columns);assert.equal(target.cellCount,sheet.cellCount);
  }
  result.books.push({file:book.file,sheets:book.sheets.length,cells:book.sheets.reduce((s,x)=>s+x.cellCount,0),originalSha256:book.sha256,allCellsMatch:true});
 }
 const hash=t=>createHash('sha256').update(t).digest('hex').slice(0,20);
 for(const source of payload.purchases){
  const act=await p.purchaseAct.findUniqueOrThrow({where:{id:'src-pa-'+hash(source.sheet)},include:{lines:{orderBy:{sort:'asc'}}}});
  assert.equal(act.lines.length,source.lines.length);
  for(const [i,line] of source.lines.entries()){
   const stored=act.lines[i];
   for(const key of ['materialName','unit','firmName','note','sender']) assert.equal(stored[key],line[key]);
   for(const [key,digits] of [['qty',3],['unitPrice',6],['amount',2],['cashPaid',2]]){
    if(line[key]==null)assert.equal(stored[key],null);else assert.ok(Math.abs(Number(stored[key])-line[key]) <= 0.50001*10**(-digits),source.sheet+' '+line.sourceRow+' '+key);
   }
  }
  assert.equal(act.status,'qaralama');
 }
 result.native.push({purchaseActs:payload.purchases.length,purchaseLines:payload.purchases.reduce((s,x)=>s+x.lines.length,0),allMappedFieldsMatch:true});
 const smeta=await p.smetaLine.findMany({where:{smetaId:'source-xocali-smeta'},orderBy:{sort:'asc'}});
 assert.equal(smeta.length,payload.smeta.length);
 for(const [i,line] of payload.smeta.entries())for(const key of ['name','unit','houseNo','section','kind'])assert.equal(smeta[i][key],line[key]);
 assert.equal(await p.actLine.count({where:{actId:{startsWith:'src-f2-'}}}),payload.acts.reduce((s,a)=>s+a.lines.filter(l=>l.kind==='work').length,0));
 result.native.push({smetaLines:smeta.length,workLines:payload.smeta.filter(l=>l.kind==='work').length,actLines:payload.acts.reduce((s,a)=>s+a.lines.filter(l=>l.kind==='work').length,0),boqLines:await p.boqLine.count({where:{bookId:'source-azcdg-boq'}}),costs:await p.boqCost.count({where:{bookId:'source-azcdg-boq'}})});
 result.warnings=payload.issues.filter(x=>x.errorCount).map(({file,sheet,errorCount})=>({file,sheet,errorCount}));
 result.passed=true;
 writeFileSync(path.join(root,'docs/source-audit/verification.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(e){console.error(e.message);process.exitCode=1;}finally{await p.$disconnect();}
