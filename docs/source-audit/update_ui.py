from pathlib import Path
root=Path(__file__).resolve().parents[2]
def edit(file, fn):
 p=root/file; s=p.read_text(encoding='utf-8'); p.write_text(fn(s),encoding='utf-8')
def purchase(s):
 s='import { SourceWorkbookViewer } from "../components/SourceWorkbookViewer"\n'+s
 s=s.replace('"aktlar" | "umumi" | "elave"','"aktlar" | "umumi" | "elave" | "source"')
 s=s.replace('{ id: "elave", label: "Əlavə" },','{ id: "elave", label: "Əlavə" },\n            { id: "source", label: "Excel mənbəsi" },')
 s=s.replace('      {tab === "aktlar" && (','      {tab === "source" && <SourceWorkbookViewer kind="purchase" />}\n      {tab === "aktlar" && (',1)
 s=s.replace('<th>Firma</th>','<th>Nağd ödəniş</th><th>Firma</th><th>Qeyd</th><th>Göndərən</th>',1)
 s=s.replace('<td>{item.firmName || "—"}</td>','<td className="num">{item.cashPaid == null ? "—" : money(item.cashPaid)}</td><td>{item.firmName || "—"}</td><td>{item.note || "—"}</td><td>{item.sender || "—"}</td>',1)
 s=s.replace('<th className="num">Fərq</th>','<th className="num">Dəyər</th><th className="num">Fərq</th>',1)
 s=s.replace('<td className="num">{num(item.diff, 4)}</td>','<td className="num">{money(item.amount)}</td><td className="num">{num(item.diff, 4)}</td>',1)
 s=s.replace('<span className="muted"> · {line.firmName || "firma yox"}', '<span className="muted"> · Nağd: {line.cashPaid == null ? "—" : money(line.cashPaid)} · {line.note || "Qeyd yoxdur"} · {line.firmName || "firma yox"}')
 return s
edit('src/pages/PurchaseActs.tsx',purchase)
def forma(s):
 s='import { SourceWorkbookViewer } from "../components/SourceWorkbookViewer"\n'+s
 s=s.replace('"hesablasma" | "faktura"','"hesablasma" | "faktura" | "source"')
 s=s.replace('{ id: "nakopitel", label: "Nakopitel" },','{ id: "nakopitel", label: "Nakopitel" },\n            { id: "source", label: "Excel mənbəsi" },')
 s=s.replace('      {tab === "nakopitel" && (','      {tab === "source" && <SourceWorkbookViewer kind="nakopitel" />}\n      {tab === "nakopitel" && (',1)
 s=s.replace('<th className="num">Əvvəlindən</th>\n                  <th className="num">Bu ay</th>\n                  <th className="num">Qalıq</th>','<th className="num">Əvvəlki miqdar</th><th className="num">Əvvəlki məbləğ</th><th className="num">Yığılan miqdar</th><th className="num">Yığılan məbləğ</th><th className="num">Bu ay miqdar</th><th className="num">Bu ay məbləğ</th><th className="num">Qalıq miqdar</th><th className="num">Qalıq məbləğ</th>')
 for field in ['prior','cumulative','period','remain']:
  needle='<td className="num">{row.kind === "work" || row.kind === "sectionTotal" ? money(row.'+field+'Value) : ""}</td>'
  replacement='<td className="num">{row.kind === "work" ? num(row.'+field+'Qty, 3) : ""}</td>'+needle
  if field=='prior':
   target='<td className="num">{row.kind === "work" || row.kind === "sectionTotal" ? money(row.cumulativeValue) : ""}</td>'
   s=s.replace(target,replacement+target,1)
  else:s=s.replace(needle,replacement,1)
 return s
edit('src/pages/Forma2.tsx',forma)
def platform(s):
 s='import { SourceWorkbookViewer } from "../components/SourceWorkbookViewer"\n'+s
 target='{id:"lines",label:"Həcm cədvəli"},{id:"costs",label:"Xərclər"},{id:"resources",label:"Resurslar"},{id:"settings",label:"Parametrlər"}'
 s=s.replace(target,target+',{id:"source",label:"Excel mənbəsi"}',1)
 marker='      {view === "lines" && ('
 s=s.replace(marker,'      {view === "source" && <SourceWorkbookViewer kind="boq" />}\n'+marker,1)
 return s
edit('src/pages/platform.tsx',platform)
