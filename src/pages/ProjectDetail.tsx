import { Panel, Toolbar } from "../components/primitives"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { dateAZ, money, num } from "../format"
import { useStore } from "../store"
import { Badge, Empty, Meter, Tabs, useTitle } from "../ui"
import { ContractPanel, CostPanel, DocsPanel, PhaseTrack, SmetaPanel } from "./projectParts"

export default function ProjectDetail() {
  const { id } = useParams()
  const { projects, orders, assets } = useStore()
  const project = projects.find((item) => item.id === id)
  const [tab, setTab] = useState("icmal")
  useTitle(project ? project.name : "Layihə")

  if (!project) {
    return (
      <>
        <Link to="/layiheler" className="back">
          Layihələrə qayıt
        </Link>
        <Empty title="Layihə tapılmadı" text="Bu kod üzrə sahə yoxdur." />
      </>
    )
  }

  const burn = Math.round((project.spent / project.budget) * 100)
  const left = project.budget - project.spent
  const siteOrders = orders.filter((item) => item.project === project.name)
  const siteAssets = assets.filter((item) => item.site === project.name)

  return (
    <>
      <Link to="/layiheler" className="back">
        Layihələrə qayıt
      </Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {project.id} · {project.type}
          </p>
          <h1>{project.name}</h1>
          <p className="lede">
            {project.address}, {project.district}, {project.city}. Sifarişçi {project.client}.
          </p>
        </div>
        <Badge status={project.status} />
      </header>
      {project.note && <p className="callout">{project.note}. Cədvəl yenidən qurulmalıdır.</p>}
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "icmal", label: "İcmal" },
            { id: "smeta", label: "Smeta" },
            { id: "xerc", label: "Xərc" },
            { id: "muqavile", label: "Müqavilə" },
            { id: "sened", label: "Sənədlər" },
          ]}
        />
      </Toolbar>
      {tab === "smeta" && <SmetaPanel project={project} />}
      {tab === "xerc" && <CostPanel project={project} />}
      {tab === "muqavile" && <ContractPanel project={project} />}
      {tab === "sened" && <DocsPanel project={project} />}
      {tab === "icmal" && (
      <>
      <Panel className="pad">
        <PhaseTrack projectId={project.id} phases={project.phases} />
        <Meter value={project.progress} tone={project.status === "gecikir" ? "rose" : "pine"} />
        <p className="muted" style={{ marginTop: 8 }}>
          Smeta üzrə irəliləyiş {project.progress}%
        </p>
      </Panel>

      <div className="grid-2">
        <Panel className="pad">
          <h2>Sahə jurnalı</h2>
          <div className="mini-list">
            {project.notes.map((note) => (
              <article key={note.id}>
                <span className="mono">{dateAZ(note.date)}</span>
                <p>{note.text}</p>
              </article>
            ))}
          </div>
          <p className="block-title">Bu sahəyə iş əmrləri</p>
          {siteOrders.length === 0 && <p className="muted">Açıq istehsal əmri yoxdur.</p>}
          {siteOrders.map((order) => (
            <article key={order.id} className="split" style={{ padding: "8px 0" }}>
              <span>
                {order.product}
                <span className="muted"> · {order.qty} {order.unit}</span>
              </span>
              <Badge status={order.status} />
            </article>
          ))}
        </Panel>
        <div className="stack">
          <Panel className="pad">
            <h2>Büdcə</h2>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Plan</dt>
              <dd>{money(project.budget)}</dd>
              <dt>Xərclənib</dt>
              <dd>{money(project.spent)}</dd>
              <dt>Qalıq</dt>
              <dd>{money(left)}</dd>
              <dt>Mənimsəmə</dt>
              <dd>{burn}%</dd>
            </dl>
            <Meter value={burn} tone={burn > 90 ? "rose" : "copper"} />
          </Panel>
          <Panel className="pad">
            <h2>Pasport</h2>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Rəhbər</dt>
              <dd>{project.manager}</dd>
              <dt>Briqada</dt>
              <dd>{project.crew} nəfər</dd>
              <dt>Sahə</dt>
              <dd>{num(project.area)} m²</dd>
              <dt>Mərtəbə</dt>
              <dd>{project.floors}</dd>
              <dt>Başlanğıc</dt>
              <dd>{dateAZ(project.start)}</dd>
              <dt>Təhvil</dt>
              <dd>{dateAZ(project.end)}</dd>
              <dt>Texnika</dt>
              <dd>{siteAssets.length ? siteAssets.map((item) => item.name).join(", ") : "Təyin edilməyib"}</dd>
            </dl>
          </Panel>
        </div>
      </div>
      </>
      )}
    </>
  )
}
