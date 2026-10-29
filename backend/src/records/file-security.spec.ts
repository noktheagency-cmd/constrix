import {inspectFile} from './file-security';
describe('uploaded document inspection',()=>{
 it('rejects executable content renamed as PDF',()=>{expect(()=>inspectFile('invoice.pdf',Buffer.from('MZ executable'))).toThrow();});
 it('rejects unsupported HTML and scripts',()=>{expect(()=>inspectFile('file.html',Buffer.from('<script>'))).toThrow();expect(()=>inspectFile('file.js',Buffer.from('alert(1)'))).toThrow();});
 it('rejects binary text and empty uploads',()=>{expect(()=>inspectFile('file.csv',Buffer.from([65,0,66]))).toThrow();expect(()=>inspectFile('file.txt',Buffer.alloc(0))).toThrow();});
 it('rejects a truncated Office archive',()=>{expect(()=>inspectFile('file.xlsx',Buffer.from('504b0304','hex'))).toThrow();});
 it('rejects files above 20 MB',()=>{expect(()=>inspectFile('file.txt',Buffer.alloc(20*1024*1024+1,65))).toThrow();});
 it('keeps a safe basename and verifies PDF magic',()=>{expect(inspectFile('folder/invoice.pdf',Buffer.from('%PDF-1.7\n')).name).toBe('invoice.pdf');});
});
