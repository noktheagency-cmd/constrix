import { Button, Input, Metric, StatGrid, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../api"
import { isAway, moveDepartments, PERSON_STATUSES, PLACE_STATUS, placeGroups, placeKindOf } from "../domain/places"
import type { HrMoveForm, HrMoveKind, HrPlace, Person, PersonStatus, StaffForm } from "../domain/types"
import { DateField } from "../DateField"
import { hit, money } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const empty: StaffForm = {
  name: "",
  role: "",
  crew: "",
  phone: "",
  email: "",
  status: "sahede",
  departmentId: "",
  pin: "",
  hired: "2026-09-23",
  salary: "",
  card: "",
  placeKind: "sahe",
  site: "",
}

const working = new Set<PersonStatus>(["sahede", "ofisde", "istehsalda"])

export default function People() {
  const { t } = usePrefs()
  useTitle(t("page.people.title"))
  const store = useStore()
  const [place, setPlace] = useState("hamisi")
  const [statusFilter, setStatusFilter] = useState("hamisi")
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState("")
  const [openId, setOpenId] = useState("")
  const [moveFor, setMoveFor] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [extra, setExtra] = useState<Person[]>([])
  const go = useNavigate()
  useEffect(() => {
    let gone = false
    api<{ directorId: string; people: Person[] }>("/api/platform/people")
      .then((row) => {
        if (gone) return
        const director = row.people.find((item) => item.id === row.directorId)
        if (!director?.name) {
          setExtra([])
          return
        }
        const key = director.name.trim().toLocaleLowerCase("az")
        const known = store.people.some((item) => item.id === director.id || item.name.trim().toLocaleLowerCase("az") === key)
        setExtra(known ? [] : [director])
      })
      .catch(() => {
        if (!gone) setExtra([])
      })
    return () => {
      gone = true
    }
  }, [store.people])
  const groups = placeGroups(store).map((group) => ({ label: t(`place.${group.kind}`), options: group.options }))
  const statuses = PERSON_STATUSES.map((id) => ({ value: id, label: t(`status.${id}`) }))
  const rows = [...extra, ...store.people].filter((item) => {
    const department = store.departments.find((row) => row.id === item.departmentId)
    const placeOk = place === "hamisi" || item.placeKind === place
    const statusOk = statusFilter === "hamisi" || item.status === statusFilter
    return placeOk && statusOk && hit(store.query, item.name, item.role, item.crew, item.site, item.phone, item.email, item.pin, department?.name)
  })
  const selected = store.people.find((item) => item.id === openId)
  const count = (kind: HrPlace) => store.people.filter((item) => item.placeKind === kind).length

  function openForm(person?: Person) {
    setError("")
    setEditing(person?.id || "")
    const firstSite = placeGroups(store).find((group) => group.kind === "sahe")?.options[0]?.value || ""
    setForm(
      person
        ? {
            name: person.name,
            role: person.role,
            crew: person.crew === "—" ? "" : person.crew,
            phone: person.phone === "—" ? "" : person.phone,
            email: person.email === "—" ? "" : person.email,
            status: person.status,
            departmentId: person.departmentId,
            pin: person.pin,
            hired: person.hired,
            salary: String(person.salary || ""),
            card: person.card,
            placeKind: person.placeKind,
            site: person.site,
          }
        : { ...empty, departmentId: store.departments[0]?.id || "", site: firstSite },
    )
    setModal(true)
  }

  function chooseSite(site: string) {
    const placeKind = placeKindOf(store, site)
    setForm({ ...form, site, placeKind, status: working.has(form.status) ? PLACE_STATUS[placeKind] : form.status })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = store.saveStaff(form, editing || undefined)
    setError(message)
    if (!message) setModal(false)
  }

  return (
    <>
      <PageHead kicker={t("page.people.kicker")} title={t("page.people.title")} text={t("page.people.text")}>
        <Button type="button" onClick={() => openForm()}><Icon name="plus" /> İşçi</Button>
      </PageHead>
      <StatGrid>
        <Metric>
          <span>Sahə</span>
          <strong>{count("sahe")}</strong>
          <em>Layihə</em>
        </Metric>
        <Metric>
          <span>Ofis</span>
          <strong>{count("ofis")}</strong>
          <em>{store.offices.length} ünvan</em>
        </Metric>
        <Metric>
          <span>İstehsal</span>
          <strong>{count("istehsal")}</strong>
          <em>Zavod və anbar</em>
        </Metric>
        <Metric>
          <span>Kənarda</span>
          <strong>{store.people.filter((item) => isAway(item.status)).length}</strong>
          <em>Məzuniyyət və sair</em>
        </Metric>
      </StatGrid>
      <Toolbar>
        <Tabs
          value={place}
          onChange={setPlace}
          options={[
            { id: "hamisi", label: "Hamısı" },
            { id: "sahe", label: t("place.sahe") },
            { id: "ofis", label: t("place.ofis") },
            { id: "istehsal", label: t("place.istehsal") },
          ]}
        />
        <Select compact ariaLabel="Status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "hamisi", label: "Bütün statuslar" }, ...statuses]} />
      </Toolbar>
      {error && !modal && <p className="form-error">{error}</p>}
      <TableContainer>
        <table>
          <thead>
            <tr>
              <th>İşçi</th>
              <th>Vəzifə</th>
              <th>Şöbə</th>
              <th>Yer</th>
              <th className="num">Maaş</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => {
              const department = store.departments.find((item) => item.id === person.departmentId)
              return (
                <tr key={person.id}>
                  <td>
                    <div className="name-cell">
                      <Link to={`/isciler/${person.id}`} className="person-link"><b>{person.name}</b></Link>
                      <span className="muted">{person.phone}</span>
                    </div>
                  </td>
                  <td>{person.role}</td>
                  <td>{department?.name || "—"}</td>
                  <td>
                    <div className="name-cell">
                      <b>{person.site}</b>
                      <span className="muted">{t(`place.${person.placeKind}`)}</span>
                    </div>
                  </td>
                  <td className="num">{money(person.salary)}</td>
                  <td>
                    <Select
                      compact
                      ariaLabel={person.name}
                      value={person.status}
                      onValueChange={(status) => store.setPersonStatus(person.id, status as PersonStatus)}
                      options={statuses}
                    />
                  </td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "open", label: "Aç", onClick: () => go(`/isciler/${person.id}`) },
                        { id: "move", label: "Köçür", onClick: () => setMoveFor(person.id) },
                        { id: "edit", label: "Redaktə", onClick: () => openForm(person) },
                        { id: "delete", label: "Sil", onClick: () => { const message = store.removeCrew(person.id); setError(message); if (!message && openId === person.id) setOpenId("") } },
                      ]}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="İşçi tapılmadı" text="Filtri və ya axtarışı dəyişin." />}
      </TableContainer>

      {selected && (
        <Drawer title={selected.name} onClose={() => setOpenId("")}>
          <dl className="kv">
            <dt>Vəzifə</dt><dd>{selected.role}</dd>
            <dt>Şöbə</dt><dd>{store.departments.find((item) => item.id === selected.departmentId)?.name || "—"}</dd>
            <dt>Briqada</dt><dd>{selected.crew}</dd>
            <dt>Kateqoriya</dt><dd>{t(`place.${selected.placeKind}`)}</dd>
            <dt>Yer</dt><dd>{selected.site}</dd>
            <dt>Status</dt><dd><Badge status={selected.status} /></dd>
            <dt>Telefon</dt><dd>{selected.phone}</dd>
            <dt>E-poçt</dt><dd>{selected.email}</dd>
            <dt>FİN</dt><dd className="mono">{selected.pin || "—"}</dd>
            <dt>Kart</dt><dd className="mono">{selected.card || "—"}</dd>
            <dt>İşə qəbul</dt><dd>{selected.hired || "—"}</dd>
            <dt>Maaş</dt><dd>{money(selected.salary)}</dd>
          </dl>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <Button type="button" className="ghost" onClick={() => setMoveFor(selected.id)}>Köçür</Button>
            <Button type="button" className="ghost" onClick={() => openForm(selected)}><Icon name="edit" /> Redaktə</Button>
            <Button type="button" className="ghost" onClick={() => { const message = store.removeCrew(selected.id); setError(message); if (!message) setOpenId("") }}><Icon name="trash" /> Sil</Button>
          </div>
        </Drawer>
      )}

      {moveFor !== null && <StaffMoveModal personId={moveFor} onClose={() => setMoveFor(null)} />}

      {modal && (
        <Modal wide title={editing ? "İşçini yaz" : "Yeni işçi"} onClose={() => setModal(false)}>
          <form className="form cols" onSubmit={submit}>
            <Field label="Ad">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Vəzifə">
              <Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />
            </Field>
            <Field label="Şöbə">
              <Select value={form.departmentId} onValueChange={(departmentId) => setForm({ ...form, departmentId })} options={store.departments.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Yer">
              <Select value={form.site} onValueChange={chooseSite} groups={groups} />
            </Field>
            <Field label="Briqada">
              <Input value={form.crew} onChange={(event) => setForm({ ...form, crew: event.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as PersonStatus })} options={statuses} />
            </Field>
            <Field label="Telefon">
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="E-poçt">
              <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="FİN">
              <Input value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value })} />
            </Field>
            <Field label="Kart">
              <Input value={form.card} onChange={(event) => setForm({ ...form, card: event.target.value })} />
            </Field>
            <Field label="İşə qəbul">
              <DateField value={form.hired} onChange={(hired) => setForm({ ...form, hired })} />
            </Field>
            <Field label="Maaş, ₼">
              <Input type="number" min="0" value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setModal(false)}>Ləğv et</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

function StaffMoveModal({ personId, onClose }: { personId: string; onClose: () => void }) {
  const store = useStore()
  const person = store.people.find((item) => item.id === personId)
  const [form, setForm] = useState<HrMoveForm>({ personId, date: "2026-10-11", kind: "tikinti", site: "", departmentId: "", note: "" })
  const [error, setError] = useState("")
  const sites = form.kind === "zavod" ? store.plants.map((item) => item.name) : form.kind === "ofis" ? store.offices.map((item) => item.name) : store.projects.map((item) => item.name)
  const departments = moveDepartments(store, form.kind, form.site)

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = store.moveStaff({ ...form, personId })
    setError(message)
    if (!message) onClose()
  }

  return (
    <Modal title={person ? `${person.name} köçür` : "Köçür"} onClose={onClose}>
      <form className="form cols" onSubmit={submit}>
        <Field label="Növ">
          <Select
            value={form.kind}
            onValueChange={(kind) => setForm({ ...form, kind: kind as HrMoveKind, site: "", departmentId: "" })}
            options={[
              { value: "tikinti", label: "Tikinti" },
              { value: "zavod", label: "Zavod" },
              { value: "ofis", label: "Ofis" },
            ]}
          />
        </Field>
        <Field label="Yer">
          <Select value={form.site} onValueChange={(site) => setForm({ ...form, site, departmentId: "" })} options={sites.map((item) => ({ value: item, label: item }))} />
        </Field>
        <Field label="Şöbə">
          <Select value={form.departmentId} onValueChange={(departmentId) => setForm({ ...form, departmentId })} options={departments.map((item) => ({ value: item.id, label: item.name }))} />
        </Field>
        <Field label="Tarix">
          <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
        </Field>
        <Field label="Qeyd">
          <Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>Ləğv et</Button>
          <Button  type="submit">Köçür</Button>
        </div>
      </form>
    </Modal>
  )
}
