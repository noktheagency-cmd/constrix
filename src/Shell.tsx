import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { can } from "./domain/access"
import { TODAY } from "./domain/ops"
import { usePrefs, type Lang } from "./i18n"
import { addDays, dateAZ } from "./format"
import { Icon } from "./icons"
import Login from "./Login"
import { MODULES, MODULE_NAV, firstModulePath, moduleFromPath, type ModuleId } from "./nav"
import { kindLabel, showPath, type CompanyKind } from "./procure/engine"
import { useProcure } from "./procure/store"
import { useStore } from "./store"
import { api } from "./api"
import { chooseOrg, CompanyGate, loadAccountOrgs, orgKind, orgMark, resetOrgs, useOrgs, type AccountOrg } from "./orgs"

const LANGS: Lang[] = ["az", "en", "ru"]

export default function Shell() {
  const { query, setQuery, notice, materials, invoices, assets, trips, fleetDocs, purchaseOrders, reports, tasks, files, actor, allowed } = useStore()
  const procure = useProcure()
  const orgs = useOrgs()
  const companyKind = procure.companies.find((item) => item.id === procure.activeId)?.kind ?? ""
  const { t, theme, toggleTheme, lang, setLang, navOpen, setNavOpen, toggleNav, signedIn, signOut, home, setHome, notices } = usePrefs()
  const [bell, setBell] = useState(false)
  const [profile, setProfile] = useState(false)
  const [langs, setLangs] = useState(false)
  const [hideCompany, setHideCompany] = useState(false)
  const [orgOpen, setOrgOpen] = useState(false)
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 960px)").matches)
  const [moduleId, setModuleId] = useState<ModuleId>(() => moduleFromPath(window.location.pathname, home))
  const [openId, setOpenId] = useState<ModuleId | null>(() => moduleFromPath(window.location.pathname, home))
  const [flyout, setFlyout] = useState<ModuleId | null>(null)
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [glide, setGlide] = useState(false)
  const [locked, setLocked] = useState<ModuleId[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const hideFly = useRef<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [seenPath, setSeenPath] = useState(location.pathname)
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname)
    setBell(false)
    setProfile(false)
    setLangs(false)
    setOrgOpen(false)
    setFlyout(null)
    if (narrow) setNavOpen(false)
    const next = moduleFromPath(location.pathname, moduleId)
    if (next !== moduleId) setModuleId(next)
    setOpenId(next)
  }

  const docHorizon = addDays(TODAY, 14)
  const alerts = [
    ...(notices.doc ? fleetDocs : [])
      .filter((item) => item.expires <= docHorizon)
      .map((item) => ({
        id: item.id,
        to: "/aktivler",
        title: t("alert.doc", { name: assets.find((asset) => asset.id === item.assetId)?.name || item.assetId }),
        meta: dateAZ(item.expires),
      })),
    ...(notices.doc ? files : [])
      .filter((item) => item.due && item.due <= docHorizon && item.status !== "tesdiq" && item.status !== "arxiv")
      .map((item) => ({
        id: item.id,
        to: "/senedler",
        title: t("alert.doc", { name: item.title }),
        meta: dateAZ(item.due),
      })),
    ...(notices.task ? tasks : [])
      .filter((item) => item.status !== "bitdi" && item.due <= TODAY)
      .map((item) => ({
        id: item.id,
        to: "/tapshiriqlar",
        title: t("alert.task", { name: item.title }),
        meta: item.client || item.owner,
      })),
    ...(notices.trip ? trips : [])
      .filter((item) => item.status === "yolda")
      .map((item) => ({
        id: item.id,
        to: "/aktivler",
        title: t("alert.trip", { name: assets.find((asset) => asset.id === item.assetId)?.name || item.assetId }),
        meta: item.to,
      })),
    ...(notices.service ? assets : [])
      .filter((item) => item.status !== "servis" && item.nextService <= TODAY)
      .map((item) => ({
        id: `${item.id}-service`,
        to: "/aktivler",
        title: t("alert.serviceDue", { name: item.name }),
        meta: item.site,
      })),
    ...(notices.stock ? materials : [])
      .filter((item) => item.qty < item.min)
      .map((item) => ({
        id: item.id,
        to: "/anbar",
        title: t("alert.low", { name: item.name }),
        meta: t("alert.lowMeta", { qty: item.qty, unit: item.unit }),
      })),
    ...(notices.invoice ? invoices : [])
      .filter((item) => item.status === "gecikir")
      .map((item) => ({
        id: item.id,
        to: "/qaimeler",
        title: t("alert.late", { id: item.id }),
        meta: item.client,
      })),
    ...(notices.service ? assets : [])
      .filter((item) => item.status === "servis")
      .map((item) => ({
        id: item.id,
        to: "/aktivler",
        title: t("alert.service", { name: item.name }),
        meta: item.site,
      })),
    ...(notices.transit ? purchaseOrders : [])
      .filter((item) => item.status === "yoldadir")
      .map((item) => ({
        id: item.id,
        to: "/techizat",
        title: t("alert.transit", { id: item.id }),
        meta: item.supplier,
      })),
    ...(notices.report ? reports : [])
      .filter((item) => item.status === "gonderilib")
      .map((item) => ({
        id: item.id,
        to: "/sahe?tab=gundelik",
        title: t("alert.report", { id: item.id }),
        meta: item.author,
      })),
  ]

  const boot = useRef(true)
  useEffect(() => {
    if (!boot.current) return
    boot.current = false
    if (location.pathname === "/" && home !== "insaat" && can(actor.role, "dashboard")) {
      navigate(firstModulePath(home, (area) => can(actor.role, area)), { replace: true })
    }
  }, [actor.role, location.pathname, navigate])

  useEffect(() => {
    if (location.pathname === "/" && !can(actor.role, "dashboard") && can(actor.role, "site")) {
      navigate("/sahe", { replace: true })
    }
  }, [location.pathname, actor.role, navigate])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)")
    const onChange = () => setNarrow(media.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = document.activeElement?.tagName
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === "Escape") {
        setBell(false)
        setFlyout(null)
        setProfile(false)
        setLangs(false)
        setOrgOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    function onPointer(event: globalThis.MouseEvent) {
      const target = event.target as Node
      if (!barRef.current?.contains(target)) {
        setBell(false)
        setProfile(false)
        setLangs(false)
        setOrgOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointer)
    return () => document.removeEventListener("mousedown", onPointer)
  }, [])

  useEffect(() => {
    if (location.pathname === "/ayarlar") return
    setHome(moduleId)
  }, [moduleId, location.pathname, setHome])

  useEffect(() => {
    if (!signedIn) {
      resetOrgs()
      return
    }
    void loadAccountOrgs()
  }, [signedIn])

  useEffect(() => {
    if (!signedIn || !orgs.activeId) return
    api<{ locked: ModuleId[] }>("/api/platform/subscription/state")
      .then((row) => setLocked(row.locked ?? []))
      .catch(() => setLocked([]))
  }, [signedIn, orgs.activeId, location.pathname])

  const navReady = signedIn && orgs.ready && (orgs.orgs.length <= 1 || Boolean(orgs.activeId))
  useEffect(() => {
    if (!navReady) return
    const current = navRef.current
    if (!current) return
    const root: HTMLElement = current
    let frame = 0
    const until = performance.now() + 700
    function measure() {
      const railNow = !navOpen && !narrow
      if (railNow) return
      const active = root.querySelector<HTMLElement>(".nav-pages.open .nav-link.active")
      const box = active?.getBoundingClientRect()
      if (!active || !box || box.height < 8) {
        setPill(null)
        return
      }
      const navBox = root.getBoundingClientRect()
      setPill({
        x: box.left - navBox.left + root.scrollLeft,
        y: box.top - navBox.top + root.scrollTop,
        w: box.width,
        h: box.height,
      })
    }
    function loop() {
      measure()
      if (performance.now() < until) frame = requestAnimationFrame(loop)
    }
    function onEnd(event: Event) {
      const name = (event as TransitionEvent).propertyName
      if (name === "width" || name === "grid-template-rows") measure()
    }
    function onResize() {
      measure()
    }
    const observed = new ResizeObserver(() => measure())
    observed.observe(root)
    loop()
    const glideFrame = requestAnimationFrame(() => setGlide(true))
    const sidebar = root.closest(".sidebar")
    sidebar?.addEventListener("transitionend", onEnd)
    window.addEventListener("resize", onResize)
    return () => {
      observed.disconnect()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(glideFrame)
      sidebar?.removeEventListener("transitionend", onEnd)
      window.removeEventListener("resize", onResize)
    }
  }, [location.pathname, openId, navOpen, narrow, lang, companyKind, navReady])

  useEffect(() => () => {
    if (hideFly.current) window.clearTimeout(hideFly.current)
  }, [])

  function armFly(id: ModuleId) {
    if (hideFly.current) window.clearTimeout(hideFly.current)
    setFlyout(id)
  }

  function scheduleHide() {
    if (hideFly.current) window.clearTimeout(hideFly.current)
    hideFly.current = window.setTimeout(() => setFlyout(null), 140)
  }

  if (!signedIn) return <Login />
  if (!orgs.ready || (orgs.orgs.length > 1 && !orgs.activeId)) return <CompanyGate />

  const rail = !navOpen && !narrow
  const tree = MODULES.map((mod) => {
    const groups = MODULE_NAV[mod.id]
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => allowed(item.area) && showPath(item.to, companyKind)),
      }))
      .filter((group) => group.items.length > 0)
    return { ...mod, groups }
  }).filter((mod) => mod.groups.length > 0)

  function modulePages(mod: (typeof tree)[number]) {
    return mod.groups.map((group) => (
      <div key={group.label}>
        {mod.groups.length > 1 && <div className="nav-group">{t(group.label)}</div>}
        {group.items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} onClick={(event) => { if (locked.includes(mod.id) && mod.id !== "klub") event.preventDefault() }}>
            <span className="nav-dot" aria-hidden="true" />
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </div>
    ))
  }

  function activate(mod: (typeof tree)[number], open: boolean) {
    if (!rail && open && mod.id !== "tender" && mod.id !== "techizat") {
      setOpenId(null)
      return
    }
    const blocked = locked.includes(mod.id) && mod.id !== "klub"
    if (!blocked) navigate(mod.to)
    if (rail) return
    setOpenId(mod.id)
  }

  return (
    <div className={navOpen ? "app" : "app nav-shut"}>
      {narrow && navOpen && <button type="button" className="scrim" aria-label={t("shell.closeMenu")} onClick={() => setNavOpen(false)} />}
      <aside className={navOpen ? "sidebar open" : "sidebar"}>
        <button type="button" className="nav-toggle" aria-label={navOpen ? t("shell.closeMenu") : t("shell.menu")} aria-expanded={navOpen} onClick={toggleNav}>
          <Icon name="chevronLeft" />
        </button>
        <div className="sidebar-body">
          <div className="brand">
            <img className="brand-mark" src="/constrix-mark.svg" alt="" />
            <div className="brand-copy">
              <strong>CONSTRIX</strong>
              <small>Connected construction</small>
            </div>
          </div>
          <nav ref={navRef} className={pill ? "has-pill" : ""}>
            {pill && openId === moduleId && (
              <span className={glide ? "nav-pill glide" : "nav-pill"} style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px, ${pill.y}px)` }} />
            )}
            {tree.length === 0 && <p className="nav-empty">{t("shell.navEmpty")}</p>}
            {tree.map((mod) => {
              const open = !rail && openId === mod.id
              return (
                <div key={mod.id} className={open ? "nav-module open" : "nav-module"}>
                  <div
                    className={mod.id === moduleId ? "nav-mod on" : "nav-mod"}
                    role="link"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => activate(mod, open)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return
                      event.preventDefault()
                      activate(mod, open)
                    }}
                    onMouseEnter={() => {
                      if (!rail) return
                      armFly(mod.id)
                    }}
                    onMouseLeave={() => {
                      if (rail) scheduleHide()
                    }}
                  >
                    <Icon name={mod.icon} />
                    <span>{t(mod.label)}</span>
                    <button
                      type="button"
                      className="nav-chev"
                      aria-label={open ? "Bağla" : "Aç"}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (rail) return
                        setOpenId((current) => (current === mod.id ? null : mod.id))
                      }}
                    >
                      <Icon name="chevron" />
                    </button>
                  </div>
                  <div className={!rail && openId === mod.id ? "nav-pages open" : "nav-pages"}>
                    <div className="nav-pages-clip">
                      <div className="nav-pages-list">{modulePages(mod)}</div>
                    </div>
                  </div>
                  {rail && flyout === mod.id && createPortal(
                    <div
                      className="nav-fly"
                      onMouseEnter={() => {
                        if (hideFly.current) window.clearTimeout(hideFly.current)
                      }}
                      onMouseLeave={scheduleHide}
                    >
                      <strong>{t(mod.label)}</strong>
                      <div className="nav-fly-list">{modulePages(mod)}</div>
                    </div>,
                    document.body,
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </aside>
      <div className="main">
        <div className="work">
          {!companyKind && !hideCompany && (
            <div className="company-banner">
              <button type="button" onClick={() => navigate("/sirket")}>Şirkət qeydiyyatı edilməyib</button>
              <button type="button" className="company-banner-x" aria-label="Bağla" onClick={() => setHideCompany(true)}>
                <Icon name="close" />
              </button>
            </div>
          )}
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" aria-label={navOpen ? t("shell.closeMenu") : t("shell.menu")} aria-expanded={navOpen} onClick={toggleNav}>
              <Icon name="menu" />
            </button>
            <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
              <Icon name="search" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("shell.search")} aria-label={t("shell.searchLabel")} />
              {query ? (
                <button type="button" className="text-btn" onClick={() => setQuery("")}>
                  {t("shell.clear")}
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </form>
            <div className="top-actions" ref={barRef}>
              {orgs.orgs.length > 1 && (
                <OrgSwitch
                  orgs={orgs.orgs}
                  activeId={orgs.activeId}
                  open={orgOpen}
                  onToggle={() => { setOrgOpen((value) => !value); setBell(false); setProfile(false); setLangs(false) }}
                  onPick={(id) => {
                    setOrgOpen(false)
                    const next = orgs.orgs.find((item) => item.id === id)
                    void chooseOrg(id).then(() => {
                      const kind = (next ? orgKind(next.kind) : "") as CompanyKind
                      if (next && !showPath(location.pathname, kind)) navigate("/sirket")
                    })
                  }}
                />
              )}
              <button type="button" className={`icon-btn${theme === "dark" ? " on" : ""}`} aria-label={theme === "dark" ? t("shell.themeLight") : t("shell.themeDark")} onClick={toggleTheme}>
                <Icon name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <LangButton lang={lang} open={langs} onToggle={() => { setLangs((value) => !value); setBell(false); setProfile(false) }} onPick={(next) => { setLang(next); setLangs(false) }} t={t} />
              <div className="bell-wrap">
                <button type="button" className="icon-btn" aria-label={t("shell.alerts")} aria-expanded={bell} onClick={() => { setBell((value) => !value); setProfile(false); setLangs(false) }}>
                  <Icon name="bell" />
                  {alerts.length > 0 && <em>{alerts.length}</em>}
                </button>
                {bell && (
                  <div className="bell-pop">
                    <strong>{t("shell.alertsTitle")}</strong>
                    {alerts.length === 0 && <p>{t("shell.alertsEmpty")}</p>}
                    {alerts.slice(0, 16).map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          setBell(false)
                          navigate(alert.to)
                        }}
                      >
                        <b>{alert.title}</b>
                        <span>{alert.meta}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bell-wrap">
                <button type="button" className="profile-btn" aria-label={t("shell.profile")} aria-expanded={profile} aria-haspopup="menu" onClick={() => { setProfile((value) => !value); setBell(false); setLangs(false) }}>
                  <span className="avatar">{actor.initials}</span>
                  <span className="profile-copy">
                    <strong>{actor.name}</strong>
                    <small>{t(`title.${actor.role}`)}</small>
                  </span>
                  <span className="chev">
                    <Icon name="chevron" />
                  </span>
                </button>
                {profile && (
                  <div className="menu-pop wide" role="menu">
                    <div className="menu-user">
                      <span className="avatar">{actor.initials}</span>
                      <span>
                        <strong>{actor.name}</strong>
                        <small>{t(`role.${actor.role}`)}</small>
                      </span>
                    </div>
                    {allowed("dashboard") && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfile(false)
                          navigate("/kabinet")
                        }}
                      >
                        <Icon name="office" />
                        {t("nav.companyCabinet")}
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfile(false)
                        navigate("/ayarlar")
                      }}
                    >
                      <Icon name="settings" />
                      {t("shell.settings")}
                    </button>
                    <button type="button" role="menuitem" className="danger" onClick={() => { setProfile(false); signOut() }}>
                      <Icon name="logout" />
                      {t("shell.logout")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="content">
            {locked.includes(moduleId) ? (
              <p className="form-error">Bu modul abunə ödənilənə qədər bağlıdır. Abunə səhifəsindən paket seçib ödəniş sənədini qeyd edin.</p>
            ) : (
              <Outlet key={orgs.activeId || "none"} />
            )}
          </div>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}

function OrgSwitch({
  orgs,
  activeId,
  open,
  onToggle,
  onPick,
}: {
  orgs: AccountOrg[]
  activeId: string
  open: boolean
  onToggle: () => void
  onPick: (id: string) => void
}) {
  const active = orgs.find((item) => item.id === activeId) ?? orgs[0]
  if (!active) return null
  return (
    <div className={open ? "org-switch open" : "org-switch"}>
      <button type="button" className="org-switch-btn" aria-haspopup="menu" aria-expanded={open} onClick={onToggle}>
        <span className="org-mark">{orgMark(active.name)}</span>
        <span className="org-copy">
          <strong>{active.name}</strong>
          <small>{kindLabel(orgKind(active.kind))}</small>
        </span>
        <span className="chev"><Icon name="chevron" /></span>
      </button>
      {open && (
        <div className="org-menu" role="menu">
          {orgs.map((org, index) => (
            <button key={org.id} type="button" role="menuitem" className={org.id === activeId ? "on" : ""} style={{ animationDelay: `${index * 40}ms` }} onClick={() => onPick(org.id)}>
              <span className="org-mark">{orgMark(org.name)}</span>
              <span>
                <strong>{org.name}</strong>
                <small>{kindLabel(orgKind(org.kind))}</small>
              </span>
              {org.id === activeId && <Icon name="check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LangButton({
  lang,
  open,
  onToggle,
  onPick,
  t,
}: {
  lang: Lang
  open: boolean
  onToggle: () => void
  onPick: (lang: Lang) => void
  t: (key: string) => string
}) {
  return (
    <div className="bell-wrap">
      <button type="button" className="lang-btn" aria-label={t("shell.language")} aria-expanded={open} aria-haspopup="menu" onClick={onToggle}>
        {lang.toUpperCase()}
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {LANGS.map((item) => (
            <button key={item} type="button" role="menuitem" className={item === lang ? "on" : ""} onClick={() => onPick(item)}>
              {t(`shell.lang.${item}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
