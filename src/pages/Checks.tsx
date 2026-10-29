import { DataTable } from '../components/DataTable'
import { Button, Input, Panel, SearchInput, TableContainer, Textarea, Toolbar } from "../components/primitives"
import { useEffect, useState } from "react"
import { ApiError, api } from "../api"
import { company } from "../data"
import { dateAZ } from "../format"
import { Icon } from "../icons"
import { Empty, Modal, PageHead, Select, Tabs, useTitle } from "../ui"
import { useWorkspace } from "../workspace"

type Inquiry = {
  id: string
  topic: string
  state: string
  source: string
  resultNote: string
  document: string
  asOf: string | null
}

type Tone = "clear" | "wait" | "flag"

const TOPICS = [
  { id: "selahiyyet", label: "SIMA razılığı", ask: "İmza səlahiyyəti tenderə çıxış üçün açıqdırmı?", paper: "SIMA etibarnaməsi" },
  { id: "voen", label: "VÖEN statusu", ask: "VÖEN aktivdirmi və zona rezidentinə uyğundurmu?", paper: "Vergi uçotu arayışı" },
  { id: "vergi_borcu", label: "Vergi borcu", ask: "Büdcəyə borc varmı?", paper: "Vergi arayışı" },
  { id: "qeydiyyat", label: "Dövlət qeydiyyatı", ask: "Hüquqi şəxs aktivdirmi, ünvan və nizamnamə aktualdırmı?", paper: "Reyestr çıxarışı" },
  { id: "muflis", label: "Müflislik", ask: "Açıq müflislik və ya iddia işi varmı?", paper: "Məhkəmə arayışı" },
  { id: "satinalma", label: "Satınalma qadağası", ask: "Şirkət dövlət satınalmasında qadağa siyahısındadırmı?", paper: "Satınalma arayışı" },
]

const STATE_LABEL: Record<string, string> = {
  gonderilmeyib: "Göndərilməyib",
  gonderilib: "Göndərilib",
  gozlenir: "Gözlənilir",
  alindi: "Alınıb",
  elave: "Əlavə sənəd",
  texniki: "Texniki uyğunsuzluq",
}

const ARCHIVE: Inquiry[] = [
  { id: "YX-018", topic: "satinalma", state: "gozlenir", source: "Dövlət satınalma", resultNote: "Qadağa siyahısı üzrə cavab hələ gəlməyib.", document: "Sorğu SS-2026/19", asOf: "2026-10-12" },
  { id: "YX-008", topic: "qeydiyyat", state: "gonderilib", source: "Şirkətin sənədi", resultNote: "Nizamnamə dəyişikliyi reyestrə göndərilib, yeni çıxarış gözlənilir.", document: "Ərizə DQ-2026/07", asOf: "2026-10-11" },
  { id: "YX-017", topic: "vergi_borcu", state: "alindi", source: "Şirkətin sənədi", resultNote: "Borc yoxdur. Son ödəniş 2 oktyabr 2026-cı ildir.", document: "Vergi arayışı VG-8841", asOf: "2026-10-09" },
  { id: "YX-016", topic: "voen", state: "alindi", source: "Şirkətin sənədi", resultNote: "VÖEN 1403456711 aktivdir. Ələt AİZ rezidentidir.", document: "VÖEN çıxarışı", asOf: "2026-10-08" },
  { id: "YX-015", topic: "selahiyyet", state: "alindi", source: "SIMA sənədi", resultNote: "Nigar Əliyeva. Etibarnamə 30 noyabr 2026-dək qüvvədədir.", document: "SIMA ET-2026/14", asOf: "2026-10-02" },
  { id: "YX-014", topic: "muflis", state: "elave", source: "Şirkətin sənədi", resultNote: "Müflislik işi yoxdur. 2024-cü il iddiası üzrə əlavə arayış istənilib.", document: "Məhkəmə arayışı MK-331", asOf: "2026-09-28" },
  { id: "YX-013", topic: "qeydiyyat", state: "alindi", source: "Şirkətin sənədi", resultNote: "Aktivdir. Hüquqi ünvan Ələt Azad İqtisadi Zonasıdır.", document: "Çıxarış DQ-2024/118", asOf: "2026-09-18" },
  { id: "YX-012", topic: "selahiyyet", state: "texniki", source: "SIMA sənədi", resultNote: "Köhnə etibarnamənin müddəti bitib. Oktyabrda yenisi alınıb.", document: "SIMA ET-2025/03", asOf: "2026-08-30" },
  { id: "YX-011", topic: "vergi_borcu", state: "elave", source: "Şirkətin sənədi", resultNote: "Avqust arayışında ƏDV bəyannaməsi çatışmırdı. Sentyabrda bağlandı.", document: "Vergi arayışı VG-8610", asOf: "2026-08-14" },
  { id: "YX-010", topic: "satinalma", state: "alindi", source: "Dövlət satınalma", resultNote: "Qadağa siyahısında ad yoxdur.", document: "Arayış SS-2026/04", asOf: "2026-07-22" },
  { id: "YX-009", topic: "voen", state: "alindi", source: "Şirkətin sənədi", resultNote: "VÖEN aktivdir. Fəaliyyət kodu tikinti işləridir.", document: "VÖEN çıxarışı", asOf: "2026-06-11" },
  { id: "YX-007", topic: "muflis", state: "alindi", source: "Şirkətin sənədi", resultNote: "Açıq müflislik işi tapılmayıb.", document: "Məhkəmə arayışı MK-214", asOf: "2026-04-03" },
]

function dayOf(value: string | null) {
  return value ? String(value).slice(0, 10) : ""
}

function toneOf(state: string): Tone {
  if (state === "alindi") return "clear"
  if (state === "elave" || state === "texniki") return "flag"
  return "wait"
}

function topicOf(id: string) {
  return TOPICS.find((item) => item.id === id)
}

function latestOf(rows: Inquiry[], topic?: string) {
  const mine = topic ? rows.filter((item) => item.topic === topic) : rows
  return [...mine].sort((a, b) => dayOf(b.asOf).localeCompare(dayOf(a.asOf)))[0]
}

function toneWord(tone: Tone) {
  if (tone === "clear") return "Alınıb"
  if (tone === "flag") return "Diqqət tələb edir"
  return "Gözləyir"
}

export function ChecksPage() {
  useTitle("Yoxlama")
  const { cabinet } = useWorkspace()
  const [saved, setSaved] = useState<Inquiry[]>([])
  const [view, setView] = useState("topics")
  const [query, setQuery] = useState("")
  const [topicFilter, setTopicFilter] = useState("all")
  const [selected, setSelected] = useState<{ topic: string; row?: Inquiry } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [filter, setFilter] = useState("hamisi")
  const [form, setForm] = useState({ topic: "muflis", resultNote: "", document: "", asOf: "2026-10-14", legal: "aktiv" })
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    api<Inquiry[]>("/api/platform/official-checks")
      .then(setSaved)
      .catch((reason) => setLoadError(reason instanceof ApiError ? reason.message : "Sorğular oxunmadı."))
  }, [])

  const firm = cabinet.name.trim() || company.name
  const showDemo = typeof localStorage !== "undefined" && localStorage.getItem("afez.demo") === "1"
  const book = showDemo
    ? [...saved, ...ARCHIVE.filter((item) => !saved.some((row) => row.id === item.id))]
    : saved
  const cards = TOPICS.map((item) => ({ ...item, row: latestOf(book, item.id) }))
  const clear = cards.filter((item) => item.row && toneOf(item.row.state) === "clear").length
  const waiting = cards.filter((item) => item.row && toneOf(item.row.state) === "wait").length
  const flagged = cards.filter((item) => item.row && toneOf(item.row.state) === "flag").length
  const queryText = query.trim().toLocaleLowerCase("az")
  function matchesState(row?: Inquiry) {
    if (filter === "hamisi") return true
    if (filter === "none") return !row
    if (!row) return false
    return filter === "alindi" ? row.state === "alindi" : filter === "gozle" ? toneOf(row.state) === "wait" : toneOf(row.state) === "flag"
  }
  const shownTopics = cards.filter((item) => matchesState(item.row) && `${item.label} ${item.paper} ${item.row?.document || ""} ${item.row?.resultNote || ""}`.toLocaleLowerCase("az").includes(queryText))
  const shown = book
    .filter((row) => matchesState(row) && (topicFilter === "all" || row.topic === topicFilter) && `${topicOf(row.topic)?.label || row.topic} ${row.document} ${row.source} ${row.resultNote}`.toLocaleLowerCase("az").includes(queryText))
    .sort((a, b) => dayOf(b.asOf).localeCompare(dayOf(a.asOf)))

  function openForm(topic = "selahiyyet") {
    setForm((current) => ({ ...current, topic }))
    setSelected(null)
    setError("")
    setNote("")
    setFormOpen(true)
  }

  async function save() {
    if (saving) return
    if (!form.document.trim() || !form.asOf) {
      setNote("")
      setError("Sənəd adı və tarix yazılmalıdır. Məlumat şirkətin öz sənədindən götürülür.")
      return
    }
    const resultNote = form.topic === "qeydiyyat" ? `${form.legal === "legv" ? "Ləğv edilib" : "Aktivdir"}. ${form.resultNote}`.trim() : form.resultNote
    setSaving(true)
    try {
      const created = await api<Inquiry>("/api/platform/official-checks", {
        method: "POST",
        body: JSON.stringify({
          topic: form.topic,
          state: "alindi",
          source: form.topic === "selahiyyet" ? "SIMA sənədi" : form.topic === "satinalma" ? "Dövlət satınalma" : "Şirkətin sənədi",
          resultNote,
          document: form.document,
          asOf: form.asOf,
        }),
      })
      setSaved((current) => [created, ...current])
      setView("journal")
      setFilter("hamisi")
      setTopicFilter("all")
      setQuery("")
      setFormOpen(false)
      setForm((current) => ({ ...current, resultNote: "", document: "" }))
      setError("")
      setNote("Sənəd qeydi saxlanıldı.")
    } catch (reason) {
      setNote("")
      setError(reason instanceof ApiError ? reason.message : "Qeyd saxlanmadı")
    } finally {
      setSaving(false)
    }
  }

  const detailTopic = selected ? topicOf(selected.topic) : undefined
  const detailRow = selected?.row
  const filters = [{value:"hamisi",label:"Hamısı"},{value:"alindi",label:"Alınıb"},{value:"gozle",label:"Gözləyir"},{value:"diqqet",label:"Diqqət tələb edir"}, ...(view === "topics" ? [{value:"none",label:"Qeyd yoxdur"}] : [])]

  return (
    <div className="yoxlama checks-workspace">
      <PageHead title="Rəsmi yoxlama" text="Şirkətin yoxlama sənədlərini və son nəticələrini izləyin." ><Button className="primary" onClick={() => openForm()}><Icon name="plus" />Yeni sənəd qeydi</Button></PageHead>
      <Panel className="checks-summary" aria-label={`${firm} yoxlama xülasəsi`}>
        {[
          {label:"Mövzular",value:TOPICS.length,icon:"checks" as const,tone:"total"},
          {label:"Alınıb",value:clear,icon:"check" as const,tone:"clear"},
          {label:"Gözləyir",value:waiting,icon:"clock" as const,tone:"wait"},
          {label:"Diqqət tələb edir",value:flagged,icon:"checks" as const,tone:"flag"},
          {label:"Qeyd yoxdur",value:cards.filter((item) => !item.row).length,icon:"files" as const,tone:"none"},
        ].map((item) => <div className={`checks-summary-item ${item.tone}`} key={item.tone}><span className="checks-summary-icon"><Icon name={item.icon} /></span><div><span>{item.label}</span><strong>{item.value}</strong></div></div>)}
      </Panel>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {note && <p className="checks-notice" role="status">{note}</p>}
      <Tabs value={view} onChange={(next) => {setView(next); if(filter === "none") setFilter("hamisi")}} options={[{id:"topics",label:"Mövzular"},{id:"journal",label:`Jurnal · ${book.length}`}]} />
      <Toolbar className={`checks-toolbar ${view === "journal" ? "with-topics" : ""}`}>
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === "topics" ? "Mövzu axtar" : "Sənəd və ya nəticə axtar"} />
        {view === "journal" && <Select ariaLabel="Mövzu filtri" value={topicFilter} onValueChange={setTopicFilter} options={[{value:"all",label:"Bütün mövzular"},...TOPICS.map((item) => ({value:item.id,label:item.label}))]} />}
        <Select ariaLabel="Nəticə statusu" value={filter} onValueChange={setFilter} options={filters} />
      </Toolbar>
      {view === "topics" ? <TableContainer className="checks-table checks-topics-table"><DataTable><thead><tr><th>Mövzu</th><th>Son sənəd</th><th>Tarix</th><th>Status</th><th><span className="sr-only">Detala bax</span></th></tr></thead><tbody>
        {shownTopics.map((item) => <tr key={item.id} tabIndex={0} onClick={() => setSelected({topic:item.id,row:item.row})} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " ") {event.preventDefault();setSelected({topic:item.id,row:item.row})}}}>
          <td><strong>{item.label}</strong><small>{item.ask}</small></td><td>{item.row?.document || "Sənəd yoxdur"}<small>{item.paper}</small></td><td>{item.row?.asOf ? dateAZ(dayOf(item.row.asOf)) : "—"}</td><td><CheckStatus row={item.row} /></td><td><Icon name="chevron" /></td>
        </tr>)}
      </tbody></DataTable>{!shownTopics.length && <Empty title="Uyğun mövzu yoxdur" text="Axtarış və ya status filtrini dəyişin." />}</TableContainer> : <>
        <p className="checks-count">{shown.length} qeyd</p>
        <TableContainer className="checks-table checks-journal-table"><DataTable><thead><tr><th>Tarix</th><th>Mövzu</th><th>Sənəd və mənbə</th><th>Nəticə</th><th><span className="sr-only">Detala bax</span></th></tr></thead><tbody>{shown.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelected({topic:row.topic,row})} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " ") {event.preventDefault();setSelected({topic:row.topic,row})}}}>
          <td>{row.asOf ? dateAZ(dayOf(row.asOf)) : "—"}</td><td><strong>{topicOf(row.topic)?.label || row.topic}</strong><small>{row.id}</small></td><td>{row.document || "Sənəd yoxdur"}<small>{row.source || "Mənbə yoxdur"}</small></td><td><CheckStatus row={row} /><small className="checks-result-preview">{row.resultNote || "Nəticə yazılmayıb"}</small></td><td><Icon name="chevron" /></td>
        </tr>)}</tbody></DataTable>{!shown.length && <Empty title="Uyğun qeyd yoxdur" text="Başqa filtr seçin və ya yeni sənəd qeydi əlavə edin." />}</TableContainer>
      </>}
      <p className="checks-footnote">Məlumat şirkətin təqdim etdiyi sənədlərə əsaslanır. Xarici reyestrə avtomatik sorğu göndərilmir.</p>
      {selected && <Modal title={detailTopic?.label || selected.topic} className="checks-detail-modal" onClose={() => setSelected(null)}>
        <p className="checks-question">{detailTopic?.ask}</p>
        <div className={`checks-result ${detailRow ? toneOf(detailRow.state) : "none"}`}><Icon name={detailRow?.state === "alindi" ? "check" : "checks"} /><div><strong>Son nəticə: <CheckStatus row={detailRow} /></strong><p>{detailRow?.resultNote || (detailRow ? "Nəticə yazılmayıb." : "Bu mövzu üzrə sənəd qeydi yoxdur.")}</p></div></div>
        <dl className="checks-detail-fields"><div><dt>Sənəd</dt><dd>{detailRow?.document || detailTopic?.paper || "Sənəd yoxdur"}</dd></div><div><dt>Mənbə</dt><dd>{detailRow?.source || "—"}</dd></div><div><dt>Tarix</dt><dd>{detailRow?.asOf ? dateAZ(dayOf(detailRow.asOf)) : "—"}</dd></div></dl>
        <div className="checks-modal-actions"><Button className="primary" onClick={() => openForm(selected.topic)}><Icon name="plus" />Yeni sənəd qeydi</Button></div>
      </Modal>}
      {formOpen && <Modal title="Yeni sənəd qeydi" className="checks-form-modal" onClose={() => {if(!saving) setFormOpen(false)}}>
        <p className="lede">Sənədin məlumatlarını daxil edin.</p>
        <form onSubmit={(event) => {event.preventDefault(); void save()}}>
          <div className="checks-form-fields">
            <label>Mövzu<Select value={form.topic} onValueChange={(topic) => setForm((current) => ({...current,topic}))} options={TOPICS.map((item) => ({value:item.id,label:item.label}))} /></label>
            {form.topic === "qeydiyyat" && <label>Hüquqi status<Select value={form.legal} onValueChange={(legal) => setForm((current) => ({...current,legal}))} options={[{value:"aktiv",label:"Aktivdir"},{value:"legv",label:"Ləğv edilib"}]} /></label>}
            <label>Sənədin adı<Input required value={form.document} onChange={(event) => setForm({...form,document:event.target.value})} placeholder="Sənədin adı və ya nömrəsi" /></label>
            <label>Tarix<Input required type="date" value={form.asOf} onChange={(event) => setForm({...form,asOf:event.target.value})} /></label>
            <label className="checks-form-result">Nəticə<Textarea value={form.resultNote} onChange={(event) => setForm({...form,resultNote:event.target.value})} placeholder="Sənəddə göstərilən nəticə" rows={3} /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="checks-modal-actions"><Button disabled={saving} onClick={() => setFormOpen(false)}>Ləğv et</Button><Button className="primary" type="submit" disabled={saving}>{saving ? "Saxlanılır…" : "Qeydi saxla"}</Button></div>
        </form>
      </Modal>}
    </div>
  )
}

function CheckStatus({ row }: { row?: Inquiry }) {
  return <span className={`checks-status ${row ? toneOf(row.state) : "none"}`}>{row ? STATE_LABEL[row.state] || toneWord(toneOf(row.state)) : "Qeyd yoxdur"}</span>
}
