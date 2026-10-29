import { Button, Panel, Toolbar } from "../components/primitives"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { company } from "../data"
import { can } from "../domain/access"
import type { Role } from "../domain/types"
import { usePrefs, type NoticeKey } from "../i18n"
import { MODULES, MODULE_NAV, firstModulePath, type ModuleId } from "../nav"
import { useStore } from "../store"
import { PageHead, Tabs, useTitle } from "../ui"

const NOTICES: NoticeKey[] = ["doc", "task", "trip", "service", "stock", "invoice", "transit", "report"]

export default function Settings() {
  const { t, theme, setTheme, lang, setLang, navOpen, setNavOpen, home, setHome, notices, setNotice, signOut } = usePrefs()
  const { actor, allowed } = useStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState("profil")
  useTitle(t("settings.title"))
  const role = actor.role as Role
  const openModules = MODULES.filter((item) => MODULE_NAV[item.id].some((group) => group.items.some((link) => can(role, link.area))))

  function start(id: ModuleId) {
    setHome(id)
    navigate(firstModulePath(id, allowed))
  }

  return (
    <>
      <PageHead kicker={t("settings.kicker")} title={t("settings.title")} text={t("settings.text")} />
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "profil", label: t("settings.account") },
            { id: "gorunus", label: t("settings.appearance") },
            { id: "bildiris", label: t("settings.notices") },
            { id: "is", label: t("settings.workspace") },
          ]}
        />
      </Toolbar>

      {tab === "profil" && (
        <div className="settings-grid">
          <Panel className="pad">
            <h2>{t("settings.account")}</h2>
            <div className="settings-row start">
              <div>
                <strong>{actor.name}</strong>
                <div className="muted">{t(`title.${actor.role}`)}</div>
              </div>
            </div>
            <div className="settings-row">
              <span className="muted">{t("settings.role")}</span>
              <strong>{t(`role.${actor.role}`)}</strong>
            </div>
            <div className="settings-row">
              <span className="muted">{t("settings.company")}</span>
              <strong>{company.legal}</strong>
            </div>
            <p className="muted">{t("settings.roleNote")}</p>
            <div className="settings-row">
              <span>{t("settings.session")}</span>
              <Button type="button" className="small ghost" onClick={signOut}>{t("shell.logout")}</Button>
            </div>
          </Panel>
          <Panel className="pad">
            <h2>{t("settings.access")}</h2>
            {MODULES.map((item) => {
              const open = openModules.some((module) => module.id === item.id)
              return (
                <div key={item.id} className="settings-row">
                  <span>
                    <b>{t(item.label)}</b>
                    <span className="muted"> · {t(item.hint)}</span>
                  </span>
                  <strong>{open ? t("settings.allowed") : t("settings.blocked")}</strong>
                </div>
              )
            })}
          </Panel>
        </div>
      )}

      {tab === "gorunus" && (
        <Panel className="pad settings-card">
          <h2>{t("settings.appearance")}</h2>
          <div className="settings-row">
            <span>{t("shell.themeLight")}</span>
            <div className="seg" role="group" aria-label={t("settings.appearance")}>
              <button type="button" className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")}>{t("settings.light")}</button>
              <button type="button" className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")}>{t("settings.dark")}</button>
            </div>
          </div>
          <div className="settings-row">
            <span>{t("shell.language")}</span>
            <div className="seg" role="group" aria-label={t("shell.language")}>
              {(["az", "en", "ru"] as const).map((item) => (
                <button key={item} type="button" className={lang === item ? "on" : ""} onClick={() => setLang(item)}>
                  {t(`shell.lang.${item}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <span>{t("settings.sidebar")}</span>
            <div className="seg" role="group" aria-label={t("settings.sidebar")}>
              <button type="button" className={navOpen ? "on" : ""} onClick={() => setNavOpen(true)}>{t("settings.navOpen")}</button>
              <button type="button" className={!navOpen ? "on" : ""} onClick={() => setNavOpen(false)}>{t("settings.navClosed")}</button>
            </div>
          </div>
        </Panel>
      )}

      {tab === "bildiris" && (
        <Panel className="pad settings-card">
          <h2>{t("settings.notices")}</h2>
          <p className="muted">{t("settings.noticesText")}</p>
          {NOTICES.map((key) => (
            <div key={key} className="settings-row">
              <span>{t(`settings.notice.${key}`)}</span>
              <button type="button" className={notices[key] ? "btn small" : "btn small ghost"} onClick={() => setNotice(key, !notices[key])}>
                {notices[key] ? t("settings.allowed") : t("settings.blocked")}
              </button>
            </div>
          ))}
        </Panel>
      )}

      {tab === "is" && (
        <Panel className="pad settings-card">
          <h2>{t("settings.start")}</h2>
          <p className="muted">{t("settings.startText")}</p>
          <div className="module-picks">
            {openModules.map((item) => (
              <button key={item.id} type="button" className={home === item.id ? "module-pick on" : "module-pick"} onClick={() => start(item.id)}>
                <b>{t(item.label)}</b>
                <span>{t(item.hint)}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
