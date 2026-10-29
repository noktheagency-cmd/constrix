import {Prisma,PrismaClient} from '@prisma/client';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const p=new PrismaClient();
const delegates=[...readFileSync('src/records/resources.ts','utf8').matchAll(/delegate: '([^']+)'/g)].map(m=>m[1]);
const models=Prisma.dmmf.datamodel.models.filter(m=>delegates.includes(m.name[0].toLowerCase()+m.name.slice(1))||['Project','Client'].includes(m.name));
try{
 const organizations=new Set((await p.organization.findMany({select:{id:true}})).map(o=>o.id));
 const rows=[];
 for(const model of models){
  assert(model.fields.some(f=>f.name==='organizationId'),`${model.name}: missing tenant field`);
  const delegate=p[model.name[0].toLowerCase()+model.name.slice(1)];
  const grouped=await delegate.groupBy({by:['organizationId'],_count:{_all:true}});
  for(const group of grouped)if(group.organizationId!==null)assert(organizations.has(group.organizationId),`${model.name}: orphan organization`);
  rows.push({model:model.name,total:grouped.reduce((n,g)=>n+g._count._all,0),owned:grouped.filter(g=>g.organizationId!==null).reduce((n,g)=>n+g._count._all,0),hiddenWithoutOwner:grouped.find(g=>g.organizationId===null)?._count._all||0});
 }
 const result={verifiedAt:new Date().toISOString(),models:rows.length,readOnly:true,rows};
 writeFileSync('../docs/source-audit/tenant-verification.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({models:rows.length,owned:rows.reduce((n,r)=>n+r.owned,0),hiddenWithoutOwner:rows.reduce((n,r)=>n+r.hiddenWithoutOwner,0),orphanOrganizations:0}));
}finally{await p.$disconnect();}
