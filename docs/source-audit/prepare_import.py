import json, re, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]; out=Path(__file__).parent
books=json.loads((out/'workbooks.json').read_text(encoding='utf-8'))
def rows(sheet):
 d={}
 for c in sheet['cells']:
  m=re.match(r'([A-Z]+)(\d+)',c['cell']); d.setdefault(int(m[2]),{})[m[1]]=c
 return d
def v(row,col):return row.get(col,{}).get('value')
def n(row,col):
 a=v(row,col); return float(a) if isinstance(a,(int,float)) else None
def t(row,col):return str(v(row,col) or '').strip()
def works(sheet):
 house=''; section=''; result=[]
 for idx,row in rows(sheet).items():
  name=t(row,'B')
  if 'yaşayış evi №' in name:house=name.split('№')[-1].strip()
  if name.startswith('Bölmə'):section=name
  kind='house' if 'yaşayış evi №' in name else 'section' if name.startswith('Bölmə') else 'work' if house and isinstance(v(row,'B'),str) and name and isinstance(v(row,'A'),(int,float)) and t(row,'C') and n(row,'D') is not None and n(row,'E') is not None else None
  if kind: result.append({'row':idx,'kind':kind,'houseNo':house,'section':section,'code':str(v(row,'A') or ''),'name':name,'unit':t(row,'C'),'qty':n(row,'D') or 0,'unitPrice':n(row,'E') or 0,'amount':n(row,'F')})
 return result
payload={'books':[],'purchases':[],'adjustments':[],'smeta':[],'acts':[],'boq':[],'costs':[],'issues':[]}
for index,b in enumerate(books):
 kind=['purchase','nakopitel','boq'][index]; sha=hashlib.sha256((root/b['file']).read_bytes()).hexdigest(); book={'id':'source-'+sha[:16],'file':b['file'],'sha256':sha,'kind':kind,'sheets':[]}
 for si,s in enumerate(b['sheets']):
  rs=rows(s); cols=sorted({re.match('[A-Z]+',c['cell'])[0] for c in s['cells']},key=lambda col:(len(col),col))
  archive=[]
  for ri,row in rs.items():
   archive.append({'number':ri,'cells':[{'column':col,'value':c['value'],**({'numericText':repr(c['value'])} if isinstance(c['value'],(int,float)) else {}),**({'formula':c['formula']} if c['formula'] else {})} for col,c in row.items()]})
  errors=[{'cell':c['cell'],'value':c['value'],'formula':c['formula']} for c in s['cells'] if isinstance(c['value'],str) and c['value'].startswith(('#REF!','#DIV/0!','#VALUE!','#N/A','#NAME?','#NUM!'))]
  payload['issues'].append({'file':b['file'],'sheet':s['name'],'errorCount':len(errors),'errors':errors})
  book['sheets'].append({'id':book['id']+'-'+str(si),'name':s['name'],'sort':si,'rowCount':len(rs),'cellCount':len(s['cells']),'columns':cols,'rows':archive})
  if kind=='purchase' and s['name'] not in ['Ümumi','Qaralama','Akta əlavə']:
   header=next((i for i,row in rs.items() if t(row,'B')=='Materialın adı'),None)
   if not header:continue
   lines=[]
   for ri,row in rs.items():
    if ri<=header or not t(row,'B') or not isinstance(v(row,'A'),(int,float)) or n(row,'D') is None:continue
    lines.append({'sourceRow':ri,'materialName':t(row,'B'),'unit':t(row,'C'),'qty':n(row,'D'),'unitPrice':n(row,'E') or 0,'amount':n(row,'F') if n(row,'F') is not None else (n(row,'D') or 0)*(n(row,'E') or 0),'cashPaid':n(row,'G'),'firmName':t(row,'H'),'note':t(row,'I'),'sender':t(row,'J')})
   dateMatch=re.match(r'(\d{2})\.(\d{2})\.(\d{2,4})',s['name']); date=(('20'+dateMatch[3]) if len(dateMatch[3])==2 else dateMatch[3])+'-'+dateMatch[2]+'-'+dateMatch[1] if dateMatch else ''
   payload['purchases'].append({'sheet':s['name'],'date':date,'dateLabel':t(rs.get(header-1,{}),'H'),'objectName':t(rs.get(header-1,{}),'C'),'person':t(rs.get(header-1,{}),'I'),'lines':lines})
  if kind=='purchase' and s['name']=='Akta əlavə':
   for ri,row in rs.items():
    if not t(row,'B') or n(row,'D') is None:continue
    payload['adjustments'].append({'row':ri,'materialName':t(row,'B'),'unit':t(row,'C'),'qty':n(row,'D'),'unitPrice':n(row,'E') or 0,'amount':n(row,'F') or 0,'diff':n(row,'G') or 0,'diffAmount':n(row,'H') or 0,'actLabel':t(row,'I')})
  if kind=='nakopitel' and s['name']=='60 ev':payload['smeta']=works(s)
  if kind=='nakopitel' and 'F2' in s['name']:
   payload['acts'].append({'sheet':s['name'],'client':t(rs.get(2,{}),'A').removeprefix('Sifarişçi:').strip(),'lines':works(s)})
  if kind=='boq' and s['name'] in ['1 - Direct_DK_BoQ','2 - Direct_MH_BoQ']:
   for ri,row in rs.items():
    if n(row,'G') is not None and t(row,'F') and t(row,'E'):
     payload['boq'].append({'row':ri,'sheet':s['name'],'name':t(row,'E'),'unit':t(row,'F'),'qty':n(row,'G'),'material':n(row,'J') or 0,'labor':n(row,'K') or 0,'laborOnly':'Yalnız işçilik' in t(row,'H')})
  if kind=='boq' and s['name'] in ['3 - Indirect','4 - Overhead']:
   for ri,row in rs.items():
    if ri>5 and t(row,'C') and n(row,'F') is not None:payload['costs'].append({'row':ri,'kind':'dolayi' if s['name']=='3 - Indirect' else 'ustelik','name':t(row,'B'),'amount':n(row,'F')})
 payload['books'].append(book)
(out/'import-payload.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
summary={'books':[{'file':b['file'],'sheets':len(b['sheets']),'cells':sum(s['cellCount'] for s in b['sheets'])} for b in payload['books']],'purchaseActs':len(payload['purchases']),'purchaseLines':sum(len(a['lines']) for a in payload['purchases']),'adjustments':len(payload['adjustments']),'smetaLines':len(payload['smeta']),'workLines':sum(l['kind']=='work' for l in payload['smeta']),'houses':len(set(l['houseNo'] for l in payload['smeta'] if l['houseNo'])),'acts':[{'sheet':a['sheet'],'lines':sum(l['kind']=='work' for l in a['lines'])} for a in payload['acts']],'boqLines':len(payload['boq']),'costs':len(payload['costs']),'errors':[{'sheet':x['sheet'],'count':x['errorCount'],'file':x['file']} for x in payload['issues'] if x['errorCount']]}
(out/'source-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(summary,ensure_ascii=True))
