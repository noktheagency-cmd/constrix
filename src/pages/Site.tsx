import { DataTable } from '../components/DataTable'
import { DailyPhotos } from '../components/DailyPhotos'
import { StepNav } from "../components/StepNav"
import { Button, Disclosure, Input, Metric, Panel, StatGrid, SectionHeader, TableContainer, Textarea, Toolbar } from "../components/primitives"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { DateField } from "../DateField"
import { useSearchParams } from "react-router-dom"
import { isAway, PERSON_STATUSES } from "../domain/places"
import type { PersonStatus, Weather } from "../domain/types"
import { dateAZ, hit, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Empty, Field, Meter, Modal, PageHead, RowMenu, Select, StockBar, Tabs, useTitle } from "../ui"
import { PhaseTrack } from "./projectParts"
import Reports from "./Reports"

const ASSET_TYPES = ["Kran", "Ekskavator", "Beton", "Nəqliyyat", "Anbar", "Dəzgah"]
const TODAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" }).format(new Date())
const emptyPerson = { id: "", name: "", role: "", crew: "", phone: "", status: "sahede" as PersonStatus }

type Tab = "icmal" | "hesabat" | "gundelik" | "hecm" | "briqada" | "texnika" | "material" | "qeyd"
const SITE_TABS: Tab[] = ["icmal", "hesabat", "gundelik", "hecm", "briqada", "texnika", "material", "qeyd"]

const blank = {
  weather: "gunesli" as Weather,
  crew: "",
  note: "",
  lines: {} as Record<string, string>,
  assetId: "",
  hours: "",
  attendance: {} as Record<string, string>,
  date: TODAY,
  photos: [] as string[],
}

export default function Site() {
  const { t } = usePrefs()
  useTitle(t("page.site.title"))
  const { query, projects, smetas, assets, people, materials, stocks, locations, requests, reports, journal, documents, saveDaily, addNote, createRequest, assignToSite, editCrew, releaseFromSite, pullAsset, editAsset, releaseAsset } = useStore()
  const [search, setSearch] = useSearchParams()
  const tabParam = search.get("tab")
  const [projectId, setProjectId] = useState(projects.find((item) => item.status === "aktiv")?.id || projects[0]?.id || "")
  const tab: Tab = SITE_TABS.includes(tabParam as Tab) ? tabParam as Tab : "icmal"
  const resources: Tab[] = ["hecm", "briqada", "texnika", "material"]
  const [step, setStep] = useState("general")
  const dailyRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const element = dailyRef.current
    const viewport = element?.closest("main")
    if(element && viewport && element.getBoundingClientRect().top < viewport.getBoundingClientRect().top) element.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"})
  }, [step])
  const steps = [{id:"general",label:"Ümumi məlumat"},{id:"work",label:"İş və davamiyyət"},{id:"notes",label:"Texnika və qeyd"}]
  const stepIndex = steps.findIndex((item) => item.id === step)
  const [form, setForm] = useState(blank)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  function openSiteTab(next: string) {
    if (!SITE_TABS.includes(next as Tab)) return
    setError("")
    setSearch(next === "icmal" ? {} : { tab: next })
  }
  const [ask, setAsk] = useState<{ materialId: string; qty: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [person, setPerson] = useState(emptyPerson)
  const [personOpen, setPersonOpen] = useState(false)
  const [assignId, setAssignId] = useState("")
  const [assignCrew, setAssignCrew] = useState("")
  const [machine, setMachine] = useState({ id: "", name: "", type: "Kran", hours: "", nextService: "", utilization: "" })
  const [pullId, setPullId] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (projects.some((item) => item.id === projectId)) return
    const next = projects.find((item) => item.status === "aktiv") || projects[0]
    if (next) setProjectId(next.id)
  }, [projects, projectId])

  const project = projects.find((item) => item.id === projectId)
  const smeta = smetas.find((item) => item.projectId === projectId)
  const place = locations.find((item) => item.projectId === projectId)
  const crew = people.filter((item) => item.site === project?.name)
  const machines = assets.filter((item) => item.site === project?.name)
  const pool = assets.filter((item) => item.site !== project?.name && item.status !== "servis")
  const siteAssets = assets.filter((item) => item.status === "sahede" || item.status === "icarede")
  const mineReports = reports.filter((item) => item.projectId === projectId)
  const today = mineReports.find((item) => item.date === TODAY)
  const mineRequests = requests.filter((item) => item.projectId === projectId)
  const openRequests = mineRequests.filter((item) => item.status === "gozleyir" || item.status === "teklif" || item.status === "sifaris")
  const piles = stocks.filter((item) => item.locationId === place?.id && item.qty > 0)
  const notes = journal.filter((item) => item.site === project?.name)
  const papers = documents.filter((item) => item.projectId === projectId)
  const lines = (smeta?.lines || []).filter((line) => hit(query, line.code, line.name, project?.name))

  function pickProject(next: string) {
    setProjectId(next)
    setStep("general")
    setForm(blank)
    setError("")
  }

  function submit(event: FormEvent | { preventDefault: () => void }, send: boolean) {
    event.preventDefault()
    if (uploadingPhotos) { setError("Şəkillərin yüklənməsini gözləyin."); return }
    const reportLines = Object.entries(form.lines).filter(([, qty]) => Number(qty) > 0).map(([smetaLineId, qty]) => ({ smetaLineId, qty }))
    const attendance = Object.entries(form.attendance).filter(([, hours]) => Number(hours) > 0).map(([personId, hours]) => ({ personId, hours }))
    const message = saveDaily({
      projectId,
      date: form.date,
      weather: form.weather,
      crew: attendance.length || form.crew,
      note: form.note,
      lines: reportLines,
      machines: form.assetId ? [{ assetId: form.assetId, hours: form.hours }] : [],
      attendance,
      photos: form.photos,
      submit: send,
    })
    setError(message)
    if (!message) { setForm(blank); setStep("general"); openSiteTab("gundelik") }
  }

  return (
    <div className="site-workspace">
      <PageHead title="Sahə idarəetməsi" text="Obyektin gündəlik işi və resursları.">
        {project && tab !== "hesabat" && <Button onClick={() => { setStep("general"); openSiteTab("hesabat") }}><Icon name="plus" />Yeni gündəlik</Button>}
        {tab === "hesabat" && <Button className="ghost" onClick={() => openSiteTab("gundelik")}>Gündəliklərə qayıt</Button>}
        {tab === "material" && (
          <Button type="button" onClick={() => { setError(""); setAsk({ materialId: materials[0]?.id || "", qty: "" }) }}>
            <Icon name="plus" /> Tələbnamə
          </Button>
        )}
        {tab === "qeyd" && (
          <Button type="button" onClick={() => { setError(""); setNote("") }}>
            <Icon name="plus" /> Qeyd
          </Button>
        )}
        {tab === "briqada" && (
          <Button type="button" onClick={() => { setError(""); setPerson(emptyPerson); setAssignId(people.find((item) => item.site !== project?.name && !isAway(item.status))?.id || ""); setAssignCrew(""); setPersonOpen(true) }}>
            <Icon name="plus" /> Təyin et
          </Button>
        )}
        {tab === "texnika" && (
          <Button type="button" onClick={() => { setError(""); setPullId(pool[0]?.id || "") }}>
            <Icon name="plus" /> Cəlb et
          </Button>
        )}
      </PageHead>
      <Panel className="site-project-picker"><label>Obyekt<Select ariaLabel="Obyekt" value={projectId} onValueChange={pickProject} options={projects.map((item) => ({value:item.id,label:item.name}))} /></label>{project && <div><span>{[project.city, project.phase].filter(Boolean).join(" · ")}</span><Badge status={project.status} /></div>}</Panel>
      <Toolbar className="site-navigation"><Tabs value={resources.includes(tab) ? "resources" : tab === "hesabat" ? "gundelik" : tab} onChange={(value) => openSiteTab(value === "resources" ? "briqada" : value)} options={[{id:"icmal",label:"İcmal"},{id:"gundelik",label:"Gündəliklər"},{id:"resources",label:"Resurslar"},{id:"qeyd",label:"Qeydlər"}]} /></Toolbar>
      {resources.includes(tab) && <Toolbar className="site-resource-picker"><label>Resurs növü<Select ariaLabel="Resurs növü" value={tab} onValueChange={openSiteTab} options={[{value:"briqada",label:"Briqada"},{value:"texnika",label:"Texnika"},{value:"material",label:"Material"},{value:"hecm",label:"İş həcmləri"}]} /></label></Toolbar>}
      {!project && <Empty title="Obyekt yoxdur" text="Layihə açıldıqda sahə burada görünür." />}

      {project && tab === "icmal" && (
        <>
          <StatGrid className="site-overview-stats"><Metric><span>İrəliləyiş</span><strong>{project.progress}%</strong><Meter value={project.progress} tone="pine" /></Metric><Metric><span>Briqada</span><strong>{crew.length}</strong><em>{project.manager}</em></Metric><Metric><span>Texnika</span><strong>{machines.length}</strong><em>{openRequests.length} açıq tələb</em></Metric></StatGrid>
          <Panel className="site-day"><SectionHeader><h2>Günün işi</h2><div><span>{dateAZ(TODAY)}</span>{today ? <Badge status={today.status} /> : <span className="badge gold">Gündəlik yaradılmayıb</span>}</div></SectionHeader>
            <div className="site-day-columns"><section><SectionHeader><h3>Açıq işlər</h3><Button className="ghost small" onClick={() => openSiteTab("hecm")}>Həcmə bax</Button></SectionHeader>
              <div className="site-work-list">{(smeta?.lines || []).filter((line) => line.qty - line.doneQty > 0.05).slice(0,5).map((line) => <div key={line.id}><div><strong>{line.name}</strong><span>{line.code}</span></div><b>{num(line.qty - line.doneQty,1)} {line.unit}</b></div>)}</div>
              {!(smeta?.lines || []).some((line) => line.qty-line.doneQty>0.05) && <p className="muted">Açıq iş həcmi yoxdur.</p>}
            </section><section><SectionHeader><h3>Son qeydlər</h3><Button className="ghost small" onClick={() => openSiteTab("qeyd")}>Hamısına bax</Button></SectionHeader>
              <div className="site-note-list">{notes.slice(-3).reverse().map((item) => <article key={item.id}><span>{item.time}</span><p>{item.text}</p></article>)}</div>{notes.length === 0 && <p className="muted">Bu obyekt üçün qeyd yoxdur.</p>}
              <Disclosure title={"Sənədlər " + papers.length}>{papers.length === 0 && <p className="muted">Sənəd yoxdur.</p>}{papers.map((item) => <div className="site-document" key={item.id}><strong>{item.title}</strong><Badge status={item.status} /></div>)}</Disclosure>
            </section></div>
          </Panel>
          <Disclosure title="Mərhələlər"><PhaseTrack projectId={project.id} phases={project.phases} /><p className="muted">{project.address}, {project.city}</p></Disclosure>
        </>
      )}

      {project && tab === "hesabat" && (
        <form ref={dailyRef} className="panel pad form site-daily-form" onSubmit={(event) => { if(step !== "notes") { event.preventDefault(); setStep(steps[stepIndex+1].id) } else submit(event,false) }}>
          <StepNav label="Gündəlik mərhələləri" value={step} onChange={setStep} steps={steps} />
          <h2>{steps[stepIndex].label}</h2>
          {step === "general" && <div>
          <div className="split">
            <Field label="Tarix">
              <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </Field>
            <Field label="Hava">
              <Select
                value={form.weather}
                onValueChange={(weather) => setForm({ ...form, weather: weather as Weather })}
                options={[
                  { value: "gunesli", label: t("weather.gunesli") },
                  { value: "buludlu", label: t("weather.buludlu") },
                  { value: "yagis", label: t("weather.yagis") },
                  { value: "kulek", label: t("weather.kulek") },
                ]}
              />
            </Field>
            <Field label="Briqada, nəfər">
              <Input value={form.crew} onChange={(event) => setForm({ ...form, crew: event.target.value })} />
            </Field>
          </div>
          </div>}
          {step === "work" && <div>
          {crew.length > 0 && (
            <div className="stack">
              <p className="block-title">Tabel</p>
              {crew.map((person) => (
                <label key={person.id} className="qty-line">
                  <span>{person.name} · {person.role}</span>
                  <Input type="number" min="0" step="0.5" placeholder="Saat" value={form.attendance[person.id] || ""} onChange={(event) => setForm({ ...form, attendance: { ...form.attendance, [person.id]: event.target.value } })} />
                </label>
              ))}
            </div>
          )}
          {smeta && (
            <div className="stack">
              <p className="block-title">Həcm</p>
              {smeta.lines.map((line) => (
                <label key={line.id} className="qty-line">
                  <span>{line.code} {line.name} · qalıq {num(Math.max(0, line.qty - line.doneQty), 1)} {line.unit}</span>
                  <Input type="number" min="0" step="0.1" placeholder="Həcm" value={form.lines[line.id] || ""} onChange={(event) => setForm({ ...form, lines: { ...form.lines, [line.id]: event.target.value } })} />
                </label>
              ))}
            </div>
          )}
          </div>}
          {step === "notes" && <div>
          <div className="split">
            <Field label="Texnika">
              <Select value={form.assetId} onValueChange={(assetId) => setForm({ ...form, assetId })} options={[{ value: "", label: t("none") }, ...siteAssets.map((item) => ({ value: item.id, label: item.name }))]} />
            </Field>
            <Field label="Moto-saat">
              <Input type="number" min="0" step="0.5" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
            </Field>
          </div>
          <Field label="Qeyd">
            <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Field>
          <DailyPhotos value={form.photos} onChange={photos => setForm(previous => ({ ...previous, photos }))} onBusyChange={setUploadingPhotos} />
          </div>}
          {error && <p className="form-error">{error}</p>}
          <div className="calc-step-footer"><span>{stepIndex + 1} / {steps.length}</span><div>{stepIndex > 0 && <Button className="ghost" onClick={() => setStep(steps[stepIndex-1].id)}>Geri</Button>}{stepIndex < steps.length-1 ? <Button onClick={() => setStep(steps[stepIndex+1].id)}>Davam et</Button> : <><Button className="ghost" type="submit">Qaralama saxla</Button><Button onClick={(event) => submit(event,true)}>Təsdiqə göndər</Button></>}</div></div>
        </form>
      )}

      {project && tab === "gundelik" && <Reports embedded projectId={projectId} />}

      {project && tab === "hecm" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>İş</th>
                <th className="num">Plan</th>
                <th className="num">Görülən</th>
                <th className="num">Qalıq</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td><b>{line.code} {line.name}</b><div className="muted">{line.unit}</div></td>
                  <td className="num">{num(line.qty, 1)}</td>
                  <td className="num">{num(line.doneQty, 1)}</td>
                  <td className="num">{num(Math.max(0, line.qty - line.doneQty), 1)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {lines.length === 0 && <Empty title="Həcm yoxdur" text="Bu obyektin smetası boşdur." />}
        </TableContainer>
      )}

      {project && tab === "briqada" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr><th>İşçi</th><th>Briqada</th><th>Telefon</th><th>Vəziyyət</th><th></th></tr>
            </thead>
            <tbody>
              {crew.filter((item) => hit(query, item.name, item.role, item.crew)).map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b><div className="muted">{item.role}</div></td>
                  <td>{item.crew}</td>
                  <td className="mono">{item.phone}</td>
                  <td><Badge status={item.status} /></td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => { setError(""); setPerson({ id: item.id, name: item.name, role: item.role, crew: item.crew === "—" ? "" : item.crew, phone: item.phone === "—" ? "" : item.phone, status: item.status }); setPersonOpen(true) } },
                        { id: "delete", label: "Sahədən çıxar", onClick: () => setError(releaseFromSite(item.id)) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {crew.length === 0 && <Empty title="Briqada boşdur" text="HRM işçilərindən bu obyektə təyin edin." />}
        </TableContainer>
      )}

      {project && tab === "texnika" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr><th>Texnika</th><th className="num">Moto-saat</th><th>Servis</th><th className="num">Yüklənmə</th><th>Vəziyyət</th><th></th></tr>
            </thead>
            <tbody>
              {machines.filter((item) => hit(query, item.name, item.type)).map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b><div className="muted">{item.type}</div></td>
                  <td className="num">{num(item.hours, 0)}</td>
                  <td>{dateAZ(item.nextService)}</td>
                  <td className="num">{item.utilization}%</td>
                  <td><Badge status={item.status} /></td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => { setError(""); setMachine({ id: item.id, name: item.name, type: item.type, hours: String(item.hours), nextService: item.nextService, utilization: String(item.utilization) }) } },
                        { id: "delete", label: "Sil", onClick: () => setError(releaseAsset(item.id)) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {machines.length === 0 && <Empty title="Texnika yoxdur" text="Bu obyektə bağlanmış maşın yoxdur." />}
        </TableContainer>
      )}

      {project && tab === "material" && (
        <div className="site-grid">
          <Panel className="pad">
            <SectionHeader><h2>Sahə anbarı</h2><span className="muted">{place?.name || "Anbar yoxdur"}</span></SectionHeader>
            <div className="mini-list">
              {piles.map((row) => {
                const material = materials.find((item) => item.id === row.materialId)
                return (
                  <article key={row.materialId}>
                    <div className="split"><b>{material?.name || row.materialId}</b><span>{num(row.qty, 1)} {material?.unit}</span></div>
                    {material && <StockBar qty={row.qty} min={material.min} />}
                  </article>
                )
              })}
            </div>
            {piles.length === 0 && <p className="muted">Sahə anbarında qalıq yoxdur.</p>}
          </Panel>
          <Panel className="pad">
            <SectionHeader><h2>Tələblər</h2></SectionHeader>
            <div className="mini-list">
              {mineRequests.filter((item) => hit(query, item.material, item.id, item.text)).map((item) => (
                <article key={item.id}>{item.material} · {num(item.qty, 1)} {item.unit}<div className="muted">{item.id} · <Badge status={item.status} /></div></article>
              ))}
            </div>
            {mineRequests.length === 0 && <p className="muted">Bu obyektin tələbi yoxdur.</p>}
          </Panel>
        </div>
      )}

      {project && tab === "qeyd" && (
        <TableContainer>
          <DataTable>
            <thead><tr><th>Vaxt</th><th>Qeyd</th></tr></thead>
            <tbody>
              {notes.filter((item) => hit(query, item.text)).map((item) => (
                <tr key={item.id}><td className="mono">{item.time}</td><td>{item.text}</td></tr>
              ))}
            </tbody>
          </DataTable>
          {notes.length === 0 && <Empty title="Qeyd yoxdur" text="Sahədən qısa qeyd yazın." />}
        </TableContainer>
      )}

      {ask && (
        <Modal title="Tələbnamə" onClose={() => setAsk(null)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = createRequest({ projectId, materialId: ask.materialId, qty: ask.qty })
              setError(message)
              if (!message) setAsk(null)
            }}
          >
            <Field label="Material">
              <Select value={ask.materialId} onValueChange={(materialId) => setAsk({ ...ask, materialId })} options={materials.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Miqdar">
              <Input type="number" min="0" step="0.1" value={ask.qty} onChange={(event) => setAsk({ ...ask, qty: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions"><Button  type="submit">Aç</Button></div>
          </form>
        </Modal>
      )}

      {note !== null && (
        <Modal title="Yeni qeyd" onClose={() => setNote(null)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = addNote(project?.name || "", note)
              setError(message)
              if (!message) setNote(null)
            }}
          >
            <Field label="Qeyd">
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions"><Button  type="submit">Saxla</Button></div>
          </form>
        </Modal>
      )}

      {personOpen && !person.id && (
        <Modal title="Briqadaya təyin" onClose={() => setPersonOpen(false)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = assignToSite(assignId, project?.name || "", assignCrew)
              setError(message)
              if (!message) setPersonOpen(false)
            }}
          >
            {people.filter((item) => item.site !== project?.name && !isAway(item.status)).length === 0 && (
              <p className="muted">HRM-də bu sahədən kənar işçi yoxdur. Məzuniyyətdə olan gəlmir.</p>
            )}
            <Field label="İşçi">
              <Select
                value={assignId}
                onValueChange={setAssignId}
                options={people.filter((item) => item.site !== project?.name && !isAway(item.status)).map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))}
              />
            </Field>
            <Field label="Briqada">
              <Input value={assignCrew} onChange={(event) => setAssignCrew(event.target.value)} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button  type="submit" disabled={!assignId}>Təyin et</Button>
            </div>
          </form>
        </Modal>
      )}

      {personOpen && person.id && (
        <Modal title="İşçini yaz" onClose={() => setPersonOpen(false)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = editCrew(person.id, project?.name || "", person)
              setError(message)
              if (!message) setPersonOpen(false)
            }}
          >
            <Field label="Ad">
              <Input value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} />
            </Field>
            <Field label="Vəzifə">
              <Input value={person.role} onChange={(event) => setPerson({ ...person, role: event.target.value })} />
            </Field>
            <Field label="Briqada">
              <Input value={person.crew} onChange={(event) => setPerson({ ...person, crew: event.target.value })} />
            </Field>
            <Field label="Telefon">
              <Input value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} />
            </Field>
            <Field label="Vəziyyət">
              <Select
                value={person.status}
                onValueChange={(status) => setPerson({ ...person, status: status as PersonStatus })}
                options={PERSON_STATUSES.map((id) => ({ value: id, label: t(`status.${id}`) }))}
              />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions"><Button  type="submit">Saxla</Button></div>
          </form>
        </Modal>
      )}

      {pullId !== null && (
        <Modal title="Texnika cəlb et" onClose={() => setPullId(null)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = pullAsset(pullId, project?.name || "")
              setError(message)
              if (!message) setPullId(null)
            }}
          >
            {pool.length === 0 && <p className="muted">Parkda cəlb olunacaq texnika yoxdur. Servisdəki maşın gəlmir.</p>}
            {pool.length > 0 && (
              <Field label="Aktivlər parkı">
                <Select
                  value={pullId}
                  onValueChange={setPullId}
                  options={pool.map((item) => ({ value: item.id, label: `${item.name} · ${item.site}` }))}
                />
              </Field>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button  type="submit" disabled={!pullId}>Cəlb et</Button>
            </div>
          </form>
        </Modal>
      )}

      {machine.id && (
        <Modal title="Texnikanı yaz" onClose={() => setMachine({ ...machine, id: "" })}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = editAsset(machine.id, machine)
              setError(message)
              if (!message) setMachine({ ...machine, id: "" })
            }}
          >
            <Field label="Ad">
              <Input value={machine.name} onChange={(event) => setMachine({ ...machine, name: event.target.value })} />
            </Field>
            <Field label="Növ">
              <Select
                value={machine.type}
                onValueChange={(type) => setMachine({ ...machine, type })}
                options={(ASSET_TYPES.includes(machine.type) ? ASSET_TYPES : [machine.type, ...ASSET_TYPES]).map((item) => ({ value: item, label: item }))}
              />
            </Field>
            <div className="split">
              <Field label="Moto-saat">
                <Input type="number" min="0" value={machine.hours} onChange={(event) => setMachine({ ...machine, hours: event.target.value })} />
              </Field>
              <Field label="Yüklənmə, %">
                <Input type="number" min="0" max="100" value={machine.utilization} onChange={(event) => setMachine({ ...machine, utilization: event.target.value })} />
              </Field>
            </div>
            <Field label="Növbəti servis">
              <DateField value={machine.nextService} onChange={(nextService) => setMachine({ ...machine, nextService })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions"><Button  type="submit">Saxla</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
