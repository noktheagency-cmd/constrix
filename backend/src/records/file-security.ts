import {BadRequestException} from '@nestjs/common';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import os from 'node:os';

export function inspectFile(name:string,bytes:Buffer){
 const ext=path.extname(name).toLowerCase();if(!bytes.length||bytes.length>20*1024*1024)throw new BadRequestException('Fayl ölçüsü 1 bayt–20 MB olmalıdır');
 const mime:Record<string,string>={'.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain','.csv':'text/csv'};
 if(!mime[ext])throw new BadRequestException('Bu fayl formatı qəbul edilmir');
 const starts=(hex:string)=>bytes.subarray(0,hex.length/2).equals(Buffer.from(hex,'hex'));
 if(ext==='.pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||ext==='.png'&&!starts('89504e470d0a1a0a')||['.jpg','.jpeg'].includes(ext)&&!starts('ffd8ff')||ext==='.webp'&&!(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')||ext==='.xls'&&!starts('d0cf11e0a1b11e1'))throw new BadRequestException('Faylın məzmunu uzantısı ilə uyğun deyil');
 if(['.txt','.csv'].includes(ext)&&bytes.includes(0))throw new BadRequestException('Mətn faylı binar məzmun daşıyır');
 if(['.docx','.xlsx'].includes(ext)){
  if(!starts('504b0304'))throw new BadRequestException('Office faylı düzgün ZIP konteyneri deyil');
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw new BadRequestException('Office faylı zədələnib');const entries=bytes.readUInt16LE(end+10),offset=bytes.readUInt32LE(end+16);if(entries===65535||entries>5000)throw new BadRequestException('Office arxivi həddən böyükdür');let total=0,cursor=offset;const names=[];
  for(let n=0;n<entries;n++){
   if(cursor+46>bytes.length||bytes.readUInt32LE(cursor)!==0x02014b50)throw new BadRequestException('Office arxivi zədələnib');
   const compressed=bytes.readUInt32LE(cursor+20),uncompressed=bytes.readUInt32LE(cursor+24),length=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),name=bytes.subarray(cursor+46,cursor+46+length).toString('utf8');
   if(name.includes('..')||name.startsWith('/')||/vbaProject|\.exe$|\.dll$|\.js$|\.vbs$/i.test(name)||uncompressed>50*1024*1024||uncompressed>Math.max(1000000,compressed*200))throw new BadRequestException('Office faylında təhlükəli və ya həddən böyük hissə var');
   total+=uncompressed;if(total>150*1024*1024)throw new BadRequestException('Açılmış Office faylı həddi aşır');names.push(name);cursor+=46+length+extra+comment;
  }
  if(!names.includes(ext==='.docx'?'word/document.xml':'xl/workbook.xml'))throw new BadRequestException('Office faylının tipi düzgün deyil');
 }
 return {mime:mime[ext],name:path.basename(name).replace(/[\r\n]/g,'').slice(0,240)};
}

export async function scanFile(bytes:Buffer):Promise<{status:'clean'|'quarantined'|'rejected';note:string}>{
 const executable=process.platform==='win32'?path.join(process.env.ProgramFiles||'C:\\Program Files','Windows Defender','MpCmdRun.exe'):'';
 if(!executable||!existsSync(executable))return {status:'quarantined',note:'Antivirus mövcud deyil. Fayl açılmır və paylaşılmır.'};
 const folder=await mkdtemp(path.join(os.tmpdir(),'constrix-scan-'));const target=path.join(folder,'upload.bin');
 try{
  await writeFile(target,bytes);
  const code=await new Promise<number>(resolve=>{const child=spawn(executable,['-Scan','-ScanType','3','-File',target,'-DisableRemediation'],{windowsHide:true,stdio:'ignore'});const timer=setTimeout(()=>{child.kill();resolve(-1)},60000);child.on('error',()=>{clearTimeout(timer);resolve(-1)});child.on('exit',code=>{clearTimeout(timer);resolve(code??-1)});});
  return code===0?{status:'clean',note:'Windows Defender yoxlaması keçdi.'}:code===2?{status:'rejected',note:'Antivirus təhlükəli məzmun aşkarladı.'}:{status:'quarantined',note:'Antivirus yoxlaması tamamlanmadı. Fayl açılmır və paylaşılmır.'};
 }finally{await unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error});await rmdir(folder);}
}
