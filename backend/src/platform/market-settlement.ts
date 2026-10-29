import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type Tariff = {id:string;side:'buyer'|'supplier';scope:'contract'|'company'|'category'|'default';target:string;rate:string;basis:'net'|'gross';effectiveFrom:string;effectiveTo?:string|null};
export type TariffContext = {side:'buyer'|'supplier';companyId:string;category:string;contractId:string;acceptedAt:string};
const rank={contract:0,company:1,category:2,default:3};
export function chooseTariff(rules:Tariff[],context:TariffContext):Tariff|null{
 const matches=rules.filter(r=>r.side===context.side&&r.effectiveFrom<=context.acceptedAt&&(!r.effectiveTo||r.effectiveTo>=context.acceptedAt)&&({contract:r.target===context.contractId&&!!context.contractId,company:r.target===context.companyId,category:r.target===context.category&&!!context.category,default:r.target==='*'}[r.scope]));
 matches.sort((a,b)=>rank[a.scope]-rank[b.scope]||b.effectiveFrom.localeCompare(a.effectiveFrom));
 if(matches.length>1&&rank[matches[0].scope]===rank[matches[1].scope]&&matches[0].effectiveFrom===matches[1].effectiveFrom)throw new BadRequestException('Eyni prioritetdə üst-üstə düşən tarif var.');
 return matches[0]||null;
}
export function decimal(value:unknown,label:string,allowZero=true){
 try{const result=new Prisma.Decimal(String(value));if(!result.isFinite()||result.isNegative()||(!allowZero&&result.isZero()))throw new Error();return result;}catch{throw new BadRequestException(`${label} düzgün deyil`);}
}
export function settlementLine(input:{ordered:unknown;delivered:unknown;previousAccepted:unknown;previousDisputed:unknown;accepted:unknown;disputed:unknown;unitNet:unknown;vatRate:unknown}){
 const ordered=decimal(input.ordered,'Sifariş miqdarı',false),delivered=decimal(input.delivered,'Çatdırılan miqdar'),previous=decimal(input.previousAccepted,'Əvvəlki qəbul'),previousDisputed=decimal(input.previousDisputed,'Əvvəlki mübahisə'),accepted=decimal(input.accepted,'Qəbul'),disputed=decimal(input.disputed,'Mübahisə'),unit=decimal(input.unitNet,'Vahid qiymət'),vat=decimal(input.vatRate,'ƏDV dərəcəsi');
 if(vat.greaterThan(100))throw new BadRequestException('ƏDV 100%-dən çox ola bilməz');
 if(delivered.greaterThan(ordered)||accepted.plus(disputed).plus(previous).plus(previousDisputed).greaterThan(delivered))throw new BadRequestException('Qəbul və mübahisə çatdırılmış qalıq miqdarı aşır.');
 if(accepted.decimalPlaces()>3||disputed.decimalPlaces()>3)throw new BadRequestException('Miqdar ən çox 3 onluq işarə ola bilər');
 const net=accepted.mul(unit).toDecimalPlaces(2),gross=net.mul(new Prisma.Decimal(1).plus(vat.div(100))).toDecimalPlaces(2);
 return {accepted:accepted.toFixed(3),disputed:disputed.toFixed(3),net:net.toFixed(2),gross:gross.toFixed(2)};
}
export function commission(base:unknown,rate:unknown){const r=decimal(rate,'Komissiya faizi');if(r.greaterThan(100))throw new BadRequestException('Komissiya faizi 100%-dən çox ola bilməz');return decimal(base,'Baza').mul(r).div(100).toDecimalPlaces(2).toFixed(2);}
export function debtStage(input:{acceptedAt:string;amount:unknown;paid:unknown;today:string;dueDays:number;warnDays:number;restrictDays:number}){
 if(![input.dueDays,input.warnDays,input.restrictDays].every(n=>Number.isInteger(n)&&n>0)||input.dueDays>input.warnDays||input.warnDays>input.restrictDays)throw new BadRequestException('Borc müddətləri ardıcıl olmalıdır');
 const balance=decimal(input.amount,'Borc').minus(decimal(input.paid,'Ödəniş'));
 if(balance.isNegative())throw new BadRequestException('Ödəniş borcdan çoxdur');
 const age=Math.floor((Date.parse(input.today)-Date.parse(input.acceptedAt))/86400000);
 if(!Number.isFinite(age))throw new BadRequestException('Tarix düzgün deyil');
 return {balance:balance.toFixed(2),stage:balance.isZero()?'paid':age>=input.restrictDays?'restricted':age>=input.warnDays?'warning':age>=input.dueDays?'overdue':'due',age};
}
export function monthlyStatement(rows:{id:string;acceptedAt:string;amount:string;paid:string;dueAt:string}[],month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new BadRequestException('Ay düzgün deyil');
 const lines=rows.filter(row=>row.acceptedAt.slice(0,7)===month).map(row=>({...row,balance:decimal(row.amount,'Borc').minus(decimal(row.paid,'Ödəniş')).toFixed(2)}));
 return {month,lines,balance:lines.reduce((sum,line)=>sum.plus(line.balance),new Prisma.Decimal(0)).toFixed(2)};
}
