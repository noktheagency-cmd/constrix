import {readFileSync} from 'node:fs';
import path from 'node:path';
import {forceRecalculation,worksheetPath,writeNumericCell,XlsxTemplate,priceColumns,appendTechnicalAttributes} from './xlsx-template';
describe('original XLSX template preservation',()=>{
 const original=readFileSync(path.resolve(__dirname,'../../../AZCDG-ARTM-STR-BOQ-0001-R01 ISCG.xlsx'));
 it('round trips every original ZIP member without changing its contents',()=>{const before=new XlsxTemplate(original),after=new XlsxTemplate(before.write(new Map()));expect(after.names()).toEqual(before.names());for(const name of before.names())expect(after.text(name)).toBe(before.text(name));});
 it('changes only numeric prices and recalc flags while preserving formulas, styles, images and all other sheets',()=>{
  const before=new XlsxTemplate(original),sheet=worksheetPath(before,'1 - Direct_DK_BoQ'),xml=before.text(sheet),next=writeNumericCell(writeNumericCell(xml,'J11','12.50'),'K11','42.00');
  const result=new XlsxTemplate(before.write(new Map([[sheet,next],['xl/workbook.xml',forceRecalculation(before.text('xl/workbook.xml'))]])));
  expect(result.text(sheet)).toContain('<v>42.00</v>');expect(result.text(sheet)).toContain('(J11+K11)*G11');
  for(const name of before.names())if(![sheet,'xl/workbook.xml'].includes(name))expect(result.bytes(name).equals(before.bytes(name))).toBe(true);
 });
 it('refuses formula replacement and numeric formula injection',()=>{const before=new XlsxTemplate(original),xml=before.text(worksheetPath(before,'1 - Direct_DK_BoQ'));expect(()=>writeNumericCell(xml,'L11','100')).toThrow();expect(()=>writeNumericCell(xml,'J11','=HYPERLINK("x")')).toThrow();expect(()=>writeNumericCell(xml,'J0','1')).toThrow();});
 it('keeps existing iterative calculation settings',()=>{expect(forceRecalculation('<workbook><calcPr calcId="4" iterate="1" iterateCount="200"/></workbook>')).toContain('iterateCount="200"');});
 it('supports independent template mappings and rejects overlapping or out-of-range columns',()=>{
  expect(priceColumns({name:'a',unit:'b',qty:'c',material:'d',labor:'e'})).toEqual({name:'A',unit:'B',qty:'C',material:'D',labor:'E'});
  expect(()=>priceColumns({name:'A',unit:'A',qty:'C',material:'D',labor:'E'})).toThrow();
  expect(()=>priceColumns({name:'XFE',unit:'B',qty:'C',material:'D',labor:'E'})).toThrow();
 });
 it('appends literal technical attributes without moving original cells or executing text as formulas',()=>{
  const xml='<worksheet><dimension ref="A1:C2"/><sheetData><row r="1"><c r="A1"><v>1</v></c></row><row r="2"><c r="C2"><f>A2*2</f><v>4</v></c></row></sheetData></worksheet>';
  const result=appendTechnicalAttributes(xml,[{row:2,brand:'=HYPERLINK("private")',model:'A&B',manufacturer:'İstehsalçı',origin:'Azərbaycan'}],1);
  expect(result).toContain('<c r="C2"><f>A2*2</f><v>4</v></c>');expect(result).toContain('r="D1" t="inlineStr"');expect(result).toContain('A&amp;B');expect(result).not.toContain('<f>HYPERLINK');expect(result).not.toContain('<dimension');
  expect(()=>appendTechnicalAttributes(xml,[],7)).toThrow();
 });
});
