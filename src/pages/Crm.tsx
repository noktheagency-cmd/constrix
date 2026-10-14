import { useState, type FormEvent } from "react"
import type { Client } from "../domain/types"
import { stages } from "../data"
import { dateAZ, hit, money, moneyShort } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const emptyClient = { name: "", sector: "Development", contact: "", phone: "", email: "", city: "Bakı", value: "" }

export default function Crm() {
  const { t } = usePrefs()
  useTitle(t("page.crm.title"))
  const store = useStore()
  const { query, clients, deals, projects, invoices, contracts, tasks, files, addClient, editClient, removeClient } = store
  const [tab, setTab] = useState("musteri")
  const [modal, setModal] = useState(false)
  const [clientForm, setClientForm] = useState(emptyClient)
  const [editingClient, setEditingClient] = useState("")
  const [error, setError] = useState("")
  const [clientId, setClientId] = useState("")
  const [contractId, setContractId] = useState("")
  const selected = clients.find((item) => item.id === clientId)
  const openContract = contracts.find((item) => item.id === contractId)
  const visibleClients = clients.filter((item) => hit(query, item.name, item.contact, item.city, item.sector, item.id))
  const books = clients
    .map((client) => {
      const jobs = projects.filter((item) => item.client === client.name)
      const openBills = invoices.filter((item) => item.client === client.name && item.status !== "odenilib")
      const pipe = deals.filter((item) => item.client === client.name && item.stage !== "uduzulub")
      const papers = contracts.filter((item) => item.client === client.name)
      return {
        client,
        jobs: jobs.length,
        bills: openBills.reduce((sum, item) => sum + item.amount, 0),
        pipe: pipe.reduce((sum, item) => sum + item.value, 0),
        papers: papers.length,
      }
    })
    .filter((item) => hit(query, item.client.name, item.client.city, item.client.sector))
  const papers = contracts
    .map((contract) => ({ contract, project: projects.find((item) => item.id === contract.projectId) }))
    .filter((item) => hit(query, item.contract.number, item.contract.client, item.project?.name || ""))
  const pipe = deals.filter((item) => item.stage !== "uduzulub").reduce((sum, item) => sum + item.value, 0)

  function openClientForm(client?: Client) {
    setError("")
    setEditingClient(client?.id || "")
    setClientForm(client ? { name: client.name, sector: client.sector, contact: client.contact, phone: client.phone, email: client.email, city: client.city, value: String(client.value) } : emptyClient)
    setModal(true)
  }

  function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = editingClient ? editClient(editingClient, clientForm) : addClient(clientForm)
    setError(message)
    if (!message) {
      setModal(false)
      setEditingClient("")
      setClientForm(emptyClient)
    }
  }

  return (
    <>
      <PageHead kicker={t("page.crm.kicker")} title={t("page.crm.title")} text={t("page.crm.text")}>
        <button type="button" className="btn" onClick={() => openClientForm()}>
          <Icon name="plus" /> Müştəri
        </button>
      </PageHead>

      <section className="statstrip">
        <article>
          <span>Sifarişçi</span>
          <strong>{clients.length}</strong>
          <em>{moneyShort(clients.reduce((sum, item) => sum + item.value, 0))} portfel</em>
        </article>
        <article>
          <span>Açıq sövdə</span>
          <strong>{moneyShort(pipe)}</strong>
          <em>{deals.filter((item) => item.stage !== "uduzulub").length} sövdə</em>
        </article>
        <article>
          <span>Podrat</span>
          <strong>{contracts.length}</strong>
          <em>Müqavilə</em>
        </article>
        <article>
          <span>Açıq faktura</span>
          <strong>{moneyShort(invoices.filter((item) => item.status !== "odenilib").reduce((sum, item) => sum + item.amount, 0))}</strong>
          <em>Ödənilməyən</em>
        </article>
      </section>

      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "musteri", label: "Müştərilər" },
            { id: "muqavile", label: "Müqavilələr" },
            { id: "portfel", label: "Portfel" },
          ]}
        />
        <span className="muted">
          {tab === "muqavile" ? `${papers.length} müqavilə` : tab === "portfel" ? `${books.length} sifarişçi` : `${visibleClients.length} sifarişçi`}
        </span>
      </div>
      {error && !modal && !selected && <p className="form-error">{error}</p>}

      {tab === "musteri" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Şirkət</th>
                <th>Sektor</th>
                <th>Əlaqə</th>
                <th>Şəhər</th>
                <th className="num">Dəyər</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((client) => (
                <tr key={client.id} className="click" onClick={() => setClientId(client.id)}>
                  <td>
                    <div className="name-cell">
                      <b>{client.name}</b>
                      <span className="mono">{client.id}</span>
                    </div>
                  </td>
                  <td>{client.sector}</td>
                  <td>
                    <div className="name-cell">
                      <b>{client.contact}</b>
                      <span className="muted">{client.phone}</span>
                    </div>
                  </td>
                  <td>{client.city}</td>
                  <td className="num">{money(client.value)}</td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => openClientForm(client) },
                        { id: "delete", label: "Sil", onClick: () => { const message = removeClient(client.id); setError(message); if (!message && clientId === client.id) setClientId("") } },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleClients.length === 0 && <Empty title="Müştəri tapılmadı" text="Axtarışı dəyişin və ya yeni müştəri əlavə edin." />}
        </div>
      )}

      {tab === "muqavile" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Müqavilə</th>
                <th>Sifarişçi</th>
                <th>Layihə</th>
                <th className="num">Dəyər</th>
                <th className="num">Avans</th>
                <th className="num">Saxlanc</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((item) => (
                <tr key={item.contract.id} className="click" onClick={() => setContractId(item.contract.id)}>
                  <td><b>{item.contract.number}</b><div className="muted">{dateAZ(item.contract.signed)}</div></td>
                  <td>{item.contract.client}</td>
                  <td>{item.project?.name || "—"}</td>
                  <td className="num">{money(item.contract.value)}</td>
                  <td className="num">{item.contract.advancePct}%</td>
                  <td className="num">{item.contract.retentionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {papers.length === 0 && <Empty title="Müqavilə yoxdur" text="Sövdə müqavilə mərhələsindən layihə açıldıqda müqavilə burada durur." />}
        </div>
      )}

      {tab === "portfel" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sifarişçi</th>
                <th className="num">Layihə</th>
                <th className="num">Müqavilə</th>
                <th className="num">Açıq faktura</th>
                <th className="num">Sövdə</th>
              </tr>
            </thead>
            <tbody>
              {books.map((item) => (
                <tr key={item.client.id} className="click" onClick={() => setClientId(item.client.id)}>
                  <td><b>{item.client.name}</b><div className="muted">{item.client.city}</div></td>
                  <td className="num">{item.jobs}</td>
                  <td className="num">{item.papers}</td>
                  <td className="num">{money(item.bills)}</td>
                  <td className="num">{money(item.pipe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Drawer title={selected.name} onClose={() => setClientId("")}>
          <dl className="kv">
            <dt>Kod</dt><dd className="mono">{selected.id}</dd>
            <dt>Sektor</dt><dd>{selected.sector}</dd>
            <dt>Əlaqə</dt><dd>{selected.contact}</dd>
            <dt>Telefon</dt><dd>{selected.phone}</dd>
            <dt>E-poçt</dt><dd>{selected.email}</dd>
            <dt>Şəhər</dt><dd>{selected.city}</dd>
            <dt>Əməkdaşlıq</dt><dd>{selected.since}</dd>
            <dt>Portfel</dt><dd>{money(selected.value)}</dd>
          </dl>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn ghost" onClick={() => openClientForm(selected)}><Icon name="edit" /> Redaktə</button>
            <button type="button" className="btn ghost" onClick={() => { const message = removeClient(selected.id); setError(message); if (!message) setClientId("") }}><Icon name="trash" /> Sil</button>
          </div>
          {error && <p className="form-error">{error}</p>}
          <p className="block-title">Tapşırıqlar</p>
          <div className="mini-list">
            {tasks.filter((item) => item.client === selected.name && item.status !== "bitdi").length === 0 && <p className="muted">Açıq tapşırıq yoxdur.</p>}
            {tasks.filter((item) => item.client === selected.name && item.status !== "bitdi").map((item) => (
              <article key={item.id} className="split">
                <span>{item.title}</span>
                <Badge status={item.status} />
              </article>
            ))}
          </div>
          <p className="block-title">Sənədlər</p>
          <div className="mini-list">
            {files.filter((item) => item.client === selected.name && item.status !== "arxiv").length === 0 && <p className="muted">Sənəd yoxdur.</p>}
            {files.filter((item) => item.client === selected.name && item.status !== "arxiv").map((item) => (
              <article key={item.id} className="split">
                <span>{item.title}</span>
                <Badge status={item.status} />
              </article>
            ))}
          </div>
          <p className="block-title">Sövdələr</p>
          <div className="mini-list">
            {deals.filter((item) => item.client === selected.name).length === 0 && <p className="muted">Sövdə yoxdur.</p>}
            {deals.filter((item) => item.client === selected.name).map((item) => (
              <article key={item.id}>
                <b>{item.title}</b>
                <p className="muted">{money(item.value)} · {stages.find((stage) => stage.id === item.stage)?.label}</p>
              </article>
            ))}
          </div>
          <p className="block-title">Layihələr</p>
          <div className="mini-list">
            {projects.filter((item) => item.client === selected.name).length === 0 && <p className="muted">Aktiv layihə yoxdur.</p>}
            {projects.filter((item) => item.client === selected.name).map((item) => (
              <article key={item.id}>
                <b>{item.name}</b>
                <p className="muted">{item.phase} · {item.progress}%</p>
              </article>
            ))}
          </div>
          <p className="block-title">Fakturalar</p>
          <div className="mini-list">
            {invoices.filter((item) => item.client === selected.name).length === 0 && <p className="muted">Faktura yoxdur.</p>}
            {invoices.filter((item) => item.client === selected.name).map((item) => (
              <article key={item.id} className="split">
                <span>{item.id}</span>
                <Badge status={item.status} />
              </article>
            ))}
          </div>
        </Drawer>
      )}

      {openContract && (
        <Drawer title={openContract.number} onClose={() => setContractId("")}>
          <div className="form">
            <p><b>{openContract.client}</b> · {projects.find((item) => item.id === openContract.projectId)?.name || "—"}</p>
            <p>İmzalanma {dateAZ(openContract.signed)}. Dəyər {money(openContract.value)}.</p>
            <p>Avans {openContract.advancePct}%. Saxlanc {openContract.retentionPct}%. ƏDV {Math.round(openContract.vat * 100)}%.</p>
            {openContract.schedule.map((row) => (
              <p key={row.id}><b>{row.title}</b> · {dateAZ(row.due)} · {Math.round(row.share * 100)}% · <Badge status={row.status} /></p>
            ))}
          </div>
        </Drawer>
      )}

      {modal && (
        <Modal wide title={editingClient ? "Sifarişçini yaz" : "Yeni müştəri"} onClose={() => setModal(false)}>
          <form className="form cols" onSubmit={submitClient}>
            <Field label="Şirkət">
              <input value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} />
            </Field>
            <Field label="Sektor">
              <Select
                value={clientForm.sector}
                onValueChange={(sector) => setClientForm({ ...clientForm, sector })}
                options={["Development", "Yaşayış", "Kommersiya", "Sənaye", "Dövlət", "Təhsil"].map((item) => ({ value: item, label: item }))}
              />
            </Field>
            <Field label="Əlaqə şəxsi">
              <input value={clientForm.contact} onChange={(event) => setClientForm({ ...clientForm, contact: event.target.value })} />
            </Field>
            <Field label="Telefon">
              <input value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
            </Field>
            <Field label="E-poçt">
              <input value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} />
            </Field>
            <Field label="Şəhər">
              <input value={clientForm.city} onChange={(event) => setClientForm({ ...clientForm, city: event.target.value })} />
            </Field>
            <Field label="Portfel, ₼">
              <input type="number" min="0" value={clientForm.value} onChange={(event) => setClientForm({ ...clientForm, value: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal(false)}>Ləğv et</button>
              <button className="btn" type="submit">Saxla</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
