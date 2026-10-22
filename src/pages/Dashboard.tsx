import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { dateAZ, hit, num } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Meter, Tabs, useTitle } from "../ui"
import { WeatherSummary } from "./Weather"

type Sheet = "project" | "volume" | "report" | "request" | "stock" | "asset" | "journal"

function counts(rows: { label: string; value: number }[]) {
  const max = Math.max(...rows.map((item) => item.value), 1)
  return (
    <div className="bars" aria-hidden="true">
      {rows.map((item) => (
        <div key={item.label} className="bar">
          <div className="bar-fill" style={{ height: item.value ? `${Math.max(8, (item.value / max) * 100)}%` : "0%" }} />
          <span>{item.value} {item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { t } = usePrefs()
  useTitle(t("nav.overview"))
  const { query, projects, smetas, reports, requests, materials, assets, journal, orders, actor } = useStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState("qrafik")
  const [sheet, setSheet] = useState<Sheet>("project")

  const ongoing = projects.filter((item) => item.status !== "plan")
  const avg = projects.length ? Math.round(projects.reduce((sum, item) => sum + item.progress, 0) / projects.length) : 0
  const volumes = projects.map((project) => {
    const lines = smetas.find((item) => item.projectId === project.id)?.lines || []
    const open = lines.filter((line) => line.qty - line.doneQty > 0.05).length
    return { project, lines: lines.length, open }
  })
  const openLines = volumes.reduce((sum, item) => sum + item.open, 0)
  const waiting = reports.filter((item) => item.status === "gonderilib")
  const low = materials.filter((item) => item.qty < item.min)
  const service = assets.filter((item) => item.status === "servis")
  const working = assets.filter((item) => item.status === "sahede" || item.status === "icarede")
  const util = working.length ? Math.round(working.reduce((sum, item) => sum + item.utilization, 0) / working.length) : 0

  const summary = [
    t("dash.ongoing", { count: ongoing.length }),
    low.length ? t("dash.low", { count: low.length }) : null,
    waiting.length ? t("dash.late", { count: waiting.length }) : null,
    service.length ? t("dash.service", { count: service.length }) : null,
  ]
    .filter(Boolean)
    .join(". ")

  const visibleProjects = projects.filter((item) => hit(query, item.name, item.client, item.city, item.district, item.phase, item.manager, item.id))
  const projectName = (id: string) => projects.find((item) => item.id === id)?.name || id

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">{t("dash.place")}</p>
          <h1>{t("dash.hello", { name: actor.name.split(" ")[0] || actor.name })}</h1>
          <p className="lede">{summary}.</p>
        </div>
      </header>

      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "qrafik", label: t("dash.graph") },
            { id: "cedvel", label: t("dash.table") },
          ]}
        />
      </div>

      {tab === "qrafik" && (
        <>
          <section className="statstrip">
            <article>
              <span>{t("dash.live")}</span>
              <strong>{ongoing.length}</strong>
              <em>{t("dash.avg", { count: avg })}</em>
            </article>
            <article>
              <span>{t("dash.openLines")}</span>
              <strong>{openLines}</strong>
              <em>{t("dash.openLinesMeta", { count: volumes.reduce((sum, item) => sum + item.lines, 0) })}</em>
            </article>
            <article>
              <span>{t("dash.waiting")}</span>
              <strong>{waiting.length}</strong>
              <em className={waiting.length ? "warn" : ""}>{t("dash.waitingMeta", { count: waiting.length })}</em>
            </article>
            <article>
              <span>{t("dash.util")}</span>
              <strong>{util}%</strong>
              <em>{t("dash.working", { count: working.length })}</em>
            </article>
          </section>

          <div className="grid-2">
            <WeatherSummary />
            <section className="panel pad">
              <div className="panel-head">
                <h2>{t("dash.projectsChart")}</h2>
                <Link to="/layiheler">Hamısı</Link>
              </div>
              <div className="pipe">
                {visibleProjects.map((project) => (
                  <div key={project.id}>
                    <div className="pipe-top">
                      <span>{project.name}</span>
                      <b>{project.progress}%</b>
                    </div>
                    <div className="pipe-bar">
                      <i style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel pad">
              <div className="panel-head">
                <h2>{t("dash.statusChart")}</h2>
              </div>
              {counts([
                { label: t("status.aktiv"), value: projects.filter((item) => item.status === "aktiv").length },
                { label: t("status.gecikir"), value: projects.filter((item) => item.status === "gecikir").length },
                { label: t("status.tehvil"), value: projects.filter((item) => item.status === "tehvil").length },
                { label: t("status.plan"), value: projects.filter((item) => item.status === "plan").length },
              ])}
            </section>
            <section className="panel pad">
              <div className="panel-head">
                <h2>{t("dash.reportChart")}</h2>
                <Link to="/sahe?tab=gundelik">Hamısı</Link>
              </div>
              {counts([
                { label: t("status.qaralama"), value: reports.filter((item) => item.status === "qaralama").length },
                { label: t("status.gonderilib"), value: reports.filter((item) => item.status === "gonderilib").length },
                { label: t("status.duzelis"), value: reports.filter((item) => item.status === "duzelis").length },
                { label: t("status.tesdiq"), value: reports.filter((item) => item.status === "tesdiq").length },
              ])}
            </section>
            <section className="panel pad">
              <div className="panel-head">
                <h2>{t("dash.requestChart")}</h2>
                <Link to="/anbar">Anbar</Link>
              </div>
              {counts([
                { label: t("status.gozleyir"), value: requests.filter((item) => item.status === "gozleyir").length },
                { label: t("status.teklif"), value: requests.filter((item) => item.status === "teklif").length },
                { label: t("status.sifaris"), value: requests.filter((item) => item.status === "sifaris").length },
                { label: t("status.anbar"), value: requests.filter((item) => item.status === "anbar").length },
                { label: t("status.redd"), value: requests.filter((item) => item.status === "redd").length },
              ])}
            </section>
            <section className="panel pad">
              <div className="panel-head">
                <h2>{t("dash.assetChart")}</h2>
                <Link to="/aktivler">Park</Link>
              </div>
              {counts([
                { label: t("status.sahede"), value: assets.filter((item) => item.status === "sahede").length },
                { label: t("status.icarede"), value: assets.filter((item) => item.status === "icarede").length },
                { label: t("status.bos"), value: assets.filter((item) => item.status === "bos").length },
                { label: t("status.servis"), value: service.length },
              ])}
            </section>
            <section className="panel pad">
              <div className="panel-head">
                <h2>{t("dash.utilChart")}</h2>
                <span className="muted">{orders.filter((item) => item.status === "gedir" || item.status === "novbede").length} iş əmri</span>
              </div>
              <div className="pipe">
                {working.filter((item) => hit(query, item.name, item.site)).map((item) => (
                  <div key={item.id}>
                    <div className="pipe-top">
                      <span>{item.name}</span>
                      <b>{item.utilization}%</b>
                    </div>
                    <div className="pipe-bar">
                      <i style={{ width: `${item.utilization}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "cedvel" && (
        <>
          <div className="toolbar">
            <Tabs
              value={sheet}
              onChange={(value) => setSheet(value as Sheet)}
              options={[
                { id: "project", label: t("dash.sheet.project") },
                { id: "volume", label: t("dash.sheet.volume") },
                { id: "report", label: t("dash.sheet.report") },
                { id: "request", label: t("dash.sheet.request") },
                { id: "stock", label: t("dash.sheet.stock") },
                { id: "asset", label: t("dash.sheet.asset") },
                { id: "journal", label: t("dash.sheet.journal") },
              ]}
            />
          </div>
          <div className="table-wrap">
            {sheet === "project" && (
              <table>
                <thead>
                  <tr>
                    <th>Layihə</th>
                    <th>Sifarişçi</th>
                    <th>Mərhələ</th>
                    <th>Rəhbər</th>
                    <th>İrəliləyiş</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjects.map((project) => (
                    <tr key={project.id} className="click" onClick={() => navigate(`/layiheler/${project.id}`)}>
                      <td>
                        <div className="name-cell">
                          <b>{project.name}</b>
                          <span className="muted">{project.district}, {project.city}</span>
                        </div>
                      </td>
                      <td>{project.client}</td>
                      <td>{project.phase}</td>
                      <td>{project.manager}</td>
                      <td style={{ minWidth: 120 }}>
                        <Meter value={project.progress} tone={project.status === "gecikir" ? "rose" : "copper"} />
                        <span className="muted">{project.progress}%</span>
                      </td>
                      <td><Badge status={project.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sheet === "volume" && (
              <table>
                <thead>
                  <tr>
                    <th>Layihə</th>
                    <th>Mərhələ</th>
                    <th className="num">Sətir</th>
                    <th className="num">Açıq</th>
                    <th>İrəliləyiş</th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.filter((item) => hit(query, item.project.name, item.project.phase)).map((item) => (
                    <tr key={item.project.id}>
                      <td><b>{item.project.name}</b></td>
                      <td>{item.project.phase}</td>
                      <td className="num">{item.lines}</td>
                      <td className="num">{item.open}</td>
                      <td style={{ minWidth: 140 }}>
                        <Meter value={item.project.progress} />
                        <span className="muted">{item.project.progress}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sheet === "report" && (
              <table>
                <thead>
                  <tr>
                    <th>Gündəlik</th>
                    <th>Layihə</th>
                    <th>Tarix</th>
                    <th>Müəllif</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.filter((item) => hit(query, item.id, item.author, projectName(item.projectId), item.note)).map((item) => (
                    <tr key={item.id}>
                      <td className="mono">{item.id}</td>
                      <td>{projectName(item.projectId)}</td>
                      <td className="mono">{dateAZ(item.date)}</td>
                      <td>{item.author}</td>
                      <td><Badge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sheet === "request" && (
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Layihə</th>
                    <th className="num">Miqdar</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.filter((item) => hit(query, item.material, item.project, item.id)).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="name-cell">
                          <b>{item.material}</b>
                          <span className="muted">{item.id}</span>
                        </div>
                      </td>
                      <td>{item.project}</td>
                      <td className="num">{num(item.qty)} {item.unit}</td>
                      <td><Badge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sheet === "stock" && (
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Yer</th>
                    <th className="num">Qalıq</th>
                    <th className="num">Minimum</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.filter((item) => hit(query, item.name, item.location)).map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.name}</b></td>
                      <td>{item.location}</td>
                      <td className="num">{num(item.qty)} {item.unit}</td>
                      <td className="num">{item.qty < item.min ? <b>{num(item.min)}</b> : num(item.min)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sheet === "asset" && (
              <table>
                <thead>
                  <tr>
                    <th>Texnika</th>
                    <th>Sahə</th>
                    <th>Yüklənmə</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.filter((item) => hit(query, item.name, item.site, item.type)).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="name-cell">
                          <b>{item.name}</b>
                          <span className="muted">{item.type}</span>
                        </div>
                      </td>
                      <td>{item.site}</td>
                      <td style={{ minWidth: 120 }}>
                        <Meter value={item.utilization} />
                        <span className="muted">{item.utilization}%</span>
                      </td>
                      <td><Badge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sheet === "journal" && (
              <table>
                <thead>
                  <tr>
                    <th>Vaxt</th>
                    <th>Sahə</th>
                    <th>Qeyd</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.filter((item) => hit(query, item.site, item.text)).map((item) => (
                    <tr key={item.id}>
                      <td className="mono">{item.time}</td>
                      <td>{item.site}</td>
                      <td>{item.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  )
}
