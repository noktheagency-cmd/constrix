import {PrismaClient} from '@prisma/client';
import {createHash} from 'node:crypto';
const p=new PrismaClient();let mapped=0;
try{
 const sources=await p.sourceWorkbook.findMany({where:{kind:'boq'},include:{sheets:true}});
 for(const source of sources)for(const sheet of source.sheets)for(const row of sheet.rows){
  const id='src-boq-'+createHash('sha256').update(`${sheet.name}|${row.number}`).digest('hex').slice(0,20);
  const result=await p.boqLine.updateMany({where:{id,sourceRow:null,sheet:sheet.name,book:{organizationId:source.organizationId}},data:{sourceRow:row.number}});mapped+=result.count;
 }
 console.log(JSON.stringify({mapped,changedPrices:0,changedApprovals:0}));
}finally{await p.$disconnect();}
