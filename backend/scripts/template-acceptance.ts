import {Prisma,PrismaClient} from '@prisma/client';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {PlatformService} from '../src/platform/platform.service';
import {PrismaService} from '../src/prisma/prisma.service';
import {TenantService,TenantCtx} from '../src/platform/tenant.service';
import {XlsxTemplate,worksheetPath} from '../src/platform/xlsx-template';
export async function verifyTemplateDb(db:PrismaClient,ctx:TenantCtx,other:TenantCtx,day:string){
 const original=readFileSync('../AZCDG-ARTM-STR-BOQ-0001-R01 ISCG.xlsx'),X=require('xlsx'),workbook=X.read(original,{type:'buffer'}),name='1 - Direct_DK_BoQ',row=11,sheet=workbook.Sheets[name];
 const source=await db.sourceWorkbook.create({data:{id:randomUUID(),organizationId:ctx.orgId!,name:'QA-template.xlsx',kind:'boq',sha256:createHash('sha256').update(original).digest('hex'),original:Uint8Array.from(original),sheets:{create:{id:randomUUID(),name,sort:0,rowCount:1,cellCount:3,columns:['E','F','G'],rows:[{number:row,cells:['E','F','G'].map(column=>({column,value:sheet[column+row].v}))}]}}}});
 const book=await db.boqBook.create({data:{organizationId:ctx.orgId!,lines:{create:{sourceRow:row,confirmed:true,pricedOn:day,source:'QA price review',sort:0,sheet:name,name:sheet.E11.v,unit:sheet.F11.v,qty:sheet.G11.v,material:12.5,labor:42}}},include:{lines:true}});
 const prisma=db as PrismaService,service=new PlatformService(prisma,new TenantService(prisma)),result=await service.sourcePrices(ctx,source.id,book.id),before=new XlsxTemplate(original),after=new XlsxTemplate(result.bytes),target=worksheetPath(before,name);
 assert.equal(result.rows,1);assert(after.text(target).includes('<v>12.50</v>'));assert(after.text(target).includes('<v>42.00</v>'));
 for(const member of before.names())if(![target,'xl/workbook.xml'].includes(member))assert(before.bytes(member).equals(after.bytes(member)));
 await assert.rejects(()=>service.sourcePrices(other,source.id,book.id));await db.boqLine.update({where:{id:book.lines[0].id},data:{confirmed:false}});await assert.rejects(()=>service.sourcePrices(ctx,source.id,book.id));
 assert.equal(createHash('sha256').update((await db.sourceWorkbook.findUniqueOrThrow({where:{id:source.id}})).original).digest('hex'),source.sha256);
 console.log('PASS template export uses reviewed DB prices, preserves original bytes and blocks foreign/unreviewed exports');return 'reviewed DB price export, original preservation and tenant isolation';
}
