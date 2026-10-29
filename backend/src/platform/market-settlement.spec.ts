import {BadRequestException} from '@nestjs/common';
import {chooseTariff,commission,debtStage,monthlyStatement,settlementLine,Tariff} from './market-settlement';
describe('market receipt and two-party settlement rules',()=>{
 const context={side:'buyer' as const,companyId:'a',category:'cement',contractId:'c',acceptedAt:'2026-10-03'};
 const rule=(id:string,scope:Tariff['scope'],target:string,rate='1'):Tariff=>({id,scope,target,rate,side:'buyer',basis:'net',effectiveFrom:'2026-10-01'});
 it('uses approved contract/company/category/default priority, and never invents a rate',()=>{
  const rules=[rule('d','default','*'),rule('cat','category','cement'),rule('co','company','a'),rule('contract','contract','c')];
  expect(chooseTariff(rules,context)?.id).toBe('contract');expect(chooseTariff([],context)).toBeNull();expect(chooseTariff(rules,{...context,side:'supplier'})).toBeNull();
 });
 it('ignores future and expired rules and rejects equal-priority ambiguity',()=>{
  expect(chooseTariff([{...rule('x','default','*'),effectiveFrom:'2026-11-01'}],context)).toBeNull();
  expect(()=>chooseTariff([rule('x','default','*'),rule('y','default','*')],context)).toThrow(BadRequestException);
 });
 it('T-04: charges only 60 accepted of 100 ordered and delivered',()=>{
  const result=settlementLine({ordered:100,delivered:100,previousAccepted:0,previousDisputed:0,accepted:60,disputed:0,unitNet:10,vatRate:18});
  expect(result.net).toBe('600.00');expect(commission(result.net,'1')).toBe('6.00');expect(commission(result.net,'2')).toBe('12.00');
 });
 it('T-06: excludes disputed quantities, including reservations in later receipts',()=>{
  const result=settlementLine({ordered:100,delivered:100,previousAccepted:0,previousDisputed:0,accepted:95,disputed:5,unitNet:10,vatRate:0});expect(result.net).toBe('950.00');
  expect(()=>settlementLine({ordered:100,delivered:100,previousAccepted:95,previousDisputed:5,accepted:5,disputed:0,unitNet:10,vatRate:0})).toThrow();
 });
 it('T-07: seven/fifteen/thirty days, partial payment and restoration',()=>{
  const input={acceptedAt:'2026-10-01',amount:'100',paid:'20',dueDays:7,warnDays:15,restrictDays:30};
  expect(debtStage({...input,today:'2026-10-08'}).stage).toBe('overdue');expect(debtStage({...input,today:'2026-10-16'}).stage).toBe('warning');expect(debtStage({...input,today:'2026-10-31'}).stage).toBe('restricted');expect(debtStage({...input,paid:'100',today:'2026-10-31'}).stage).toBe('paid');
 });
 it('T-08: monthly statements retain original deadlines and exclude paid balance',()=>{
  const result=monthlyStatement([{id:'a',acceptedAt:'2026-10-03',amount:'100',paid:'100',dueAt:'2026-10-10'},{id:'b',acceptedAt:'2026-10-12',amount:'250',paid:'50',dueAt:'2026-10-19'}],'2026-10');expect(result.balance).toBe('200.00');expect(result.lines[0].dueAt).toBe('2026-10-10');
 });
 it('keeps Decimal rounding and rejects invalid amounts',()=>{expect(commission('0.30','10')).toBe('0.03');expect(()=>commission('10','-1')).toThrow();expect(()=>commission('10','NaN')).toThrow();});
});
