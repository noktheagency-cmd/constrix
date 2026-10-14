import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ApiError, api, dayInput, dec } from "../api"
import { DateField } from "../DateField"
import { dateAZ, hit, money } from "../format"
import { Icon } from "../icons"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Meter, Modal, PageHead, Select, Tabs, useTitle } from "../ui"

type Opening = {
  id: string
  profession: string
  minYears: unknown
  region: string
  note: string
  certificate?: string
  startOn?: string | null
}

type Proof = { id?: string; title: string; years: unknown; source: string; note: string; confirmed: boolean }

type Talent = {
  id: string
  name: string
  profession: string
  phone: string
  email?: string
  education?: string
  skills?: string
  regions: string
  state?: string
  expectPay?: unknown
  startOn?: string | null
  shareConsent: boolean
  proofs: Proof[]
}

type Fit = { person: Talent; years: number; score: number; reasons: string[] }

const SOURCES = [
  { value: "isegoturen", label: "İşəgötürən" },
  { value: "muqavile", label: "Müqavilə" },
  { value: "arayis", label: "Arayış" },
  { value: "diplom", label: "Diplom" },
  { value: "sertifikat", label: "Sertifikat" },
  { value: "el", label: "Əl ilə" },
]

const STATES = [
  { value: "elcatan", label: "Əlçatan" },
  { value: "axtarir", label: "Axtarır" },
  { value: "layihede", label: "Layihədə" },
  { value: "tesdiq", label: "Təsdiqlənib" },
  { value: "elcatmaz", label: "Əlçatmaz" },
]

const emptyVacancy = { profession: "", minYears: "", region: "", certificate: "", startOn: "2026-11-01", note: "" }
const emptyPerson = {
  name: "",
  profession: "",
  years: "",
  phone: "",
  email: "",
  regions: "",
  education: "",
  skills: "",
  expectPay: "",
  startOn: "2026-11-01",
  shareConsent: false,
  certificate: "",
  expires: "",
  source: "isegoturen",
  state: "elcatan",
}

function isoDay(value: unknown) {
  const text = String(value || "")
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] || dayInput(value)
}

function amount(value: unknown) {
  const number = Number(dec(value))
  return Number.isFinite(number) ? number : 0
}

function formatYears(value: number) {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${text} il`
}

function confirmedYears(proofs: Proof[]) {
  return proofs.reduce((sum, proof) => (proof.confirmed ? sum + amount(proof.years) : sum), 0)
}

function regionFits(opening: string, person: string) {
  const want = opening.trim().toLocaleLowerCase("az")
  const have = person.trim().toLocaleLowerCase("az")
  if (!want || !have) return true
  if (have.includes(want) || want.includes(have)) return true
  const skip = new Set(["və", "ve", "ilə", "ile"])
  return want.split(/[\s,./-]+/).some((word) => word.length > 2 && !skip.has(word) && have.includes(word))
}

function certificateFits(proofs: Proof[], certificate: string) {
  const needle = certificate.trim().toLocaleLowerCase("az")
  if (!needle) return true
  const today = new Date().toISOString().slice(0, 10)
  return proofs.some((proof) => {
    if (proof.source !== "sertifikat" || !proof.confirmed) return false
    if (!proof.title.toLocaleLowerCase("az").includes(needle)) return false
    const expiry = proof.note.trim()
    return !expiry || expiry >= today
  })
}

function matchOpening(person: Talent, opening: Opening): Fit | null {
  const profession = person.profession.trim().toLocaleLowerCase("az")
  const wanted = opening.profession.trim().toLocaleLowerCase("az")
  if (!profession || !wanted) return null
  const exact = profession === wanted
  if (!exact && !profession.includes(wanted) && !wanted.includes(profession)) return null
  const years = confirmedYears(person.proofs)
  const minimum = amount(opening.minYears)
  if (years + 0.001 < minimum) return null
  if (!regionFits(opening.region, person.regions)) return null
  if (!certificateFits(person.proofs, opening.certificate || "")) return null
  const reasons = [exact ? "Peşə uyğundur" : "Peşə yaxındır", `${formatYears(years)} təsdiqli staj`]
  if (opening.region.trim()) reasons.push(person.regions || opening.region)
  if ((opening.certificate || "").trim()) reasons.push(opening.certificate || "")
  const spare = Math.max(0, years - minimum)
  const score = Math.min(100, (exact ? 42 : 28) + Math.min(28, 12 + spare * 3) + (opening.region.trim() ? 18 : 8) + ((opening.certificate || "").trim() ? 12 : 6))
  return { person, years, score, reasons }
}

function markOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "NK"
  return words.slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("az")
}

function sourceLabel(source: string) {
  return SOURCES.find((item) => item.value === source)?.label || source
}

export function EmploymentPage() {
  useTitle("Məşğulluq")
  const store = useStore()
  const [openings, setOpenings] = useState<Opening[]>([])
  const [people, setPeople] = useState<Talent[]>([])
  const [tab, setTab] = useState("vakansiya")
  const [pick, setPick] = useState("")
  const [openId, setOpenId] = useState("")
  const [vacancyOpen, setVacancyOpen] = useState(false)
  const [personOpen, setPersonOpen] = useState(false)
  const [vacancy, setVacancy] = useState(emptyVacancy)
  const [person, setPerson] = useState(emptyPerson)
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null)
  const [ready, setReady] = useState(false)

  function reload() {
    return Promise.all([
      api<Opening[]>("/api/platform/openings"),
      api<Talent[]>("/api/platform/talent"),
    ]).then(([jobs, talents]) => {
      setOpenings(jobs)
      setPeople(talents)
      setPick((current) => current || jobs[0]?.id || "")
      setReady(true)
    })
  }

  useEffect(() => {
    reload().catch((reason) => {
      setReady(true)
      setNote({ text: reason instanceof ApiError ? reason.message : "Məşğulluq oxunmadı", bad: true })
    })
  }, [])

  const fits = useMemo(() => {
    const map = new Map<string, Fit[]>()
    for (const opening of openings) {
      const rows = people
        .map((item) => matchOpening(item, opening))
        .filter((item): item is Fit => item != null)
        .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name, "az"))
      map.set(opening.id, rows)
    }
    return map
  }, [openings, people])

  const shownOpenings = openings.filter((row) => hit(store.query, row.profession, row.region, row.note, row.certificate, row.minYears as string))
  const shownPeople = people.filter((row) => hit(store.query, row.name, row.profession, row.regions, row.phone, row.email, row.education, row.skills, row.proofs.map((proof) => proof.title).join(" ")))
  const selectedOpening = shownOpenings.find((row) => row.id === pick) || shownOpenings[0] || null
  const selectedFits = selectedOpening ? fits.get(selectedOpening.id) || [] : []
  const selectedPerson = people.find((row) => row.id === openId) || null
  const consent = people.filter((row) => row.shareConsent).length
  const average = people.length ? Math.round(people.reduce((sum, row) => sum + confirmedYears(row.proofs), 0) / people.length) : 0

  function openMatch(id: string) {
    setPick(id)
    setTab("uygun")
  }

  async function addVacancy(event: FormEvent) {
    event.preventDefault()
    if (!vacancy.profession.trim()) return
    try {
      await api("/api/platform/openings", { method: "POST", body: JSON.stringify(vacancy) })
      setVacancy(emptyVacancy)
      setVacancyOpen(false)
      await reload()
      setNote({ text: "Vakansiya bazada saxlandı." })
    } catch (reason) {
      setNote({ text: reason instanceof ApiError ? reason.message : "Vakansiya saxlanmadı", bad: true })
    }
  }

  async function addPerson(event: FormEvent) {
    event.preventDefault()
    if (!person.name.trim() || !person.profession.trim()) return
    try {
      const created = await api<{ id: string }>("/api/platform/talent", {
        method: "POST",
        body: JSON.stringify({
          name: person.name,
          profession: person.profession,
          phone: person.phone,
          email: person.email,
          regions: person.regions,
          education: person.education,
          skills: person.skills,
          expectPay: person.expectPay,
          startOn: person.startOn,
          shareConsent: person.shareConsent,
          state: person.state,
        }),
      })
      if (person.years.trim()) {
        await api(`/api/platform/talent/${created.id}/proofs`, {
          method: "POST",
          body: JSON.stringify({ source: person.source, title: "Staj qeydi", years: person.years, confirmed: true }),
        })
      }
      if (person.certificate.trim()) {
        await api(`/api/platform/talent/${created.id}/proofs`, {
          method: "POST",
          body: JSON.stringify({ source: "sertifikat", title: person.certificate, years: 0, confirmed: true, note: person.expires }),
        })
      }
      setPerson(emptyPerson)
      setPersonOpen(false)
      await reload()
      setNote({ text: "Namizəd bazada saxlandı." })
    } catch (reason) {
      setNote({ text: reason instanceof ApiError ? reason.message : "Namizəd saxlanmadı", bad: true })
    }
  }

  return (
    <div className="mesgulluq">
      <PageHead kicker="Kadr" title="Məşğulluq" text="Vakansiya peşə, staj, region və sertifikata görə namizədlə tutuşdurulur. Başqa şirkətin profili yalnız əlaqə razılığı ilə görünür.">
        <button type="button" className="btn ghost" onClick={() => { setNote(null); setPersonOpen(true) }}><Icon name="plus" /> Namizəd</button>
        <button type="button" className="btn" onClick={() => { setNote(null); setVacancyOpen(true) }}><Icon name="plus" /> Vakansiya</button>
      </PageHead>

      <section className="statstrip">
        <article>
          <span>Vakansiya</span>
          <strong>{ready ? openings.length : "…"}</strong>
          <em>Açıq yer</em>
        </article>
        <article>
          <span>Namizəd</span>
          <strong>{ready ? people.length : "…"}</strong>
          <em>Şirkət bazası</em>
        </article>
        <article>
          <span>Razılıq</span>
          <strong>{ready ? consent : "…"}</strong>
          <em>Əlaqə açıqdır</em>
        </article>
        <article>
          <span>Orta staj</span>
          <strong>{ready ? average : "…"}</strong>
          <em>Təsdiqli il</em>
        </article>
      </section>

      {note && <p className={note.bad ? "form-error" : "form-note"}>{note.text}</p>}

      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "vakansiya", label: "Vakansiyalar" },
            { id: "namized", label: "Namizədlər" },
            { id: "uygun", label: "Uyğunlaşdırma" },
          ]}
        />
        <span className="muted">
          {tab === "namized" ? `${shownPeople.length} profil` : tab === "uygun" ? `${selectedFits.length} uyğun` : `${shownOpenings.length} vakansiya`}
        </span>
      </div>

      {tab === "vakansiya" && (
        shownOpenings.length === 0 ? (
          <Empty title={ready ? "Vakansiya yoxdur" : "Oxunur"} text={ready ? "Peşə, region və minimum staj yazın." : "Məşğulluq bazası açılır."} />
        ) : (
          <div className="job-grid">
            {shownOpenings.map((row) => {
              const matches = fits.get(row.id) || []
              return (
                <article className="job-card" key={row.id}>
                  <header className="job-card-head">
                    <div>
                      <h3>{row.profession}</h3>
                      <p>{row.region || "Region açıqdır"}</p>
                    </div>
                    <span className="job-years">{formatYears(amount(row.minYears))}</span>
                  </header>
                  <p className="job-note">{row.note || "Qeyd yazılmayıb"}</p>
                  <dl className="job-meta">
                    <div>
                      <dt>Sertifikat</dt>
                      <dd title={row.certificate || "Tələb olunmur"}>{row.certificate || "Tələb olunmur"}</dd>
                    </div>
                    <div>
                      <dt>Başlanğıc</dt>
                      <dd>{row.startOn ? dateAZ(isoDay(row.startOn)) : "Açıq"}</dd>
                    </div>
                  </dl>
                  <footer>
                    <span><b>{matches.length}</b> uyğun namizəd</span>
                    <button type="button" className="btn small" onClick={() => openMatch(row.id)}>Tutuşdur</button>
                  </footer>
                </article>
              )
            })}
          </div>
        )
      )}

      {tab === "namized" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Namizəd</th>
                <th>Peşə</th>
                <th>Region</th>
                <th className="num">Staj</th>
                <th className="num">Gözlənti</th>
                <th>Status</th>
                <th>Əlaqə</th>
              </tr>
            </thead>
            <tbody>
              {shownPeople.map((row) => (
                <tr key={row.id} onClick={() => setOpenId(row.id)}>
                  <td>
                    <b>{row.name}</b>
                    <div className="muted">{row.education || row.skills || "Təhsil yazılmayıb"}</div>
                  </td>
                  <td>{row.profession}</td>
                  <td>{row.regions || "—"}</td>
                  <td className="num">{formatYears(confirmedYears(row.proofs))}</td>
                  <td className="num">{amount(row.expectPay) ? money(amount(row.expectPay)) : "—"}</td>
                  <td><Badge status={row.state || "tesdiq"} /></td>
                  <td>{row.shareConsent ? "Razılıq var" : "Bağlıdır"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shownPeople.length === 0 && <Empty title={ready ? "Namizəd yoxdur" : "Oxunur"} text={ready ? "Profil, peşə və staj sübutu əlavə edin." : "Namizədlər açılır."} />}
        </div>
      )}

      {tab === "uygun" && (
        openings.length === 0 ? (
          <Empty title="Tutuşdurmaq üçün vakansiya lazımdır" text="Əvvəl açıq yeri yazın." />
        ) : (
          <div className="job-match">
            <div className="job-pick">
              {shownOpenings.map((row) => (
                <button type="button" key={row.id} className={row.id === selectedOpening?.id ? "on" : ""} onClick={() => setPick(row.id)}>
                  <b>{row.profession}</b>
                  <span>{row.region || "Region açıqdır"} · min. {formatYears(amount(row.minYears))}</span>
                  <em>{(fits.get(row.id) || []).length} uyğun</em>
                </button>
              ))}
              {shownOpenings.length === 0 && <Empty title="Bu axtarışa vakansiya yoxdur" text="Başqa peşə və ya region yoxlayın." />}
            </div>
            <div className="job-rank">
              {selectedOpening && (
                <div className="panel pad job-brief">
                  <div className="card-top">
                    <h2>{selectedOpening.profession}</h2>
                    <span className="job-years">{formatYears(amount(selectedOpening.minYears))}</span>
                  </div>
                  <p className="muted">{[selectedOpening.region, selectedOpening.certificate, selectedOpening.note].filter(Boolean).join(" · ") || "Şərt yazılmayıb"}</p>
                </div>
              )}
              {selectedFits.map((row) => (
                <article key={row.person.id}>
                  <div className="job-person">
                    <b className="job-mark">{markOf(row.person.name)}</b>
                    <div>
                      <strong>{row.person.name}</strong>
                      <span>{row.person.profession} · {row.person.regions || "region yoxdur"}</span>
                    </div>
                    <button type="button" className="text-btn" onClick={() => setOpenId(row.person.id)}>Profil</button>
                  </div>
                  <Meter value={row.score} />
                  <div className="job-pills">
                    {row.reasons.map((reason) => <span key={reason}>{reason}</span>)}
                    <span>{row.person.phone || "Telefon yazılmayıb"}</span>
                  </div>
                </article>
              ))}
              {selectedOpening && selectedFits.length === 0 && <Empty title="Uyğun namizəd yoxdur" text="Peşə, təsdiqli staj, region və sertifikat eyni anda ödənməlidir." />}
            </div>
          </div>
        )
      )}

      {selectedPerson && (
        <Drawer title={selectedPerson.name} onClose={() => setOpenId("")}>
          <div className="job-person">
            <b className="job-mark">{markOf(selectedPerson.name)}</b>
            <div>
              <strong>{selectedPerson.profession}</strong>
              <span>{selectedPerson.regions || "Region yazılmayıb"}</span>
            </div>
          </div>
          <div className="job-pills">
            <Badge status={selectedPerson.state || "tesdiq"} />
            <span>{selectedPerson.shareConsent ? "Əlaqə razılığı var" : "Əlaqə bağlıdır"}</span>
          </div>
          <dl className="job-sheet">
            <div><dt>Telefon</dt><dd>{selectedPerson.phone || "—"}</dd></div>
            <div><dt>E-poçt</dt><dd>{selectedPerson.email || "—"}</dd></div>
            <div><dt>Təhsil</dt><dd>{selectedPerson.education || "—"}</dd></div>
            <div><dt>Bacarıq</dt><dd>{selectedPerson.skills || "—"}</dd></div>
            <div><dt>Gözlənti</dt><dd>{amount(selectedPerson.expectPay) ? money(amount(selectedPerson.expectPay)) : "—"}</dd></div>
            <div><dt>Başlama</dt><dd>{selectedPerson.startOn ? dateAZ(isoDay(selectedPerson.startOn)) : "—"}</dd></div>
            <div><dt>Təsdiqli staj</dt><dd>{formatYears(confirmedYears(selectedPerson.proofs))}</dd></div>
          </dl>
          <h2 className="block-title">Sübut</h2>
          {selectedPerson.proofs.length === 0 && <p className="muted">Sübut yoxdur.</p>}
          {selectedPerson.proofs.map((proof, index) => (
            <div className="step-row" key={proof.id || `${proof.title}-${index}`}>
              <span>{sourceLabel(proof.source)} · {proof.title}{proof.note ? ` · ${proof.note}` : ""}</span>
              <strong>{proof.confirmed ? formatYears(amount(proof.years)) : "Təsdiqsiz"}</strong>
            </div>
          ))}
        </Drawer>
      )}

      {vacancyOpen && (
        <Modal wide title="Yeni vakansiya" onClose={() => setVacancyOpen(false)}>
          <form className="form cols" onSubmit={(event) => void addVacancy(event)}>
            <Field label="Peşə"><input value={vacancy.profession} onChange={(event) => setVacancy({ ...vacancy, profession: event.target.value })} required /></Field>
            <Field label="Minimum staj, il"><input value={vacancy.minYears} onChange={(event) => setVacancy({ ...vacancy, minYears: event.target.value })} /></Field>
            <Field label="Region"><input value={vacancy.region} onChange={(event) => setVacancy({ ...vacancy, region: event.target.value })} /></Field>
            <Field label="Sertifikat"><input value={vacancy.certificate} onChange={(event) => setVacancy({ ...vacancy, certificate: event.target.value })} /></Field>
            <Field label="Başlanğıc"><DateField value={vacancy.startOn} onChange={(startOn) => setVacancy({ ...vacancy, startOn })} /></Field>
            <Field label="Qeyd"><textarea value={vacancy.note} onChange={(event) => setVacancy({ ...vacancy, note: event.target.value })} /></Field>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setVacancyOpen(false)}>Ləğv et</button>
              <button type="submit" className="btn">Saxla</button>
            </div>
          </form>
        </Modal>
      )}

      {personOpen && (
        <Modal wide title="Yeni namizəd" onClose={() => setPersonOpen(false)}>
          <form className="form cols" onSubmit={(event) => void addPerson(event)}>
            <Field label="Ad"><input value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} required /></Field>
            <Field label="Peşə"><input value={person.profession} onChange={(event) => setPerson({ ...person, profession: event.target.value })} required /></Field>
            <Field label="Staj, il"><input value={person.years} onChange={(event) => setPerson({ ...person, years: event.target.value })} /></Field>
            <Field label="Telefon"><input value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} /></Field>
            <Field label="E-poçt"><input value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} /></Field>
            <Field label="Region"><input value={person.regions} onChange={(event) => setPerson({ ...person, regions: event.target.value })} /></Field>
            <Field label="Təhsil"><input value={person.education} onChange={(event) => setPerson({ ...person, education: event.target.value })} /></Field>
            <Field label="Bacarıq"><input value={person.skills} onChange={(event) => setPerson({ ...person, skills: event.target.value })} /></Field>
            <Field label="Gözlənti, AZN"><input value={person.expectPay} onChange={(event) => setPerson({ ...person, expectPay: event.target.value })} /></Field>
            <Field label="Başlama"><DateField value={person.startOn} onChange={(startOn) => setPerson({ ...person, startOn })} /></Field>
            <Field label="Sübut mənbəyi">
              <Select value={person.source} onValueChange={(source) => setPerson({ ...person, source })} options={SOURCES} />
            </Field>
            <Field label="Status">
              <Select value={person.state} onValueChange={(state) => setPerson({ ...person, state })} options={STATES} />
            </Field>
            <Field label="Sertifikat"><input value={person.certificate} onChange={(event) => setPerson({ ...person, certificate: event.target.value })} /></Field>
            <Field label="Sertifikatın bitmə tarixi"><DateField value={person.expires} onChange={(expires) => setPerson({ ...person, expires })} /></Field>
            <Field label="Əlaqə razılığı">
              <Select value={person.shareConsent ? "beli" : "xeyr"} onValueChange={(value) => setPerson({ ...person, shareConsent: value === "beli" })} options={[{ value: "xeyr", label: "Yoxdur" }, { value: "beli", label: "Var" }]} />
            </Field>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setPersonOpen(false)}>Ləğv et</button>
              <button type="submit" className="btn">Saxla</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
