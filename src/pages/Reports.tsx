import { DataTable } from '../components/DataTable'
import { Button, Input, TableContainer, Textarea, Toolbar } from "../components/primitives"
import { useState, type FormEvent } from "react"
import { DateField } from "../DateField"
import type { DailyReport, Weather } from "../domain/types"
import { TODAY } from "../domain/ops"
import { dateAZ, hit, money, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

type Tab = "gundelik" | "hecm" | "tabel" | "texnika" | "qeyd"

type Draft = {
  id: string
  projectId: string
  date: string
  weather: Weather
  crew: string
  note: string
  lines: Record<string, string>
  assetId: string
  hours: string
  attendance: Record<string, string>
  delay: string
  material: string
  photo: string
}

const emptyDraft = (projectId = ""): Draft => ({
  id: "",
  projectId,
  date: TODAY,
  weather: "gunesli",
  crew: "",
  note: "",
  lines: {},
  assetId: "",
  hours: "",
  attendance: {},
  delay: "",
  material: "",
  photo: "",
})

export default function Reports({ embedded = false, projectId }: { embedded?: boolean; projectId?: string }) {
  const { t } = usePrefs()
  useTitle(embedded ? t("page.site.title") : t("page.daily.title"))
  const { query, reports, projects, smetas, people, assets, plants, journal, actor, allowed, saveDaily, removeDaily, submitDaily, returnDaily, approveDaily, addNote, editNote, removeNote } = useStore()
  const [tab, setTab] = useState<Tab>("gundelik")
  const [openId, setOpenId] = useState("")
  const [form, setForm] = useState<Draft | null>(null)
  const [note, setNote] = useState<{ id: string; site: string; text: string } | null>(null)
  const [error, setError] = useState("")
  const canSign = actor.role === "director" || actor.role === "pm"
  const report = reports.find((item) => item.id === openId)
  const projectOf = (id: string) => projects.find((item) => item.id === id)
  const personOf = (id: string) => people.find((item) => item.id === id)
  const assetOf = (id: string) => assets.find((item) => item.id === id)
  const lineOf = (projectId: string, lineId: string) => smetas.find((item) => item.projectId === projectId)?.lines.find((item) => item.id === lineId)

  const scoped = projectId ? reports.filter((item) => item.projectId === projectId) : reports
  const rows = scoped.filter((item) => hit(query, item.id, item.note, item.author, item.date, projectOf(item.projectId)?.name))
  const volumeProjects = projectId ? projects.filter((item) => item.id === projectId) : projects
  const volumes = volumeProjects.flatMap((project) => {
    const lines = smetas.find((item) => item.projectId === project.id)?.lines || []
    return lines.flatMap((line) => {
      const mine = reports.filter((item) => item.projectId === project.id && item.lines.some((row) => row.smetaLineId === line.id))
      if (!mine.length) return []
      const qty = (status: string) => mine.filter((item) => item.status === status).reduce((sum, item) => sum + (item.lines.find((row) => row.smetaLineId === line.id)?.qty || 0), 0)
      const open = mine.filter((item) => item.status !== "tesdiq").reduce((sum, item) => sum + (item.lines.find((row) => row.smetaLineId === line.id)?.qty || 0), 0)
      return [{ project, line, open, signed: qty("tesdiq"), left: Math.max(0, line.qty - line.doneQty) }]
    })
  }).filter((item) => hit(query, item.project.name, item.line.code, item.line.name))
  const times = reports.flatMap((item) => (item.attendance || []).map((row) => ({ report: item, row, person: personOf(row.personId) }))).filter((item) => hit(query, item.person?.name, item.report.id, projectOf(item.report.projectId)?.name))
  const machines = reports.flatMap((item) => item.machines.map((row) => ({ report: item, row, asset: assetOf(row.assetId) }))).filter((item) => hit(query, item.asset?.name, item.report.id, projectOf(item.report.projectId)?.name))
  const notes = journal.filter((item) => hit(query, item.site, item.text, item.id))
  const places = [...new Set([...projects.map((item) => item.name), ...plants.map((item) => item.name), ...journal.map((item) => item.site)])]
  const smeta = smetas.find((item) => item.projectId === form?.projectId)
  const projectName = projectOf(form?.projectId || "")?.name
  const crew = people.filter((item) => (projectName ? item.site === projectName : false) || (form ? form.attendance[item.id] : false))
  const siteAssets = assets.filter((item) => item.status === "sahede" || item.status === "icarede" || item.id === form?.assetId)

  function openTab(next: string) {
    setTab(next as Tab)
    setOpenId("")
    setForm(null)
    setNote(null)
    setError("")
  }

  function startCreate() {
    setError("")
    setOpenId("")
    setForm(emptyDraft(projectId || projects[0]?.id || ""))
  }

  function startEdit(item: DailyReport) {
    const machine = item.machines[0]
    const lines: Record<string, string> = {}
    for (const line of item.lines) lines[line.smetaLineId] = String(line.qty)
    const attendance: Record<string, string> = {}
    for (const row of item.attendance || []) attendance[row.personId] = String(row.hours)
    setError("")
    setOpenId("")
    const take = (label: string) => item.note.match(new RegExp(`${label}: ([^\\n]*)`))?.[1] || ""
    setForm({
      id: item.id,
      projectId: item.projectId,
      date: item.date,
      weather: item.weather,
      crew: String(item.crew || ""),
      note: item.note.replace(/\n?(Gecikmə|Material|Şəkil): [^\n]*/g, "").trim(),
      lines,
      assetId: machine?.assetId || "",
      hours: machine ? String(machine.hours) : "",
      attendance,
      delay: take("Gecikmə"),
      material: take("Material"),
      photo: take("Şəkil"),
    })
  }

  function submitForm(event: FormEvent | { preventDefault: () => void }, send: boolean) {
    event.preventDefault()
    if (!form) return
    const lines = Object.entries(form.lines).filter(([, qty]) => Number(qty) > 0).map(([smetaLineId, qty]) => ({ smetaLineId, qty }))
    const attendance = Object.entries(form.attendance).filter(([, hours]) => Number(hours) > 0).map(([personId, hours]) => ({ personId, hours }))
    const extra = [
      form.delay.trim() ? `Gecikmə: ${form.delay.trim()}` : "",
      form.material.trim() ? `Material: ${form.material.trim()}` : "",
      form.photo.trim() ? `Şəkil: ${form.photo.trim()}` : "",
    ].filter(Boolean)
    const message = saveDaily({
      id: form.id || undefined,
      projectId: form.projectId,
      date: form.date,
      weather: form.weather,
      crew: attendance.length || form.crew,
      note: [form.note.trim(), ...extra].filter(Boolean).join("\n"),
      lines,
      machines: form.assetId ? [{ assetId: form.assetId, hours: form.hours }] : [],
      attendance,
      submit: send,
    })
    setError(message)
    if (!message) {
      const id = form.id
      setForm(null)
      if (id) setOpenId(id)
    }
  }

  function menuFor(item: DailyReport) {
    if (item.status === "qaralama" || item.status === "duzelis") {
      return [
        { id: "edit", label: "Redaktə", onClick: () => startEdit(item) },
        { id: "delete", label: "Sil", onClick: () => { const message = removeDaily(item.id); setError(message); if (!message && openId === item.id) setOpenId("") } },
      ]
    }
    if (item.status === "gonderilib" && canSign) {
      return [{ id: "return", label: "Düzəlişə qaytar", onClick: () => setError(returnDaily(item.id)) }]
    }
    return []
  }

  return (
    <>
      {!embedded && (
        <PageHead kicker={t("page.daily.kicker")} title={t("page.daily.title")} text={t("page.daily.text")}>
          {tab === "qeyd" ? (
            <Button type="button" onClick={() => { setError(""); setNote({ id: "", site: places[0] || "", text: "" }) }}>
              <Icon name="plus" /> Qeyd
            </Button>
          ) : allowed("site") ? (
            <Button type="button" onClick={startCreate}>
              <Icon name="plus" /> Gündəlik
            </Button>
          ) : null}
        </PageHead>
      )}
      {embedded && allowed("site") && (
        <Toolbar  style={{ marginBottom: 8 }}>
          <Button type="button" onClick={startCreate}>
            <Icon name="plus" /> Gündəlik
          </Button>
        </Toolbar>
      )}
      <Toolbar>
        <Tabs
          value={tab}
          onChange={openTab}
          options={[
            { id: "gundelik", label: "Gündəliklər" },
            { id: "hecm", label: "Həcm" },
            { id: "tabel", label: "Tabel" },
            { id: "texnika", label: "Texnika" },
            { id: "qeyd", label: "Qeydlər" },
          ]}
        />
        <span className="muted">
          {tab === "hecm" ? `${volumes.length} iş` : tab === "tabel" ? `${times.length} saat sətri` : tab === "texnika" ? `${machines.length} moto-saat` : tab === "qeyd" ? `${notes.length} qeyd` : `${rows.filter((item) => item.status === "qaralama" || item.status === "duzelis").length} açıq`}
        </span>
      </Toolbar>

      {tab === "gundelik" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Sənəd</th>
                <th>Obyekt</th>
                <th>Hava</th>
                <th className="num">Briqada</th>
                <th>Vəziyyət</th>
                <th>Qeyd</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="click" onClick={() => { setError(""); setOpenId(item.id) }}>
                  <td>
                    <div className="name-cell">
                      <b>{item.id}</b>
                      <span className="muted">{dateAZ(item.date)}</span>
                    </div>
                  </td>
                  <td>{projectOf(item.projectId)?.name || item.projectId}<div className="muted">{item.author}</div></td>
                  <td>{t(`weather.${item.weather}`)}</td>
                  <td className="num">{item.crew}</td>
                  <td><Badge status={item.status} /></td>
                  <td className="clip">{item.note || "—"}</td>
                  <td><RowMenu items={menuFor(item)} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length === 0 && <Empty title="Gündəlik yoxdur" text="Yeni gündəlik açın və ya axtarışı dəyişin." />}
        </TableContainer>
      )}

      {tab === "hecm" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>İş</th>
                <th>Obyekt</th>
                <th className="num">Açıq</th>
                <th className="num">Təsdiq</th>
                <th className="num">Qalıq</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((item) => (
                <tr key={`${item.project.id}-${item.line.id}`}>
                  <td><b>{item.line.code} {item.line.name}</b><div className="muted">{item.line.unit}</div></td>
                  <td>{item.project.name}</td>
                  <td className="num">{num(item.open, 1)}</td>
                  <td className="num">{num(item.signed, 1)}</td>
                  <td className="num">{num(item.left, 1)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {volumes.length === 0 && <Empty title="Həcm yoxdur" text="Gündəlik smeta sətrinə həcm yazılanda burada görünür." />}
        </TableContainer>
      )}

      {tab === "tabel" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>İşçi</th>
                <th>Obyekt</th>
                <th>Tarix</th>
                <th className="num">Saat</th>
                <th>Vəziyyət</th>
              </tr>
            </thead>
            <tbody>
              {times.map((item) => (
                <tr key={`${item.report.id}-${item.row.personId}`} className="click" onClick={() => { setError(""); setTab("gundelik"); setOpenId(item.report.id) }}>
                  <td><b>{item.person?.name || item.row.personId}</b><div className="muted">{item.person?.role}</div></td>
                  <td>{projectOf(item.report.projectId)?.name}</td>
                  <td>{dateAZ(item.report.date)}</td>
                  <td className="num">{num(item.row.hours, 1)}</td>
                  <td><Badge status={item.report.status} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {times.length === 0 && <Empty title="Tabel boşdur" text="Gündəliyə işçi saatı yazılanda burada dayanır." />}
        </TableContainer>
      )}

      {tab === "texnika" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Texnika</th>
                <th>Obyekt</th>
                <th>Tarix</th>
                <th className="num">Moto-saat</th>
                <th>Vəziyyət</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((item) => (
                <tr key={`${item.report.id}-${item.row.assetId}`} className="click" onClick={() => { setError(""); setTab("gundelik"); setOpenId(item.report.id) }}>
                  <td><b>{item.asset?.name || item.row.assetId}</b><div className="muted">{item.asset?.type}</div></td>
                  <td>{projectOf(item.report.projectId)?.name}</td>
                  <td>{dateAZ(item.report.date)}</td>
                  <td className="num">{num(item.row.hours, 1)}</td>
                  <td><Badge status={item.report.status} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {machines.length === 0 && <Empty title="Texnika yoxdur" text="Gündəliyə moto-saat yazılanda burada görünür." />}
        </TableContainer>
      )}

      {tab === "qeyd" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Vaxt</th>
                <th>Obyekt</th>
                <th>Qeyd</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notes.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{item.time}</td>
                  <td>{item.site}</td>
                  <td>{item.text}</td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => { setError(""); setNote({ id: item.id, site: item.site, text: item.text }) } },
                        { id: "delete", label: "Sil", onClick: () => setError(removeNote(item.id)) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {notes.length === 0 && <Empty title="Qeyd yoxdur" text="Sahədən qısa qeyd yazın." />}
        </TableContainer>
      )}

      {report && (
        <Drawer title={projectOf(report.projectId)?.name || report.id} onClose={() => setOpenId("")}>
          <div className="form-actions" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
            <Badge status={report.status} />
            {(report.status === "qaralama" || report.status === "duzelis") && (
              <>
                <Button type="button" className="ghost small" onClick={() => startEdit(report)}><Icon name="edit" /> Redaktə</Button>
                <Button type="button" className="ghost small" onClick={() => { const message = removeDaily(report.id); setError(message); if (!message) setOpenId("") }}><Icon name="trash" /> Sil</Button>
                <Button type="button" className="small" onClick={() => setError(submitDaily(report.id))}>Təsdiqə göndər</Button>
              </>
            )}
            {report.status === "gonderilib" && canSign && (
              <>
                <Button type="button" className="small" onClick={() => setError(approveDaily(report.id))}>Təsdiqlə</Button>
                <Button type="button" className="ghost small" onClick={() => setError(returnDaily(report.id))}>Düzəlişə qaytar</Button>
              </>
            )}
          </div>
          {report.status === "tesdiq" && <p className="muted">Təsdiqlənmiş gündəlik redaktə olunmur və silinmir.</p>}
          {report.status === "gonderilib" && !canSign && <p className="muted">Göndərilmiş gündəlik layihə rəhbərinin təsdiqini gözləyir.</p>}
          <p className="muted">{report.id} · {dateAZ(report.date)} · {t(`weather.${report.weather}`)} · {report.author} · briqada {report.crew}</p>
          {report.note && <p style={{ marginTop: 8 }}>{report.note}</p>}
          <p className="block-title">Həcm</p>
          <div className="mini-list">
            {report.lines.map((line) => {
              const name = lineOf(report.projectId, line.smetaLineId)
              return <article key={line.smetaLineId}>{name ? `${name.code} ${name.name}` : line.smetaLineId} · {num(line.qty, 1)} {name?.unit || ""}</article>
            })}
          </div>
          {(report.attendance?.length || 0) > 0 && (
            <>
              <p className="block-title">Tabel</p>
              <div className="mini-list">
                {report.attendance?.map((row) => (
                  <article key={row.personId}>{personOf(row.personId)?.name || row.personId} · {num(row.hours, 1)} saat</article>
                ))}
              </div>
            </>
          )}
          {report.machines.length > 0 && (
            <>
              <p className="block-title">Texnika</p>
              <div className="mini-list">
                {report.machines.map((row) => (
                  <article key={row.assetId}>{assetOf(row.assetId)?.name || row.assetId} · {num(row.hours, 1)} moto-saat</article>
                ))}
              </div>
            </>
          )}
          {report.status === "tesdiq" && (
            <p className="muted" style={{ marginTop: 12 }}>İşəmuzd {money(report.laborCost || 0)} · texnika {money(report.machineCost || 0)}</p>
          )}
          {error && <p className="form-error">{error}</p>}
        </Drawer>
      )}

      {form && (
        <Modal className="sheet daily-modal" title={form.id ? "Gündəliyi yaz" : "Yeni gündəlik"} onClose={() => setForm(null)}>
          <form className="form daily" onSubmit={(event) => submitForm(event, false)}>
            <div className="daily-span">
              <Field label="Layihə">
                <Select
                  value={form.projectId}
                  onValueChange={(projectId) => setForm({ ...form, projectId, lines: {}, attendance: {} })}
                  options={projects.map((item) => ({ value: item.id, label: item.name }))}
                />
              </Field>
            </div>
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
            </div>
            <div className="daily-span">
              <Field label="Briqada, nəfər">
                <Input value={form.crew} onChange={(event) => setForm({ ...form, crew: event.target.value })} />
              </Field>
            </div>
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
            <div className="split">
              <Field label="Texnika">
                <Select
                  value={form.assetId}
                  onValueChange={(assetId) => setForm({ ...form, assetId })}
                  options={[{ value: "", label: t("none") }, ...siteAssets.map((item) => ({ value: item.id, label: item.name }))]}
                />
              </Field>
              <Field label="Moto-saat">
                <Input type="number" min="0" step="0.5" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
              </Field>
            </div>
            <div className="daily-span">
              <Field label="Görülən iş və qeyd">
                <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
              </Field>
            </div>
            <div className="split">
              <Field label="Material">
                <Input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} placeholder="sərf olunan material" />
              </Field>
              <Field label="Gecikmə">
                <Input value={form.delay} onChange={(event) => setForm({ ...form, delay: event.target.value })} placeholder="səbəb və saat" />
              </Field>
            </div>
            <div className="daily-span">
              <Field label="Şəkil">
                <div className={`photo-field${form.photo ? " has-file" : ""}`}>
                  <input type="file" accept="image/*" capture="environment" onChange={(event) => setForm({ ...form, photo: event.target.files?.[0]?.name || "" })} />
                  <span className="photo-field-btn"><Icon name="image" /> Şəkil seç</span>
                  <span className="photo-field-name">{form.photo || "Fayl seçilməyib"}</span>
                  {form.photo && (
                    <button
                      type="button"
                      className="photo-field-clear"
                      aria-label="Şəkli sil"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        const input = event.currentTarget.parentElement?.querySelector("input")
                        if (input instanceof HTMLInputElement) input.value = ""
                        setForm({ ...form, photo: "" })
                      }}
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </div>
              </Field>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={(event) => submitForm(event, true)}>Təsdiqə göndər</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}

      {note && (
        <Modal title={note.id ? "Qeydi yaz" : "Yeni qeyd"} onClose={() => setNote(null)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = note.id ? editNote(note.id, note.text) : addNote(note.site, note.text)
              setError(message)
              if (!message) setNote(null)
            }}
          >
            {!note.id && (
              <Field label="Obyekt">
                <Select value={note.site} onValueChange={(site) => setNote({ ...note, site })} options={places.map((item) => ({ value: item, label: item }))} />
              </Field>
            )}
            <Field label="Qeyd">
              <Textarea value={note.text} onChange={(event) => setNote({ ...note, text: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
