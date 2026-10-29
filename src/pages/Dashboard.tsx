import { DataTable } from '../components/DataTable'
import { Icon } from "../icons"
import { Disclosure, Metric, Panel, SectionHeader, StatGrid, TableContainer, Toolbar } from "../components/primitives"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { dateAZ, hit, num } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Empty, Meter, PageHead, Select, Tabs, useTitle } from "../ui"
import { WeatherSummary } from "./Weather"

type Sheet = "project" | "volume" | "report" | "request" | "stock" | "asset" | "journal"

function counts(rows: { label: string; value: number }[]) {
  const total = rows.reduce((sum, item) => sum + item.value, 0)
  const colors = ["#174ea6", "#f0ad32", "#16825d", "#8654c9", "#d74a62"]
  return <div className="overview-breakdown">{rows.map((item, index) => <div key={item.label} className="overview-breakdown-row">
    <div><span><i style={{ background: colors[index % colors.length] }} />{item.label}</span><b>{item.value}</b></div>
    <div className="overview-track"><i style={{ width: total ? (item.value / total * 100) + "%" : "0%", background: colors[index % colors.length] }} /></div>
  </div>)}</div>
}

function projectImage(name: string) {
  const value = name.toLocaleLowerCase("az")
  if (value.includes("su anbar")) return 0
  if (value.includes("lojistik") || value.includes("anbar")) return 1
  if (value.includes("villa")) return 2
  if (value.includes("klinika")) return 4
  if (value.includes("körpü") || value.includes("metro")) return 5
  return 3
}

export default function Dashboard() {
  const { t } = usePrefs()
  useTitle(t("nav.overview"))
  const { query, projects, smetas, reports, requests, materials, assets, journal, orders } = useStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState("qrafik")
  const [sheet, setSheet] = useState<Sheet>("project")

  const ongoing = projects.filter((item) => item.status === "aktiv" || item.status === "gecikir")
  const delayed = projects.filter((item) => item.status === "gecikir")
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

  const visibleProjects = projects.filter((item) => hit(query, item.name, item.client, item.city, item.district, item.phase, item.manager, item.id))
  const projectName = (id: string) => projects.find((item) => item.id === id)?.name || id

  return (
    <div className="construction-overview">
      <PageHead title="İnşaat icmalı" text="Layihələrin gedişi və diqqət tələb edən işlər."><Link className="btn ghost" to="/layiheler">Layihələrə bax<Icon name="chevron" /></Link></PageHead>

      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "qrafik", label: "İcmal" },
            { id: "cedvel", label: "Məlumat cədvəlləri" },
          ]}
        />
      </Toolbar>

      {tab === "qrafik" && (
        <>
          <StatGrid className="overview-stats">
            <Metric><span className="overview-stat-icon"><Icon name="office" /></span><span>Davam edən layihələr</span><strong>{ongoing.length}</strong><em>Aktiv və gecikən layihələr</em></Metric>
            <Metric><span className="overview-stat-icon"><Icon name="chart" /></span><span>Orta irəliləyiş</span><strong>{avg}%</strong><em>{projects.length} layihə üzrə</em></Metric>
            <Metric><span className="overview-stat-icon"><Icon name="clock" /></span><span>Təsdiq gözləyən gündəliklər</span><strong>{waiting.length}</strong><em>Sahə hesabatları</em></Metric>
          </StatGrid>
            <div className="overview-top-cards">
              <Panel className="overview-attention"><SectionHeader><h2>Diqqət tələb edir</h2></SectionHeader>
                {[
                  { to: "/layiheler", label: "Gecikən layihələr", hint: "Gedişi nəzərdən keçirin", count: delayed.length, icon: "clock" as const, tone: "rose" },
                  { to: "/sahe?tab=gundelik", label: "Təsdiq gözləyən gündəliklər", hint: "Sahə hesabatlarını yoxlayın", count: waiting.length, icon: "files" as const, tone: "gold" },
                  { to: "/anbar", label: "Minimumdan az materiallar", hint: "Anbar ehtiyatlarına baxın", count: low.length, icon: "boxes" as const, tone: "gold" },
                  { to: "/aktivler", label: "Texniki servisdə", hint: "Avadanlıqların vəziyyətini izləyin", count: service.length, icon: "asset" as const, tone: "stone" },
                ].map((item) => <Link key={item.label} to={item.to}><span className={"overview-action-icon " + item.tone}><Icon name={item.icon} /></span><div><strong>{item.label}</strong><span>{item.hint}</span></div><b className={"badge " + (item.count ? item.tone : "stone")}>{item.count}</b><Icon name="chevron" /></Link>)}
              </Panel>
              <Panel className="pad overview-weather-card"><SectionHeader><h2><Icon name="cloud" />Hava və sahə məlumatları</h2></SectionHeader><WeatherSummary compact /></Panel>
            </div>
          <div className="overview-main">
            <Panel className="overview-projects">
              <SectionHeader><h2>Layihələrin gedişi</h2><Link to="/layiheler">Hamısına bax<Icon name="chevron" /></Link></SectionHeader>
              <div className="overview-project-list">
                {[...visibleProjects].sort((a, b) => Number(b.status === "gecikir") - Number(a.status === "gecikir")).slice(0, 6).map((project) => <Link key={project.id} to={"/layiheler/" + project.id} className="overview-project">
                  <span className={"overview-project-photo photo-" + projectImage(project.name)} role="img" aria-label="Layihə üçün nümunə təsvir" />
                  <div className="overview-project-name"><strong>{project.name}</strong><span>{[project.city, project.phase].filter(Boolean).join(" · ")}</span></div>
                  <Badge status={project.status} />
                  <div className="overview-project-progress"><b>{project.progress}%</b><Meter value={project.progress} tone={project.status === "gecikir" ? "rose" : "pine"} /></div>
                  <Icon name="chevron" />
                </Link>)}
                {visibleProjects.length === 0 && <Empty title={projects.length ? "Layihə tapılmadı" : "Hələ layihə yoxdur"} text={projects.length ? "Axtarış sözünü dəyişin." : "Layihələr bölməsindən yeni layihə yaradın."} />}
              </div>
              {visibleProjects.length > 6 && <Link className="overview-more" to="/layiheler">Daha çox layihə<Icon name="chevron" /></Link>}
            </Panel>

          </div>
            <Disclosure title="Əlavə göstəricilər" className="overview-details"><p className="muted overview-details-note">Açıq iş sətirləri: {openLines} · Texnikanın orta yüklənməsi: {util}%</p><div className="grid-2"><Panel className="pad">
              <SectionHeader>
                <h2>{t("dash.statusChart")}</h2>
              </SectionHeader>
              {counts([
                { label: t("status.aktiv"), value: projects.filter((item) => item.status === "aktiv").length },
                { label: t("status.gecikir"), value: projects.filter((item) => item.status === "gecikir").length },
                { label: t("status.tehvil"), value: projects.filter((item) => item.status === "tehvil").length },
                { label: t("status.plan"), value: projects.filter((item) => item.status === "plan").length },
              ])}
            </Panel>
            <Panel className="pad">
              <SectionHeader>
                <h2>{t("dash.reportChart")}</h2>
                <Link to="/sahe?tab=gundelik">Hamısı</Link>
              </SectionHeader>
              {counts([
                { label: t("status.qaralama"), value: reports.filter((item) => item.status === "qaralama").length },
                { label: t("status.gonderilib"), value: reports.filter((item) => item.status === "gonderilib").length },
                { label: t("status.duzelis"), value: reports.filter((item) => item.status === "duzelis").length },
                { label: t("status.tesdiq"), value: reports.filter((item) => item.status === "tesdiq").length },
              ])}
            </Panel>
            <Panel className="pad">
              <SectionHeader>
                <h2>{t("dash.requestChart")}</h2>
                <Link to="/anbar">Anbar</Link>
              </SectionHeader>
              {counts([
                { label: t("status.gozleyir"), value: requests.filter((item) => item.status === "gozleyir").length },
                { label: t("status.teklif"), value: requests.filter((item) => item.status === "teklif").length },
                { label: t("status.sifaris"), value: requests.filter((item) => item.status === "sifaris").length },
                { label: t("status.anbar"), value: requests.filter((item) => item.status === "anbar").length },
                { label: t("status.redd"), value: requests.filter((item) => item.status === "redd").length },
              ])}
            </Panel>
            <Panel className="pad">
              <SectionHeader>
                <h2>{t("dash.assetChart")}</h2>
                <Link to="/aktivler">Park</Link>
              </SectionHeader>
              {counts([
                { label: t("status.sahede"), value: assets.filter((item) => item.status === "sahede").length },
                { label: t("status.icarede"), value: assets.filter((item) => item.status === "icarede").length },
                { label: t("status.bos"), value: assets.filter((item) => item.status === "bos").length },
                { label: t("status.servis"), value: service.length },
              ])}
            </Panel>
            <Panel className="pad">
              <SectionHeader>
                <h2>{t("dash.utilChart")}</h2>
                <span className="muted">{orders.filter((item) => item.status === "gedir" || item.status === "novbede").length} iş əmri</span>
              </SectionHeader>
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
            </Panel></div></Disclosure>
        </>
      )}

      {tab === "cedvel" && (
        <>
          <Toolbar className="overview-table-toolbar"><label>Məlumat növü<Select ariaLabel="Məlumat növü" value={sheet} onValueChange={(value) => setSheet(value as Sheet)} options={[
            { value: "project", label: t("dash.sheet.project") }, { value: "volume", label: t("dash.sheet.volume") }, { value: "report", label: t("dash.sheet.report") }, { value: "request", label: t("dash.sheet.request") }, { value: "stock", label: t("dash.sheet.stock") }, { value: "asset", label: t("dash.sheet.asset") }, { value: "journal", label: t("dash.sheet.journal") },
          ]} /></label></Toolbar>
          <TableContainer>
            {sheet === "project" && (
              <DataTable>
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
              </DataTable>
            )}
            {sheet === "volume" && (
              <DataTable>
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
              </DataTable>
            )}
            {sheet === "report" && (
              <DataTable>
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
              </DataTable>
            )}
            {sheet === "request" && (
              <DataTable>
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
              </DataTable>
            )}
            {sheet === "stock" && (
              <DataTable>
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
              </DataTable>
            )}
            {sheet === "asset" && (
              <DataTable>
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
              </DataTable>
            )}
            {sheet === "journal" && (
              <DataTable>
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
              </DataTable>
            )}
          </TableContainer>
        </>
      )}
    </div>
  )
}
