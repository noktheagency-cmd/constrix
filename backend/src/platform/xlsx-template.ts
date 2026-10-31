import {BadRequestException} from '@nestjs/common';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
type Entry={name:string;central:Buffer;local:Buffer;header:Buffer;packed:Buffer;method:number;unpacked:number};
const crcTable=Array.from({length:256},(_,n)=>{for(let bit=0;bit<8;bit++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
const crc32=(bytes:Buffer)=>{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0};
/** Keep original ZIP members, styles, relationships and drawings; replace only named XML members. */
export class XlsxTemplate{
 private entries:Entry[]=[];private end:Buffer;
 constructor(private readonly original:Buffer){
  let eocd=-1;for(let i=original.length-22;i>=Math.max(0,original.length-65557);i--)if(original.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  if(eocd<0)throw new BadRequestException('Excel ZIP strukturu düzgün deyil');this.end=Buffer.from(original.subarray(eocd));
  const count=original.readUInt16LE(eocd+10);let cursor=original.readUInt32LE(eocd+16);if(count===65535||count>10000)throw new BadRequestException('ZIP64 və ya həddən böyük Excel dəstəklənmir');
  const offsets:number[]=[];for(let i=0;i<count;i++){
   if(cursor+46>eocd||original.readUInt32LE(cursor)!==0x02014b50)throw new BadRequestException('Excel arxivi zədələnib');
   const n=original.readUInt16LE(cursor+28),x=original.readUInt16LE(cursor+30),c=original.readUInt16LE(cursor+32),offset=original.readUInt32LE(cursor+42),size=original.readUInt32LE(cursor+20),unpacked=original.readUInt32LE(cursor+24),method=original.readUInt16LE(cursor+10);
   if(offset+30>original.length||original.readUInt32LE(offset)!==0x04034b50||![0,8].includes(method)||unpacked>200*1024*1024)throw new BadRequestException('Excel ZIP hissəsi düzgün deyil');
   const headerEnd=offset+30+original.readUInt16LE(offset+26)+original.readUInt16LE(offset+28);if(headerEnd+size>original.length)throw new BadRequestException('Excel ZIP ölçüsü düzgün deyil');
   const name=original.subarray(cursor+46,cursor+46+n).toString('utf8');if(name.includes('..')||name.startsWith('/'))throw new BadRequestException('Excel ZIP yolu düzgün deyil');
   this.entries.push({name,central:Buffer.from(original.subarray(cursor,cursor+46+n+x+c)),local:Buffer.alloc(0),header:Buffer.from(original.subarray(offset,headerEnd)),packed:original.subarray(headerEnd,headerEnd+size),method,unpacked});offsets.push(offset);cursor+=46+n+x+c;
  }
  const centralStart=original.readUInt32LE(eocd+16);this.entries.forEach((entry,i)=>{const next=Math.min(...offsets.filter(o=>o>offsets[i]),centralStart);entry.local=original.subarray(offsets[i],next)});
 }
 names(){return this.entries.map(e=>e.name)}
 bytes(name:string){const entry=this.entries.find(e=>e.name===name);if(!entry)throw new BadRequestException(`Excel hissəsi tapılmadı: ${name}`);return entry.method===0?entry.packed:inflateRawSync(entry.packed,{maxOutputLength:200*1024*1024})}
 text(name:string){return this.bytes(name).toString('utf8')}
 write(replacements:Map<string,string>){
  const chunks:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const entry of this.entries){const directory=Buffer.from(entry.central);let local=entry.local;
   if(replacements.has(entry.name)){const bytes=Buffer.from(replacements.get(entry.name)!),packed=deflateRawSync(bytes),header=Buffer.from(entry.header),crc=crc32(bytes);header.writeUInt16LE(header.readUInt16LE(6)&~8,6);header.writeUInt16LE(8,8);header.writeUInt32LE(crc,14);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(bytes.length,22);local=Buffer.concat([header,packed]);directory.writeUInt16LE(directory.readUInt16LE(8)&~8,8);directory.writeUInt16LE(8,10);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(packed.length,20);directory.writeUInt32LE(bytes.length,24);}
   directory.writeUInt32LE(offset,42);chunks.push(local);central.push(directory);offset+=local.length;
  }
  const directories=Buffer.concat(central),end=Buffer.from(this.end);end.writeUInt32LE(directories.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,directories,end]);
 }
}
const xmlDecode=(s:string)=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
export function worksheetPath(template:XlsxTemplate,sheetName:string){
 const workbook=template.text('xl/workbook.xml'),sheet=[...workbook.matchAll(/<sheet\b[^>]*>/g)].find(m=>xmlDecode(/\bname="([^"]+)"/.exec(m[0])?.[1]||'')===sheetName)?.[0],id=sheet&&/\br:id="([^"]+)"/.exec(sheet)?.[1];
 if(!id)throw new BadRequestException('Orijinal Excel vərəqi tapılmadı');const rel=[...template.text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].find(m=>/\bId="([^"]+)"/.exec(m[0])?.[1]===id)?.[0],target=rel&&/\bTarget="([^"]+)"/.exec(rel)?.[1];if(!target||target.includes('..'))throw new BadRequestException('Excel vərəq əlaqəsi düzgün deyil');return target.startsWith('/')?target.slice(1):`xl/${target}`;
}
export function writeNumericCell(xml:string,ref:string,value:string){
 if(!/^[A-Z]{1,3}[1-9]\d*$/.test(ref)||!/^\d+(\.\d+)?$/.test(value))throw new BadRequestException('Excel xanası və ya qiymət düzgün deyil');
 const pattern=new RegExp(`<c\\b(?=[^>]*\\br="${ref}")([^>]*?)(?:\\s*/>|>([\\s\\S]*?)</c>)`);const match=pattern.exec(xml);
 if(match){if(/<f\b/.test(match[2]||''))throw new BadRequestException(`${ref}: düstur olan xana dəyişdirilmir`);const attributes=match[1].replace(/\s+t="[^"]*"/g,'');return xml.replace(pattern,`<c${attributes}><v>${value}</v></c>`)}
 const rowNumber=ref.replace(/^[A-Z]+/,''),rowPattern=new RegExp(`(<row\\b(?=[^>]*\\br="${rowNumber}")[^>]*>)([\\s\\S]*?)(</row>)`),row=rowPattern.exec(xml);if(!row)throw new BadRequestException(`${ref}: mənbə sətri tapılmadı`);
 const index=(column:string)=>[...column].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),column=index(ref.replace(/\d+$/,''));let content=row[2],at=content.length;
 for(const cell of content.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"/g))if(index(cell[1])>column){at=cell.index!;break;}
 const style=/\bs="(\d+)"/.exec(content)?.[1];content=content.slice(0,at)+`<c r="${ref}"${style?` s="${style}"`:''}><v>${value}</v></c>`+content.slice(at);return xml.replace(rowPattern,`${row[1]}${content}${row[3]}`);
}
export function forceRecalculation(xml:string){const tag=/<calcPr\b[^>]*\/?\s*>/;return tag.test(xml)?xml.replace(tag,current=>current.replace(/\s+(calcId|fullCalcOnLoad|forceFullCalc)="[^"]*"/g,'').replace(/\/?\s*>$/,' calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/>')):xml.replace('</workbook>','<calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>')}

export type PriceColumns={name:string;unit:string;qty:string;material:string;labor:string};
export function priceColumns(input:unknown):PriceColumns{
 const defaults={name:'E',unit:'F',qty:'G',material:'J',labor:'K'};
 if(input===undefined)return defaults;
 if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Excel sütun xəritəsi düzgün deyil');
 const result={...defaults};for(const key of Object.keys(defaults) as (keyof PriceColumns)[]){const column=String((input as Record<string,unknown>)[key]||'').toUpperCase();if(!/^[A-Z]{1,3}$/.test(column)||columnNumber(column)>16384)throw new BadRequestException('Excel sütunu A–XFD aralığında olmalıdır');result[key]=column;}
 if(new Set(Object.values(result)).size!==5)throw new BadRequestException('Mənbə və qiymət sütunları fərqli olmalıdır');return result;
}
const columnNumber=(column:string)=>[...column].reduce((number,letter)=>number*26+letter.charCodeAt(0)-64,0);
function columnName(number:number){let name='';while(number>0){number--;name=String.fromCharCode(65+number%26)+name;number=Math.floor(number/26);}return name;}
function writeTextCell(xml:string,ref:string,value:string){
 if(value.length>32767||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new BadRequestException('Excel atribut mətni düzgün deyil');
 const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const row=ref.replace(/^[A-Z]+/,''),pattern=new RegExp(`(<row\\b(?=[^>]*\\br="${row}")[^>]*>)([\\s\\S]*?)(</row>)`);
 if(!pattern.test(xml))throw new BadRequestException('Atribut başlığı üçün mövcud Excel sətri seçin');
 return xml.replace(pattern,(_,start:string,content:string,end:string)=>`${start}${content}<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>${end}`);
}
export function appendTechnicalAttributes(xml:string,rows:{row:number;brand:string;model:string;manufacturer:string;origin:string}[],headerRow:number){
 if(!Number.isInteger(headerRow)||headerRow<1||rows.some(row=>row.row<=headerRow))throw new BadRequestException('Atribut başlığı məlumat sətirlərindən əvvəl olmalıdır');
 const refs=[...xml.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"/g)];let last=refs.reduce((max,match)=>Math.max(max,columnNumber(match[1])),0);
 if(last+4>16384)throw new BadRequestException('Yeni atribut sütunları üçün Excel həddi aşılır');
 const fields=[['brand','Marka'],['model','Model'],['manufacturer','İstehsalçı'],['origin','Mənşə ölkəsi']] as const;
 for(const [key,label]of fields){const column=columnName(++last);xml=writeTextCell(xml,`${column}${headerRow}`,label);for(const row of rows)xml=writeTextCell(xml,`${column}${row.row}`,row[key]);}
 // The old dimension can hide appended cells in readers; let Excel recompute it.
 return xml.replace(/<dimension\b[^>]*\/?\s*>/,'');
}
