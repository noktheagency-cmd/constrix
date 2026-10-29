import {PrismaClient} from '@prisma/client';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const sourceUrl=new URL(process.env.DATABASE_URL),database=decodeURIComponent(sourceUrl.pathname.slice(1)),temporary=`afez_restore_qa_${randomUUID().replace(/-/g,'')}`;
assert(/^afez_restore_qa_[a-f0-9]{32}$/.test(temporary)&&temporary!==database);
const bin=process.platform==='win32'?'C:/Program Files/PostgreSQL/18/bin/':'';
const dumpTool=path.join(bin,process.platform==='win32'?'pg_dump.exe':'pg_dump'),restoreTool=path.join(bin,process.platform==='win32'?'pg_restore.exe':'pg_restore');
if(process.platform==='win32'&&(!existsSync(dumpTool)||!existsSync(restoreTool)))throw new Error('PostgreSQL backup tools not found');
const backupFolder=path.resolve('.local-backups');mkdirSync(backupFolder,{recursive:true});
const backupPath=path.join(backupFolder,`afez-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`);
const connection=['--host',sourceUrl.hostname,'--port',sourceUrl.port||'5432','--username',decodeURIComponent(sourceUrl.username)],environment={...process.env,PGPASSWORD:decodeURIComponent(sourceUrl.password)};
const base=new PrismaClient();let restored,created=false;
async function fingerprint(client){
 const tables=await client.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
 const result=[];for(const {tablename} of tables){assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(tablename));const [row]=await client.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) AS checksum FROM "public"."${tablename}" t`);result.push({table:tablename,...row});}return result;
}
try{
 const before=await base.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const [{snapshot}]=await tx.$queryRaw`SELECT pg_export_snapshot() AS snapshot`;const rows=await fingerprint(tx);
  execFileSync(dumpTool,[...connection,'--dbname',database,'--schema','public','--format','custom','--no-owner','--no-acl','--snapshot',snapshot,'--file',backupPath],{env:environment,stdio:'pipe',windowsHide:true,timeout:120000});return rows;
 },{isolationLevel:'RepeatableRead',timeout:180000});
 await base.$executeRawUnsafe(`CREATE DATABASE "${temporary}"`);created=true;
 execFileSync(restoreTool,[...connection,'--dbname',temporary,'--clean','--if-exists','--no-owner','--no-acl','--exit-on-error',backupPath],{env:environment,stdio:'pipe',windowsHide:true,timeout:180000});
 const targetUrl=new URL(sourceUrl);targetUrl.pathname=`/${temporary}`;restored=new PrismaClient({datasourceUrl:targetUrl.toString()});
 const after=await fingerprint(restored);assert.deepEqual(after,before,'Restored database content differs from the exported snapshot');
 const result={passed:true,checkedAt:new Date().toISOString(),backupPath,sha256:createHash('sha256').update(readFileSync(backupPath)).digest('hex'),tables:before.length,totalRows:before.reduce((n,r)=>n+r.count,0),checksums:before,restoredIntoTemporaryDatabase:true};
 writeFileSync('../docs/source-audit/backup-restore-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,tables:result.tables,totalRows:result.totalRows,backupPath}));
}finally{
 if(restored)await restored.$disconnect();
 if(created)await base.$executeRawUnsafe(`DROP DATABASE "${temporary}"`);
 await base.$disconnect();
}
