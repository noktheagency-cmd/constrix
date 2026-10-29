import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {XlsxTemplate,worksheetPath,writeNumericCell,forceRecalculation} from '../src/platform/xlsx-template';
const source=readFileSync('../AZCDG-ARTM-STR-BOQ-0001-R01 ISCG.xlsx'),before=new XlsxTemplate(source),sheet=worksheetPath(before,'1 - Direct_DK_BoQ');
const replacements=new Map([[sheet,writeNumericCell(writeNumericCell(before.text(sheet),'J11','12.50'),'K11','42.00')],['xl/workbook.xml',forceRecalculation(before.text('xl/workbook.xml'))]]),bytes=before.write(replacements),after=new XlsxTemplate(bytes);
assert.deepEqual(after.names(),before.names());let preserved=0;for(const name of before.names())if(!replacements.has(name)){assert(before.bytes(name).equals(after.bytes(name)),`Changed ZIP member: ${name}`);preserved++;}
mkdirSync('.local-backups',{recursive:true});writeFileSync('.local-backups/azcdg-template-roundtrip.xlsx',bytes);writeFileSync('../docs/source-audit/template-verification.json',JSON.stringify({passed:true,preservedMembers:preserved,changedMembers:[...replacements.keys()],output:'.local-backups/azcdg-template-roundtrip.xlsx',checkedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,preservedMembers:preserved,changedMembers:replacements.size}));
