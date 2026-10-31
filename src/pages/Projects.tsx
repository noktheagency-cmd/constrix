import { DataTable } from '../components/DataTable'
import { Button, Input, Metric, SearchInput, StatGrid, TableContainer, Textarea, Toolbar } from "../components/primitives"
import { useEffect, useState, type FormEvent } from "react"
import { DateField } from "../DateField"
import { Link } from "react-router-dom"
import type { DocumentForm, NewProjectForm, Project, ProjectStatus } from "../domain/types"
import { dateAZ, hit, money, moneyShort, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Meter, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"
import { ApiError, api } from "../api"

const STATUSES: { id: string; label: string }[] = [
  { id: "hamisi", label: "Hamısı" },
  { id: "aktiv", label: "Aktiv" },
  { id: "gecikir", label: "Gecikir" },
  { id: "tehvil", label: "Təhvil" },
  { id: "plan", label: "Plan" },
]

const KINDS = ["İcazə", "Çizgi", "Əlavə iş", "Protokol", "Akt"]

const emptyPaper: DocumentForm = { projectId: "", title: "", kind: "İcazə", date: "" }
type ProjectTransferAssignment = { accountId: string; name: string; email: string; seatRole: string; canSendTransfers: boolean; canReceiveTransfers: boolean; active: boolean; assignedBy: string; updatedAt: string }
type ProjectMemberChoice = { accountId: string; name: string; seatRole: string }

function passport(project: Project): NewProjectForm {
  return {
    name: project.name,
    client: project.client,
    address: project.address,
    district: project.district,
    city: project.city,
    type: project.type,
    phase: project.phase,
    manager: project.manager,
    floors: String(project.floors),
    area: String(project.area),
    budget: String(project.budget),
    start: project.start,
    end: project.end,
    status: project.status,
  }
}

function blankProject(manager: string, client: string): NewProjectForm {
  return {
    name: "",
    client,
    address: "",
    district: "",
    city: "Bakı",
    type: "Yaşayış",
    phase: "Torpaq",
    manager,
    floors: "",
    area: "",
    budget: "",
    start: "",
    end: "",
    status: "plan",
  }
}

export default function Projects() {
  const { t } = usePrefs()
  useTitle(t("page.projects.title"))
  const store = useStore()
  const { query, projects, clients, smetas, documents, actor } = store
  const [tab, setTab] = useState("reyestr")
  const [filter, setFilter] = useState("hamisi")
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<NewProjectForm | null>(null)
  const [formId, setFormId] = useState("")
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ projectId: string; id: string; text: string } | null>(null)
  const [paper, setPaper] = useState<(DocumentForm & { id: string }) | null>(null)
  const [error, setError] = useState("")
  const [assignmentRows, setAssignmentRows] = useState<ProjectTransferAssignment[]>([])
  const [assignmentMembers, setAssignmentMembers] = useState<ProjectMemberChoice[]>([])
  const [assignmentAccountId, setAssignmentAccountId] = useState("")
  const [assignmentCanSend, setAssignmentCanSend] = useState(false)
  const [assignmentCanReceive, setAssignmentCanReceive] = useState(true)
  const [assignmentBusy, setAssignmentBusy] = useState(false)
  const [assignmentError, setAssignmentError] = useState("")
  const canSign = actor.role === "director" || actor.role === "pm"

  const rows = projects.filter((item) => (filter === "hamisi" || item.status === filter) && hit(query, item.name, item.client, item.city, item.district, item.manager, item.id, item.phase))
  const open = projects.find((item) => item.id === openId) || null

  useEffect(() => {
    let current = true
    if (!openId || actor.role !== "director") return () => { current = false }
    setAssignmentBusy(true)
    setAssignmentError("")
    Promise.all([
      api<ProjectTransferAssignment[]>(`/api/projects/${encodeURIComponent(openId)}/assignments`),
      api<{ org: { members: { accountId: string | null; name: string; seatRole: string }[] } | null }>("/api/platform/me"),
    ]).then(([rows, profile]) => {
      if (!current) return
      setAssignmentRows(rows)
      setAssignmentMembers((profile.org?.members || []).filter((member): member is { accountId: string; name: string; seatRole: string } => Boolean(member.accountId) && ["sahe", "layihe"].includes(member.seatRole)).map((member) => ({ accountId: member.accountId, name: member.name, seatRole: member.seatRole })))
    }).catch((reason) => {
      if (current) setAssignmentError(reason instanceof ApiError ? reason.message : "Layihə üzvləri yüklənmədi")
    }).finally(() => { if (current) setAssignmentBusy(false) })
    return () => { current = false }
  }, [openId, actor.role])

  async function saveAssignment(event: FormEvent) {
    event.preventDefault()
    if (!open || assignmentBusy) return
    setAssignmentBusy(true)
    setAssignmentError("")
    try {
      const saved = await api<ProjectTransferAssignment>(`/api/projects/${encodeURIComponent(open.id)}/assignments`, { method: "POST", body: JSON.stringify({ accountId: assignmentAccountId, canSendTransfers: assignmentCanSend, canReceiveTransfers: assignmentCanReceive }) })
      setAssignmentRows((rows) => [saved, ...rows.filter((row) => row.accountId !== saved.accountId)])
      setAssignmentAccountId("")
      setAssignmentCanSend(false)
      setAssignmentCanReceive(true)
    } catch (reason) {
      setAssignmentError(reason instanceof ApiError ? reason.message : "Layihə səlahiyyəti saxlanmadı")
    } finally { setAssignmentBusy(false) }
  }

  async function deactivateAssignment(accountId: string) {
    if (!open || assignmentBusy) return
    setAssignmentBusy(true)
    setAssignmentError("")
    try {
      await api(`/api/projects/${encodeURIComponent(open.id)}/assignments/${encodeURIComponent(accountId)}`, { method: "DELETE" })
      setAssignmentRows((rows) => rows.map((row) => row.accountId === accountId ? { ...row, active: false } : row))
    } catch (reason) {
      setAssignmentError(reason instanceof ApiError ? reason.message : "Layihə səlahiyyəti deaktiv edilmədi")
    } finally { setAssignmentBusy(false) }
  }

  function edit(project: Project) {
    setError("")
    setFormId(project.id)
    setForm(passport(project))
  }

  function create() {
    setError("")
    setFormId("")
    setForm(blankProject(actor.name, clients[0]?.name || ""))
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault()
    if (!form || saving) return
    if (!formId) {
      setSaving(true)
      const message = await store.addProject(form)
      setSaving(false)
      setError(message)
      if (!message) setForm(null)
      return
    }
    const message = store.editProject(formId, form)
    setError(message)
    if (!message) setForm(null)
  }

  function saveNote(event: FormEvent) {
    event.preventDefault()
    if (!note) return
    const message = note.id ? store.editProjectNote(note.projectId, note.id, note.text) : store.addProjectNote(note.projectId, note.text)
    setError(message)
    if (!message) setNote(null)
  }

  function savePaper(event: FormEvent) {
    event.preventDefault()
    if (!paper) return
    const message = paper.id ? store.editPaper(paper.id, paper) : store.addPaper(paper)
    setError(message)
    if (!message) setPaper(null)
  }

  const papers = documents.filter((item) => hit(query, item.title, item.kind, projects.find((project) => project.id === item.projectId)?.name || ""))
  const notes = projects.flatMap((project) => project.notes.map((item) => ({ ...item, project }))).filter((item) => hit(query, item.text, item.project.name))

  return (
    <>
      <PageHead kicker={t("page.projects.kicker")} title={t("page.projects.title")} text={t("page.projects.text")}>
        <Button type="button" onClick={create}>
          <Icon name="plus" /> Yeni layihə
        </Button>
      </PageHead>
      <StatGrid>
        <Metric><span>Bütün layihələr</span><strong>{projects.length}</strong></Metric>
        <Metric><span>Aktiv</span><strong>{projects.filter((project) => project.status === "aktiv").length}</strong></Metric>
        <Metric><span>Gecikir</span><strong>{projects.filter((project) => project.status === "gecikir").length}</strong></Metric>
        <Metric><span>Təhvilə yaxın</span><strong>{projects.filter((project) => project.status === "tehvil").length}</strong></Metric>
      </StatGrid>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "reyestr", label: "Reyestr" },
            { id: "kart", label: "Kartlar" },
            { id: "hecm", label: "Həcm" },
            { id: "sened", label: "Sənədlər" },
            { id: "jurnal", label: "Jurnal" },
          ]}
        />
        <SearchInput value={query} onChange={(event) => store.setQuery(event.target.value)} placeholder="Layihə axtar..." />
        {(tab === "kart" || tab === "reyestr") && (
          <Select value={filter} onValueChange={setFilter} options={STATUSES.map((item) => ({ value: item.id, label: item.label }))} ariaLabel="Status" compact />
        )}
        {tab === "sened" && (
          <Button type="button" onClick={() => { setError(""); setPaper({ ...emptyPaper, id: "", projectId: projects[0]?.id || "" }) }}>
            Sənəd
          </Button>
        )}
        {tab === "jurnal" && (
          <Button type="button" onClick={() => { setError(""); setNote({ projectId: projects[0]?.id || "", id: "", text: "" }) }}>
            Qeyd
          </Button>
        )}
        <span className="muted">{tab === "sened" ? papers.length : tab === "jurnal" ? notes.length : rows.length} sətir</span>
      </Toolbar>

      {tab === "kart" && rows.length === 0 && <Empty title="Layihə tapılmadı" text="Yeni layihə açın və ya filtri dəyişin." />}
      {tab === "kart" && (
        <div className="project-grid">
          {rows.map((project) => {
            const burn = project.budget ? Math.round((project.spent / project.budget) * 100) : 0
            return (
              <article key={project.id} className="project-card">
                <div className="card-top">
                  <span className="mono">{project.id}</span>
                  <span className="deal-side">
                    <Badge status={project.status} />
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => edit(project) },
                        { id: "note", label: "Qeyd", onClick: () => { setError(""); setNote({ projectId: project.id, id: "", text: "" }) } },
                        { id: "delete", label: "Sil", onClick: () => store.removeProject(project.id) },
                      ]}
                    />
                  </span>
                </div>
                <Link to={`/layiheler/${project.id}`}>
                  <h3>{project.name}</h3>
                  <p className="muted">
                    {project.district}, {project.city}
                    <br />
                    {project.client}
                  </p>
                  {project.note && <p className="note">{project.note}</p>}
                  <div className="grow">
                    <div className="split">
                      <span className="muted">{project.phase}</span>
                      <span className="mono">{project.progress}%</span>
                    </div>
                    <Meter value={project.progress} tone={project.status === "gecikir" ? "rose" : "copper"} />
                    <div className="split">
                      <span className="muted">Büdcə {moneyShort(project.budget)}</span>
                      <span className="muted">{burn}% xərclənib</span>
                    </div>
                  </div>
                </Link>
              </article>
            )
          })}
        </div>
      )}

      {tab === "reyestr" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th>Sifarişçi</th>
                <th>Mərhələ</th>
                <th>Rəhbər</th>
                <th>Təhvil</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => (
                <tr key={project.id} className="click" onClick={() => setOpenId(project.id)}>
                  <td>
                    <div className="name-cell">
                      <b>{project.name}</b>
                      <span className="muted">{project.id} · {project.district}</span>
                    </div>
                  </td>
                  <td>{project.client}</td>
                  <td>{project.phase}</td>
                  <td>{project.manager}</td>
                  <td className="mono">{dateAZ(project.end)}</td>
                  <td><Badge status={project.status} /></td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => edit(project) },
                        { id: "note", label: "Qeyd", onClick: () => { setError(""); setNote({ projectId: project.id, id: "", text: "" }) } },
                        { id: "delete", label: "Sil", onClick: () => store.removeProject(project.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length === 0 && <Empty title="Layihə tapılmadı" text="Yeni layihə açın və ya filtri dəyişin." />}
        </TableContainer>
      )}

      {tab === "hecm" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th>Mərhələ</th>
                <th>İrəliləyiş</th>
                <th className="num">Sətir</th>
                <th className="num">Açıq</th>
              </tr>
            </thead>
            <tbody>
              {projects.filter((item) => hit(query, item.name, item.phase, item.client)).map((project) => {
                const lines = smetas.find((item) => item.projectId === project.id)?.lines || []
                const openLines = lines.filter((line) => line.qty - line.doneQty > 0.05).length
                return (
                  <tr key={project.id} className="click" onClick={() => setOpenId(project.id)}>
                    <td>
                      <div className="name-cell">
                        <b>{project.name}</b>
                        <span className="muted">{project.client}</span>
                      </div>
                    </td>
                    <td>{project.phase}</td>
                    <td style={{ minWidth: 140 }}>
                      <Meter value={project.progress} tone={project.status === "gecikir" ? "rose" : "copper"} />
                      <span className="muted">{project.progress}%</span>
                    </td>
                    <td className="num">{lines.length}</td>
                    <td className="num">{openLines}</td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        </TableContainer>
      )}

      {tab === "sened" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Sənəd</th>
                <th>Layihə</th>
                <th>Tarix</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {papers.map((doc) => {
                const project = projects.find((item) => item.id === doc.projectId)
                return (
                  <tr key={doc.id}>
                    <td>
                      <div className="name-cell">
                        <b>{doc.title}</b>
                        <span className="muted">{doc.kind}</span>
                      </div>
                    </td>
                    <td>{project?.name || "—"}</td>
                    <td className="mono">{dateAZ(doc.date)}</td>
                    <td>
                      <span className="deal-actions">
                        <Badge status={doc.status} />
                        {doc.status === "gozleyir" && canSign && (
                          <Button type="button" className="small" onClick={() => store.decideDocument(doc.id, "tesdiq")}>
                            Təsdiqlə
                          </Button>
                        )}
                      </span>
                    </td>
                    <td>
                      <RowMenu
                        items={[
                          { id: "edit", label: "Redaktə", onClick: () => { setError(""); setPaper({ id: doc.id, projectId: doc.projectId, title: doc.title, kind: doc.kind, date: doc.date }) } },
                          { id: "delete", label: "Sil", onClick: () => store.removePaper(doc.id) },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
          {papers.length === 0 && <Empty title="Sənəd yoxdur" text="Yeni sənəd gözləyən statusu ilə açılır." />}
        </TableContainer>
      )}

      {tab === "jurnal" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Tarix</th>
                <th>Layihə</th>
                <th>Qeyd</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {notes.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{dateAZ(item.date)}</td>
                  <td>{item.project.name}</td>
                  <td>{item.text}</td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => { setError(""); setNote({ projectId: item.project.id, id: item.id, text: item.text }) } },
                        { id: "delete", label: "Sil", onClick: () => store.removeProjectNote(item.project.id, item.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {notes.length === 0 && <Empty title="Qeyd yoxdur" text="Layihə jurnalına qeyd yazın." />}
        </TableContainer>
      )}

      {open && (
        <Drawer title={open.name} onClose={() => setOpenId(null)}>
          <div className="form-actions" style={{ justifyContent: "flex-start" }}>
            <Badge status={open.status} />
            <Button type="button" className="small" onClick={() => edit(open)}>
              <Icon name="edit" /> Redaktə
            </Button>
            <Button type="button" className="small ghost" onClick={() => store.removeProject(open.id)}>
              <Icon name="trash" /> Sil
            </Button>
            <Link to={`/layiheler/${open.id}`} className="btn small ghost">Layihəni aç</Link>
          </div>
          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>Sifarişçi</dt>
            <dd>{open.client}</dd>
            <dt>Ünvan</dt>
            <dd>{open.address}, {open.district}, {open.city}</dd>
            <dt>Rəhbər</dt>
            <dd>{open.manager}</dd>
            <dt>Mərhələ</dt>
            <dd>{open.phase}</dd>
            <dt>Sahə</dt>
            <dd>{num(open.area)} m² · {open.floors} mərtəbə</dd>
            <dt>Müddət</dt>
            <dd>{dateAZ(open.start)} — {dateAZ(open.end)}</dd>
            <dt>Büdcə</dt>
            <dd>{money(open.budget)} · xərc {money(open.spent)}</dd>
          </dl>
          <ol className="phases" style={{ marginTop: 16 }}>
            {open.phases.map((phase) => (
              <li key={phase.name} className={phase.current ? "current" : phase.done ? "done" : ""}>
                <i />
                <span>{phase.name}</span>
              </li>
            ))}
          </ol>
          {actor.role === "director" && <section className="form" style={{ marginTop: 22 }}>
            <div>
              <strong>Layihə üzrə transfer səlahiyyəti</strong>
              <p className="muted">Sahə və layihə üzvlərini ayrıca təyin edin. Göndərən və qəbul edən imzaları ayrı hesablardan verilməlidir.</p>
            </div>
            {assignmentBusy && <p className="muted">Yüklənir…</p>}
            {assignmentError && <p className="form-error" role="alert">{assignmentError}</p>}
            {assignmentRows.filter((row) => row.active).map((row) => (
              <div className="check-row" key={row.accountId}>
                <span>{row.name}<small className="muted"> · {row.seatRole} · {[row.canSendTransfers && "Göndərən", row.canReceiveTransfers && "Qəbul edən"].filter(Boolean).join(" + ")}</small></span>
                <Button type="button" className="small ghost" disabled={assignmentBusy} onClick={() => void deactivateAssignment(row.accountId)}>Deaktiv et</Button>
              </div>
            ))}
            <form className="form" onSubmit={(event) => void saveAssignment(event)}>
              <Field label="Şirkət üzvü">
                <Select value={assignmentAccountId} onValueChange={(accountId) => {
                  setAssignmentAccountId(accountId)
                  const assigned = assignmentRows.find((row) => row.accountId === accountId && row.active)
                  setAssignmentCanSend(assigned?.canSendTransfers || false)
                  setAssignmentCanReceive(assigned ? assigned.canReceiveTransfers : true)
                }} options={assignmentMembers.map((member) => ({ value: member.accountId, label: `${member.name} · ${member.seatRole}` }))} placeholder="İstifadəçi seçin" />
              </Field>
              <label className="check-row"><span>Layihə anbarından göndərə bilər</span><Input type="checkbox" checked={assignmentCanSend} onChange={(event) => setAssignmentCanSend(event.target.checked)} /></label>
              <label className="check-row"><span>Layihə anbarına qəbul edə bilər</span><Input type="checkbox" checked={assignmentCanReceive} onChange={(event) => setAssignmentCanReceive(event.target.checked)} /></label>
              <Button type="submit" disabled={assignmentBusy || !assignmentAccountId || (!assignmentCanSend && !assignmentCanReceive)}>Təyinatı saxla</Button>
            </form>
          </section>}
        </Drawer>
      )}

      {form && (
        <Modal title={formId ? "Layihəni yaz" : "Yeni layihə"} onClose={() => setForm(null)} className={formId ? "sheet" : "sheet project-modal"}>
          <form className="form" onSubmit={saveProject}>
            <Field label="Ad">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            {!formId && (
              <Field label="Sifarişçi">
                {clients.length > 0 ? (
                  <Select
                    value={form.client}
                    onValueChange={(client) => setForm({ ...form, client })}
                    options={clients.map((item) => ({ value: item.name, label: item.name }))}
                    placeholder="Sifarişçi seçin"
                  />
                ) : (
                  <Input value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })} />
                )}
              </Field>
            )}
            <Field label="Ünvan">
              <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            <Field label="Rəhbər">
              <Input value={form.manager} onChange={(event) => setForm({ ...form, manager: event.target.value })} />
            </Field>
            <div className="split">
              <Field label="Rayon">
                <Input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} />
              </Field>
              <Field label="Şəhər">
                <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
              </Field>
            </div>
            <div className="split">
              <Field label="Növ">
                <Input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} />
              </Field>
              <Field label="Mərhələ">
                <Input value={form.phase} onChange={(event) => setForm({ ...form, phase: event.target.value })} />
              </Field>
            </div>
            <div className="split">
              <Field label="Mərtəbə">
                <Input type="number" min="0" value={form.floors} onChange={(event) => setForm({ ...form, floors: event.target.value })} />
              </Field>
              <Field label="Sahə, m²">
                <Input type="number" min="0" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
              </Field>
            </div>
            {!formId && (
              <Field label="Büdcə, ₼">
                <Input type="number" min="0" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} />
              </Field>
            )}
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as ProjectStatus })}
                options={[
                  { value: "aktiv", label: "Aktiv" },
                  { value: "gecikir", label: "Gecikir" },
                  { value: "tehvil", label: "Təhvil" },
                  { value: "plan", label: "Plan" },
                ]}
              />
            </Field>
            <div className="split">
              <Field label="Başlanğıc">
                <DateField value={form.start} onChange={(start) => setForm({ ...form, start })} />
              </Field>
              <Field label="Təhvil">
                <DateField value={form.end} onChange={(end) => setForm({ ...form, end })} />
              </Field>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setForm(null)}>Bağla</Button>
              <Button  type="submit" disabled={saving}>{saving ? "Yazılır" : "Saxla"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {note && (
        <Modal title={note.id ? "Qeydi yaz" : "Yeni qeyd"} onClose={() => setNote(null)}>
          <form className="form" onSubmit={saveNote}>
            <Field label="Layihə">
              <Select
                value={note.projectId}
                onValueChange={(value) => setNote({ ...note, projectId: value })}
                options={projects.map((item) => ({ value: item.id, label: item.name }))}
                disabled={Boolean(note.id)}
              />
            </Field>
            <Field label="Mətn">
              <Textarea value={note.text} onChange={(event) => setNote({ ...note, text: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setNote(null)}>Bağla</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}

      {paper && (
        <Modal title={paper.id ? "Sənədi yaz" : "Yeni sənəd"} onClose={() => setPaper(null)}>
          <form className="form" onSubmit={savePaper}>
            <Field label="Layihə">
              <Select value={paper.projectId} onValueChange={(value) => setPaper({ ...paper, projectId: value })} options={projects.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Başlıq">
              <Input value={paper.title} onChange={(event) => setPaper({ ...paper, title: event.target.value })} />
            </Field>
            <div className="split">
              <Field label="Növ">
                <Select
                  value={paper.kind}
                  onValueChange={(value) => setPaper({ ...paper, kind: value })}
                  options={(KINDS.includes(paper.kind) ? KINDS : [paper.kind, ...KINDS]).map((item) => ({ value: item, label: item }))}
                />
              </Field>
              <Field label="Tarix">
                <DateField value={paper.date} onChange={(date) => setPaper({ ...paper, date })} />
              </Field>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setPaper(null)}>Bağla</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
