import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const backend=path.join(root,'backend');
if(existsSync(path.join(backend,'.env')))process.loadEnvFile(path.join(backend,'.env'));
const apiPort=Number(process.env.PORT||3001),webPort=5173;
const children=[];
let stopping=false;
function stop(code=0){
 if(stopping)return;stopping=true;
 for(const child of children){
  if(child.exitCode!==null)continue;
  if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});
  else child.kill('SIGTERM');
 }
 setTimeout(()=>process.exit(code),500);
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
async function free(port,label){
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error(`${label}: invalid port ${port}`);
 await new Promise((resolve,reject)=>{const server=createServer();server.once('error',error=>reject(new Error(`${label} port ${port}: ${error.code}. Stop the existing server in its terminal with Ctrl+C, then run npm run dev.`)));server.listen(port,()=>server.close(resolve));});
}
function start(label,entry,args,cwd){
 const child=spawn(process.execPath,[entry,...args],{cwd,env:process.env,stdio:'inherit',windowsHide:true});children.push(child);
 child.once('error',error=>{console.error(`[${label}] ${error.message}`);stop(1);});
 child.once('exit',(code,signal)=>{if(!stopping){console.error(`[${label}] stopped (${signal||code}). Stopping both servers.`);stop(code||1);}});
 return child;
}
async function ready(url,label,timeout){
 const deadline=Date.now()+timeout;
 while(!stopping&&Date.now()<deadline){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(2000)});if(response.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw new Error(`${label} did not become ready. Check the error above.`);
}
try{
 await free(apiPort,'API');await free(webPort,'Web');
 const backendRequire=createRequire(path.join(backend,'package.json'));
 const {PrismaClient}=backendRequire('@prisma/client');const db=new PrismaClient();
 try{await db.$queryRaw`SELECT 1`;}finally{await db.$disconnect();}
 console.log('[AFEZ] Database connected. Starting API...');
 start('api',backendRequire.resolve('@nestjs/cli/bin/nest.js'),['start','--watch'],backend);
 await ready(`http://localhost:${apiPort}/api/health`,'API',120000);
 console.log(`[AFEZ] API ready on ${apiPort}. Starting frontend...`);
 const rootRequire=createRequire(path.join(root,'package.json'));
 start('web',path.join(path.dirname(rootRequire.resolve('vite/package.json')),'bin/vite.js'),[],root);
 await ready(`http://localhost:${webPort}/api/health`,'Frontend proxy',60000);
 console.log(`\n[AFEZ] READY: http://localhost:${webPort}\n[AFEZ] API + PostgreSQL + frontend proxy are healthy. Ctrl+C stops both servers.\n`);
}catch(error){console.error(`[AFEZ] Startup failed: ${error.message}`);stop(1);}
