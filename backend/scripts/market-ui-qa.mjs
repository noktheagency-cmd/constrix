import {PrismaClient} from '@prisma/client';
import {readFileSync,unlinkSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const {schema}=JSON.parse(readFileSync('.local-backups/market-ui-schema.json','utf8'));
if(!/^market_qa_[a-f0-9]{32}$/.test(schema))throw new Error('Invalid isolated QA schema');
const sourceUrl=process.env.DATABASE_URL,url=new URL(sourceUrl);url.searchParams.set('schema',schema);
const backend=process.cwd(),root=path.resolve('..'),requireRoot=createRequire(path.join(root,'package.json'));
const environment={...process.env,DATABASE_URL:url.toString(),PORT:'3003',HOST:'127.0.0.1',FRONTEND_ORIGIN:'http://127.0.0.1:5174'};
const children=[];let stopping=false;
async function stop(){if(stopping)return;stopping=true;for(const child of children){if(process.platform==='win32')await new Promise(resolve=>{const kill=spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});kill.once('exit',resolve);kill.once('error',resolve)});else child.kill('SIGTERM');}const db=new PrismaClient({datasourceUrl:sourceUrl});try{await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);unlinkSync('.local-backups/market-ui-schema.json')}finally{await db.$disconnect();process.exit(0)}}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
const api=spawn(process.execPath,['dist/main.js'],{cwd:backend,env:environment,stdio:'inherit',windowsHide:true});children.push(api);
api.once('exit',()=>{if(!stopping)void stop()});
for(let attempt=0;attempt<60;attempt++){try{if((await fetch('http://127.0.0.1:3003/api/health')).ok)break}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
const web=spawn(process.execPath,[path.join(path.dirname(requireRoot.resolve('vite/package.json')),'bin/vite.js'),'--port','5174'],{cwd:root,env:environment,stdio:'inherit',windowsHide:true});children.push(web);web.once('exit',()=>{if(!stopping)void stop()});console.log('Isolated UI QA: http://127.0.0.1:5174/market (no application data changes)');
