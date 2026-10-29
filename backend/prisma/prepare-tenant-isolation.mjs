import {Prisma} from '@prisma/client';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const resources=readFileSync('src/records/resources.ts','utf8');
const delegates=[...resources.matchAll(/delegate: '([^']+)'/g)].map(m=>m[1]);
const models=Prisma.dmmf.datamodel.models.filter(m=>delegates.includes(m.name[0].toLowerCase()+m.name.slice(1))||['Project','Client'].includes(m.name));
let schema=readFileSync('prisma/schema.prisma','utf8');
const sql=[];
for(const model of models){
 if(!model.fields.some(f=>f.name==='organizationId')){
  schema=schema.replace(`model ${model.name} {`,`model ${model.name} {\n  organizationId String?\n`);
  sql.push(`ALTER TABLE "${model.name}" ADD COLUMN "organizationId" TEXT;`);
 }
 sql.push(`CREATE INDEX IF NOT EXISTS "${model.name}_tenant_idx" ON "${model.name}"("organizationId");`);
}
for(const model of models){
 if(model.name==='Project')continue;
 if(model.fields.some(f=>f.name==='projectId'))sql.push(`UPDATE "${model.name}" r SET "organizationId"=p."organizationId" FROM "Project" p WHERE r."projectId"=p."id" AND r."organizationId" IS NULL AND p."organizationId" IS NOT NULL;`);
 sql.push(`UPDATE "${model.name}" SET "organizationId"='seed-org-afez' WHERE "organizationId" IS NULL AND "id" LIKE 'seed-%' AND EXISTS (SELECT 1 FROM "Organization" WHERE "id"='seed-org-afez');`);
}
writeFileSync('prisma/schema.prisma',schema);
mkdirSync('prisma/migrations/202610290002_legacy_tenant_isolation',{recursive:true});
writeFileSync('prisma/migrations/202610290002_legacy_tenant_isolation/migration.sql',sql.join('\n')+'\n');
console.log(JSON.stringify({models:models.map(m=>m.name),added:models.filter(m=>!m.fields.some(f=>f.name==='organizationId')).length}));
