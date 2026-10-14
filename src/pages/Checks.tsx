import { useEffect, useState } from "react"
import { ApiError, api } from "../api"
import { company } from "../data"
import { dateAZ } from "../format"
import { Icon } from "../icons"
import { Empty, Meter, PageHead, Select, Tabs, useTitle } from "../ui"
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
  if (tone === "clear") return "Təmiz"
  if (tone === "flag") return "Əlavə"
  return "Gözləyir"
}

export function ChecksPage() {
  useTitle("Yoxlama")
  const { cabinet } = useWorkspace()
  const [saved, setSaved] = useState<Inquiry[]>([])
  const [topic, setTopic] = useState("muflis")
  const [filter, setFilter] = useState("hamisi")
  const [form, setForm] = useState({ topic: "muflis", resultNote: "", document: "", asOf: "2026-10-14", legal: "aktiv" })
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    api<Inquiry[]>("/api/platform/official-checks")
      .then(setSaved)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Sorğular oxunmadı. Arxiv qeydləri açıqdır."))
  }, [])

  const firm = cabinet.name.trim() || company.name
  const place = cabinet.legalAddress.trim() || company.legal
  const book = [...saved, ...ARCHIVE.filter((item) => !saved.some((row) => row.id === item.id))]
  const fresh = latestOf(book, topic) ?? latestOf(book)
  const guide = topicOf(topic)
  const cards = TOPICS.map((item) => ({ ...item, row: latestOf(book, item.id) }))
  const clear = cards.filter((item) => item.row && toneOf(item.row.state) === "clear").length
  const waiting = cards.filter((item) => item.row && toneOf(item.row.state) === "wait").length
  const flagged = cards.filter((item) => item.row && toneOf(item.row.state) === "flag").length
  const shown = book
    .filter((row) => {
      if (filter === "alindi") return row.state === "alindi"
      if (filter === "gozle") return toneOf(row.state) === "wait"
      if (filter === "diqqet") return toneOf(row.state) === "flag"
      if (filter === "movzu") return row.topic === topic
      return true
    })
    .sort((a, b) => dayOf(b.asOf).localeCompare(dayOf(a.asOf)))

  function openTopic(id: string) {
    setTopic(id)
    setFilter("movzu")
    setForm((current) => ({ ...current, topic: id }))
    setNote("")
  }

  async function save() {
    if (!form.document.trim() || !form.asOf) {
      setNote("")
      setError("Sənəd adı və tarix yazılmalıdır. Məlumat şirkətin öz sənədindən götürülür.")
      return
    }
    const resultNote = form.topic === "qeydiyyat" ? `${form.legal === "legv" ? "Ləğv edilib" : "Aktivdir"}. ${form.resultNote}`.trim() : form.resultNote
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
      setTopic(form.topic)
      setForm((current) => ({ ...current, resultNote: "", document: "" }))
      setError("")
      setNote("Qeyd bazada saxlandı. Canlı reyestr sorğusu bağlanmayıb.")
    } catch (reason) {
      setNote("")
      setError(reason instanceof ApiError ? reason.message : "Qeyd saxlanmadı")
    }
  }

  const freshTone = fresh ? toneOf(fresh.state) : "wait"

  return (
    <div className="yoxlama">
      <PageHead
        kicker="Tender"
        title="Rəsmi yoxlama"
        text="SIMA, VÖEN, vergi, qeydiyyat, müflislik və satınalma qadağası şirkətin gətirdiyi sənədlə saxlanır. Xarici reyestrə avtomatik sorğu bağlanmayıb."
      />

      <div className="statstrip">
        <article>
          <span>Mövzu</span>
          <strong>{TOPICS.length}</strong>
          <em>{firm}</em>
        </article>
        <article>
          <span>Təmiz</span>
          <strong>{clear}</strong>
          <em>Son sənəd uyğundur</em>
        </article>
        <article>
          <span>Gözləyir</span>
          <strong>{waiting}</strong>
          <em className={waiting ? "warn" : undefined}>{waiting ? "Cavab hələ gəlməyib" : "Açıq sorğu yoxdur"}</em>
        </article>
        <article>
          <span>Əlavə</span>
          <strong>{flagged}</strong>
          <em className={flagged ? "warn" : undefined}>{flagged ? "Sənəd çatışmır və ya köhnəlib" : "Açıq uyğunsuzluq yoxdur"}</em>
        </article>
      </div>

      {fresh && guide && (
        <section className={`yox-now ${freshTone}`}>
          <div className="yox-now-top">
            <div className="yox-mark" aria-hidden="true">
              <Icon name="checks" />
            </div>
            <div>
              <p>{firm} · {place}</p>
              <h2>{guide.label}</h2>
              <span>{guide.ask}</span>
            </div>
            <div className="yox-score">
              <strong>{clear}/{TOPICS.length}</strong>
              <em>təmiz mövzu</em>
            </div>
          </div>
          <div className="yox-meters">
            <article><span>Son sənəd</span><strong>{fresh.document || "Sənəd yoxdur"}</strong></article>
            <article><span>Tarix</span><strong>{fresh.asOf ? dateAZ(dayOf(fresh.asOf)) : "Tarix yoxdur"}</strong></article>
            <article><span>Mənbə</span><strong>{fresh.source || "Mənbə yoxdur"}</strong></article>
            <article><span>Vəziyyət</span><strong>{STATE_LABEL[fresh.state] || fresh.state}</strong></article>
          </div>
          <p className={freshTone === "clear" ? "yox-ok" : "yox-alert"}>{fresh.resultNote || "Nəticə yazılmayıb."}</p>
          <Meter value={TOPICS.length ? (clear / TOPICS.length) * 100 : 0} tone="pine" />
        </section>
      )}

      <section className="yox-topics" aria-label="Yoxlama mövzuları">
        {cards.map((item) => {
          const tone = item.row ? toneOf(item.row.state) : "wait"
          return (
            <button
              type="button"
              key={item.id}
              className={`yox-topic ${tone}${item.id === topic ? " on" : ""}`}
              onClick={() => openTopic(item.id)}
              aria-pressed={item.id === topic}
            >
              <div className="yox-topic-top">
                <span className={`yox-pill ${tone}`}>{toneWord(tone)}</span>
                <b>{item.row ? dateAZ(dayOf(item.row.asOf)).split(" ").slice(0, 2).join(" ") : "—"}</b>
              </div>
              <strong>{item.label}</strong>
              <span>{item.paper}</span>
              <em>{item.row?.resultNote || "Bu mövzuda qeyd yoxdur."}</em>
            </button>
          )
        })}
      </section>

      <div className="yox-split">
        <section className="panel pad">
          <div className="panel-head">
            <h2>Nə yoxlanılır</h2>
          </div>
          <p className="lede">Hər mövzu bir sualdır. Son sənəd kartın rəngini verir.</p>
          {TOPICS.map((item) => (
            <div className="step-row" key={item.id}>
              <span>{item.label}</span>
              <strong>{item.paper}</strong>
            </div>
          ))}
        </section>

        <section className="panel pad">
          <div className="panel-head">
            <h2>Sənədi yaz</h2>
            <span className="muted">{guide?.label}</span>
          </div>
          <div className="form-row wide">
            <label>Mövzu
              <Select value={form.topic} onValueChange={(next) => { setForm({ ...form, topic: next }); setTopic(next) }} options={TOPICS.map((item) => ({ value: item.id, label: item.label }))} />
            </label>
            {form.topic === "qeydiyyat" && (
              <label>Hüquqi status
                <Select value={form.legal} onValueChange={(legal) => setForm({ ...form, legal })} options={[{ value: "aktiv", label: "Aktivdir" }, { value: "legv", label: "Ləğv edilib" }]} />
              </label>
            )}
            <label>Nəticə
              <input value={form.resultNote} onChange={(event) => setForm({ ...form, resultNote: event.target.value })} placeholder="məs. borc yoxdur" />
            </label>
            <label>Sənəd
              <input value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} placeholder="sənədin adı" />
            </label>
            <label>Tarix
              <input type="date" value={form.asOf} onChange={(event) => setForm({ ...form, asOf: event.target.value })} />
            </label>
            <button type="button" className="btn" onClick={() => void save()}>Bazaya yaz</button>
          </div>
          {error && <p className="form-error">{error}</p>}
          {note && <p className="lede">{note}</p>}
        </section>
      </div>

      <section className="panel pad">
        <div className="panel-head">
          <h2>Jurnal</h2>
          <span className="muted">{shown.length} qeyd</span>
        </div>
        <div className="toolbar">
          <Tabs
            value={filter}
            onChange={setFilter}
            options={[
              { id: "hamisi", label: "Hamısı" },
              { id: "movzu", label: "Bu mövzu" },
              { id: "alindi", label: "Alınıb" },
              { id: "gozle", label: "Gözləyir" },
              { id: "diqqet", label: "Əlavə" },
            ]}
          />
        </div>
        {shown.length === 0 ? (
          <Empty title="Bu süzgəcə düşən qeyd yoxdur" text="Başqa süzgəc və ya mövzu seçin. Arxiv qeydləri silinmir." />
        ) : (
          <div className="table-wrap flat">
            <table className="yox-table">
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>Mövzu</th>
                  <th>Sənəd</th>
                  <th>Mənbə</th>
                  <th>Nəticə</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const tone = toneOf(row.state)
                  return (
                    <tr key={row.id}>
                      <td>{row.asOf ? dateAZ(dayOf(row.asOf)) : "Tarix yoxdur"}</td>
                      <td>{topicOf(row.topic)?.label || row.topic}</td>
                      <td>
                        <div className="name-cell">
                          <b>{row.document || "Sənəd yoxdur"}</b>
                          <span className="muted">{row.id}</span>
                        </div>
                      </td>
                      <td>{row.source || "Mənbə yoxdur"}</td>
                      <td>
                        <div className="name-cell">
                          <span className={`yox-pill ${tone}`}>{STATE_LABEL[row.state] || row.state}</span>
                          <span className="yox-note">{row.resultNote}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
