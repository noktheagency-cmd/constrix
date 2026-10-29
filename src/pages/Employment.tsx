import { Button, Input, Panel, SearchInput, TableContainer, Textarea, Toolbar } from "../components/primitives"
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
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("all")
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

  const shownOpenings = openings.filter((row) => hit(store.query, row.profession, row.region, row.note, row.certificate, row.minYears as string) && hit(query,row.profession,row.region,row.note,row.certificate) && (region === "all" || row.region === region))
  const shownPeople = people.filter((row) => hit(store.query, row.name, row.profession, row.regions, row.phone, row.email, row.education, row.skills, row.proofs.map((proof) => proof.title).join(" ")) && hit(query,row.name,row.profession,row.regions))
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
    <div className="mesgulluq employment-workspace">
      <PageHead kicker="Kadr" title="Məşğulluq" text="Vakansiyaları, namizədləri və uyğunluq nəticələrini idarə edin.">
        <Button type="button" className="ghost" onClick={() => { setNote(null); setPersonOpen(true) }}><Icon name="plus" /> Namizəd əlavə et</Button>
        <Button type="button" onClick={() => { setNote(null); setVacancyOpen(true) }}><Icon name="plus" /> Yeni vakansiya</Button>
      </PageHead>

      <Panel className="employment-summary">{[{icon:"briefcase" as const,label:"Vakansiya",value:openings.length},{icon:"users" as const,label:"Namizəd",value:people.length},{icon:"check" as const,label:"Əlaqə razılığı",value:consent},{icon:"clock" as const,label:"Orta staj",value:`${average} il`}].map((item) => <div key={item.label}><Icon name={item.icon} /><div><strong>{ready ? item.value : "…"}</strong><span>{item.label}</span></div></div>)}</Panel>

      {note && <p className={note.bad ? "form-error" : "form-note"}>{note.text}</p>}

      <Toolbar>
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
      </Toolbar>

      {tab !== "uygun" && <Toolbar className="finance-list-toolbar"><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "namized" ? "Ad, peşə və ya region axtar" : "Peşə və ya region axtar"} />{tab === "vakansiya" && <Select ariaLabel="Vakansiya regionu" value={region} onValueChange={setRegion} options={[{value:"all",label:"Bütün regionlar"},...Array.from(new Set(openings.map((item) => item.region).filter(Boolean))).map((item) => ({value:item,label:item}))]} />}</Toolbar>}
      {tab === "vakansiya" && <TableContainer className="finance-records-table employment-table"><table><thead><tr><th>Peşə</th><th>Region</th><th>Minimum staj</th><th>Başlanğıc</th><th>Uyğun namizəd</th><th><span className="sr-only">Uyğunlaşdır</span></th></tr></thead><tbody>{shownOpenings.map((row) => <tr key={row.id} tabIndex={0} onClick={() => openMatch(row.id)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();openMatch(row.id)}}}><td><strong>{row.profession}</strong><small>{row.certificate || row.note || "Sertifikat tələb olunmur"}</small></td><td>{row.region || "Region açıqdır"}</td><td>{formatYears(amount(row.minYears))}</td><td>{row.startOn ? dateAZ(isoDay(row.startOn)) : "—"}</td><td><span className={`badge ${(fits.get(row.id)||[]).length ? "pine" : "stone"}`}>{(fits.get(row.id)||[]).length} namizəd</span></td><td><Icon name="chevron" /></td></tr>)}</tbody></table>{!shownOpenings.length && <Empty title={ready ? "Vakansiya tapılmadı" : "Məlumatlar oxunur"} text="Filtrləri dəyişin və ya yeni vakansiya əlavə edin." />}</TableContainer>}

      {tab === "namized" && (
        <TableContainer className="finance-records-table employment-table">
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
                <tr key={row.id} tabIndex={0} onClick={() => setOpenId(row.id)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setOpenId(row.id)}}}>
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
        </TableContainer>
      )}

      {tab === "uygun" && (
        openings.length === 0 ? (
          <Empty title="Tutuşdurmaq üçün vakansiya lazımdır" text="Əvvəl açıq yeri yazın." />
        ) : (
          <div className="employment-matching">
            <Panel className="pad employment-match-header"><label>Vakansiya<Select ariaLabel="Uyğunlaşdırılacaq vakansiya" value={selectedOpening?.id || ""} onValueChange={setPick} options={shownOpenings.map((row) => ({value:row.id,label:`${row.profession} · ${row.region || "Bütün regionlar"}`}))} /></label>{selectedOpening && <p className="muted">Minimum {formatYears(amount(selectedOpening.minYears))}{selectedOpening.certificate ? ` · ${selectedOpening.certificate}` : ""} · {selectedFits.length} uyğun namizəd</p>}</Panel>
            <div className="job-rank">
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
            <Field label="Peşə"><Input value={vacancy.profession} onChange={(event) => setVacancy({ ...vacancy, profession: event.target.value })} required /></Field>
            <Field label="Minimum staj, il"><Input value={vacancy.minYears} onChange={(event) => setVacancy({ ...vacancy, minYears: event.target.value })} /></Field>
            <Field label="Region"><Input value={vacancy.region} onChange={(event) => setVacancy({ ...vacancy, region: event.target.value })} /></Field>
            <Field label="Sertifikat"><Input value={vacancy.certificate} onChange={(event) => setVacancy({ ...vacancy, certificate: event.target.value })} /></Field>
            <Field label="Başlanğıc"><DateField value={vacancy.startOn} onChange={(startOn) => setVacancy({ ...vacancy, startOn })} /></Field>
            <Field label="Qeyd"><Textarea value={vacancy.note} onChange={(event) => setVacancy({ ...vacancy, note: event.target.value })} /></Field>
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setVacancyOpen(false)}>Ləğv et</Button>
              <Button type="submit" >Saxla</Button>
            </div>
          </form>
        </Modal>
      )}

      {personOpen && (
        <Modal wide title="Yeni namizəd" onClose={() => setPersonOpen(false)}>
          <form className="form cols" onSubmit={(event) => void addPerson(event)}>
            <Field label="Ad"><Input value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} required /></Field>
            <Field label="Peşə"><Input value={person.profession} onChange={(event) => setPerson({ ...person, profession: event.target.value })} required /></Field>
            <Field label="Staj, il"><Input value={person.years} onChange={(event) => setPerson({ ...person, years: event.target.value })} /></Field>
            <Field label="Telefon"><Input value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} /></Field>
            <Field label="E-poçt"><Input value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} /></Field>
            <Field label="Region"><Input value={person.regions} onChange={(event) => setPerson({ ...person, regions: event.target.value })} /></Field>
            <Field label="Təhsil"><Input value={person.education} onChange={(event) => setPerson({ ...person, education: event.target.value })} /></Field>
            <Field label="Bacarıq"><Input value={person.skills} onChange={(event) => setPerson({ ...person, skills: event.target.value })} /></Field>
            <Field label="Gözlənti, AZN"><Input value={person.expectPay} onChange={(event) => setPerson({ ...person, expectPay: event.target.value })} /></Field>
            <Field label="Başlama"><DateField value={person.startOn} onChange={(startOn) => setPerson({ ...person, startOn })} /></Field>
            <Field label="Sübut mənbəyi">
              <Select value={person.source} onValueChange={(source) => setPerson({ ...person, source })} options={SOURCES} />
            </Field>
            <Field label="Status">
              <Select value={person.state} onValueChange={(state) => setPerson({ ...person, state })} options={STATES} />
            </Field>
            <Field label="Sertifikat"><Input value={person.certificate} onChange={(event) => setPerson({ ...person, certificate: event.target.value })} /></Field>
            <Field label="Sertifikatın bitmə tarixi"><DateField value={person.expires} onChange={(expires) => setPerson({ ...person, expires })} /></Field>
            <Field label="Əlaqə razılığı">
              <Select value={person.shareConsent ? "beli" : "xeyr"} onValueChange={(value) => setPerson({ ...person, shareConsent: value === "beli" })} options={[{ value: "xeyr", label: "Yoxdur" }, { value: "beli", label: "Var" }]} />
            </Field>
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setPersonOpen(false)}>Ləğv et</Button>
              <Button type="submit" >Saxla</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
