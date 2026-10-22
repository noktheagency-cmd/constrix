import { useState } from "react"
import { ApiError, api } from "../api"
import { dateAZ } from "../format"
import { Icon } from "../icons"
import { Field, PageHead, Select, useTitle } from "../ui"
import { WEATHER_RULES, patch, uid, useWorkspace, weatherStops, type WeatherLog } from "../workspace"

type Site = {
  id: string
  name: string
  short: string
  place: string
  phase: string
  crew: number
  temp: string
  rain: string
  wind: string
  pouring: boolean
  sky: string
  humidity: string
  note: string
}

type Proof = {
  id: string
  date: string
  site: string
  rain: string
  wind: string
  pouring: boolean
  officer: string
  temp: string
  sky: string
  note: string
}

const OBSERVED = "2026-10-14"

const SITES: Site[] = [
  { id: "PRJ-2408", name: "Port Baku Residence", short: "Port Baku", place: "Yasamal, Bakı", phase: "Fasad", crew: 86, temp: "19", rain: "35", wind: "9", pouring: false, sky: "Qismən buludlu", humidity: "62", note: "Fasad 11–14-cü mərtəbələrdədir. Külək hələ kran həddinin altındadır." },
  { id: "PRJ-2414", name: "Xəzər Business Center", short: "Xəzər", place: "Səbail, Bakı", phase: "Karkas", crew: 64, temp: "18", rain: "48", wind: "11", pouring: false, sky: "Buludlu", humidity: "70", note: "4-cü mərtəbənin plitəsi sabah tökülməlidir. Kran həddinə 1 m/s qalıb." },
  { id: "PRJ-2391", name: "Sumqayıt Lojistik Park", short: "Sumqayıt", place: "Sumqayıt", phase: "Karkas", crew: 48, temp: "17", rain: "42", wind: "13", pouring: false, sky: "Küləkli", humidity: "66", note: "Şimal küləyi kran həddini keçib. Açıq montaj dayanır." },
  { id: "PRJ-2420", name: "Gəncə Şəhər Klinikası", short: "Gəncə", place: "Kəpəz, Gəncə", phase: "Bünövrə", crew: 32, temp: "14", rain: "86", wind: "8", pouring: true, sky: "Yağış", humidity: "91", note: "Açıq beton tökmə dayanıb. Armatur bağlama örtük altında davam edir." },
  { id: "PRJ-2377", name: "Abşeron Villa Qrupu", short: "Abşeron", place: "Mərdəkan", phase: "Tamamlama", crew: 22, temp: "21", rain: "12", wind: "6", pouring: false, sky: "Günəşli", humidity: "54", note: "Təhvil 15 oktyabrdır. Həyət və xarici işlər açıqdır." },
]

const WEEK: Proof[] = [
  { id: "w14", date: "2026-10-14", site: "Bakı", rain: "35", wind: "9", pouring: false, officer: "", temp: "19", sky: "Buludlu", note: "" },
  { id: "w15", date: "2026-10-15", site: "Bakı", rain: "84", wind: "10", pouring: true, officer: "", temp: "17", sky: "Yağış", note: "" },
  { id: "w16", date: "2026-10-16", site: "Bakı", rain: "70", wind: "14", pouring: false, officer: "", temp: "16", sky: "Yağış", note: "" },
  { id: "w17", date: "2026-10-17", site: "Bakı", rain: "38", wind: "8", pouring: false, officer: "", temp: "18", sky: "Buludlu", note: "" },
  { id: "w18", date: "2026-10-18", site: "Bakı", rain: "8", wind: "5", pouring: false, officer: "", temp: "21", sky: "Günəşli", note: "" },
  { id: "w19", date: "2026-10-19", site: "Bakı", rain: "10", wind: "6", pouring: false, officer: "", temp: "22", sky: "Günəşli", note: "" },
  { id: "w20", date: "2026-10-20", site: "Bakı", rain: "20", wind: "16", pouring: false, officer: "", temp: "18", sky: "Külək", note: "" },
]

const PROOFS: Proof[] = [
  { id: "HV-06", date: "2026-10-13", site: "Port Baku Residence", rain: "22", wind: "7", pouring: false, officer: "Rauf Hüseynov", temp: "20", sky: "Qismən buludlu", note: "Fasad quraşdırması tam növbə işlədi." },
  { id: "HV-05", date: "2026-10-12", site: "Xəzər Business Center", rain: "91", wind: "8", pouring: true, officer: "Nigar Əliyeva", temp: "16", sky: "Yağış", note: "Plitə tökməsi səhər dayandırıldı." },
  { id: "HV-04", date: "2026-10-11", site: "Sumqayıt Lojistik Park", rain: "28", wind: "16", pouring: false, officer: "Vüsal Məlikov", temp: "17", sky: "Külək", note: "Açıq sahə bağlandı, anbar içi iş davam etdi." },
  { id: "HV-03", date: "2026-10-10", site: "Gəncə Şəhər Klinikası", rain: "18", wind: "5", pouring: false, officer: "Rauf Hüseynov", temp: "19", sky: "Günəşli", note: "Bünövrə armaturunun ikinci zonası bağlandı." },
  { id: "HV-02", date: "2026-10-09", site: "Abşeron Villa Qrupu", rain: "6", wind: "4", pouring: false, officer: "Vüsal Məlikov", temp: "23", sky: "Günəşli", note: "Tamamlama və həyət işləri plansız getdi." },
  { id: "HV-01", date: "2026-10-08", site: "Port Baku Residence", rain: "88", wind: "13", pouring: true, officer: "Nigar Əliyeva", temp: "15", sky: "Yağış", note: "Kran və fasad dayandı. Qrafikə bir ehtiyat gün yazıldı." },
]

const WEEKDAYS = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"]

function todayISO() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function weekday(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return ""
  return WEEKDAYS[new Date(year, month - 1, day).getDay()] || ""
}

function verdict(rain: string, wind: string, pouring: boolean) {
  return weatherStops(rain, wind, pouring)
}

function reading(site: Site) {
  const wind = Number(site.wind)
  const rain = Number(site.rain)
  if (wind >= 10 && wind < 12) return `Kran həddinə ${12 - wind} m/s qalıb`
  if (rain >= 60 && rain < 80) return `Yağış həddinə ${80 - rain}% qalıb`
  return "Açıq işlər gedir"
}

function cardStatus(item: Site) {
  const rain = Number(item.rain)
  const wind = Number(item.wind)
  if (!verdict(item.rain, item.wind, item.pouring).length) return reading(item)
  if (item.pouring || rain >= 80) return "Yağış həddi keçib"
  if (wind >= 15) return "Açıq sahə dayanır"
  return "Kran və fasad dayanır"
}

function fromLog(item: WeatherLog): Proof {
  return {
    id: item.id,
    date: item.date || todayISO(),
    site: item.site || "Obyekt",
    rain: item.rain,
    wind: item.wind,
    pouring: item.pouring,
    officer: item.officer,
    temp: item.temp || "—",
    sky: item.sky || "",
    note: "",
  }
}

/** İcmal panelində göstərilən qısa hava kartı (xarici proqnoz API yoxdur — əl ilə / nümunə). */
export function WeatherSummary() {
  const { weather } = useWorkspace()
  const [siteId, setSiteId] = useState(SITES[0].id)
  const [officer, setOfficer] = useState(weather.officer || "")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const site = SITES.find((item) => item.id === siteId) ?? SITES[0]
  const held = SITES.filter((item) => verdict(item.rain, item.wind, item.pouring).length)
  const next = WEEK.find((item) => item.date > OBSERVED) || WEEK[1]
  const risk = verdict(site.rain, site.wind, site.pouring)

  async function recordStop() {
    if (!officer.trim()) {
      setError("Dayanma yalnız səlahiyyətli əməkdaşın adı ilə yazılır.")
      return
    }
    setBusy(true)
    setError("")
    const decision = risk.join("; ") || "İş dayanmır"
    const entry = {
      id: uid(),
      rain: site.rain,
      wind: site.wind,
      pouring: site.pouring,
      stop: decision,
      officer: officer.trim(),
      date: todayISO(),
      site: site.name,
      temp: site.temp,
      sky: site.sky,
    }
    patch((state) => ({
      ...state,
      weather: {
        ...state.weather,
        officer: officer.trim(),
        site: site.name,
        rain: site.rain,
        wind: site.wind,
        pouring: site.pouring,
        log: [...state.weather.log, entry],
      },
    }))
    try {
      await api("/api/platform/weather", {
        method: "POST",
        body: JSON.stringify({
          date: todayISO(),
          rainPercent: Number(site.rain),
          windMs: Number(site.wind),
          pouring: site.pouring,
          source: "əl ilə",
          note: `${site.name}: ${decision}. ${officer.trim()}. ${note.trim()}`.trim(),
        }),
      })
      setNote("")
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Qeyd lokal saxlandı; serverə yazılmadı.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel pad">
      <div className="panel-head">
        <h2>Hava</h2>
        <span className="muted">{dateAZ(OBSERVED)}</span>
      </div>
      <p>
        <b>{site.temp}°</b> · {site.sky} · yağış {site.rain}% · külək {site.wind} m/s
      </p>
      <p className="muted">{site.short}: {cardStatus(site)}</p>
      {next && <p className="muted">Sabah: {next.sky || "—"} · yağış {next.rain}% · külək {next.wind} m/s</p>}
      <p className={held.length ? "warn" : "muted"}>
        {held.length ? `${held.length} obyektdə açıq iş dayanma riski` : "Açıq işlər üçün hədd keçilməyib"}
      </p>
      <p className="muted">İş dayanması yalnız səlahiyyətli əməkdaşın qeydi ilə yazılır; hava avtomatik status dəyişmir.</p>
      <Field label="Obyekt">
        <Select value={siteId} onValueChange={setSiteId} options={SITES.map((item) => ({ value: item.id, label: item.short }))} />
      </Field>
      <Field label="Səlahiyyətli">
        <input value={officer} onChange={(event) => setOfficer(event.target.value)} placeholder="Sahə rəisi / SƏTƏM" />
      </Field>
      <Field label="Qeyd">
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Müddət, səbəb" />
      </Field>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void recordStop()}>
          {busy ? "Yazılır" : risk.length ? "Dayanmanı yaz" : "Şəraiti jurnalə yaz"}
        </button>
      </div>
      {weather.log[0] && (
        <p className="muted">Son qeyd: {weather.log[weather.log.length - 1]?.site} · {weather.log[weather.log.length - 1]?.stop}</p>
      )}
    </section>
  )
}

export function WeatherPage() {
  useTitle("Hava")
  const { weather } = useWorkspace()
  const [siteId, setSiteId] = useState(SITES[0].id)
  const [error, setError] = useState("")
  const site = SITES.find((item) => item.id === siteId) ?? SITES[0]
  const stops = verdict(weather.rain, weather.wind, weather.pouring)
  const held = SITES.filter((item) => verdict(item.rain, item.wind, item.pouring).length)
  const journal = [...weather.log].reverse().map(fromLog).concat(PROOFS)
  const reserve = journal.filter((item) => verdict(item.rain, item.wind, item.pouring).length).length

  function choose(id: string) {
    const next = SITES.find((item) => item.id === id)
    if (!next) return
    setSiteId(id)
    setError("")
    patch((state) => ({
      ...state,
      weather: { ...state.weather, rain: next.rain, wind: next.wind, pouring: next.pouring, site: next.name },
    }))
  }

  async function save() {
    if (!weather.officer.trim()) {
      setError("Sübut SƏTƏM məsulunun adı ilə yazılır.")
      return
    }
    setError("")
    const decision = stops.join("; ") || "İş dayanmır"
    patch((state) => ({
      ...state,
      weather: {
        ...state.weather,
        site: site.name,
        log: [...state.weather.log, {
          id: uid(),
          rain: state.weather.rain,
          wind: state.weather.wind,
          pouring: state.weather.pouring,
          stop: decision,
          officer: state.weather.officer.trim(),
          date: todayISO(),
          site: site.name,
          temp: site.temp,
          sky: site.sky,
        }],
      },
    }))
    try {
      await api("/api/platform/weather", {
        method: "POST",
        body: JSON.stringify({
          date: todayISO(),
          rainPercent: Number(weather.rain),
          windMs: Number(weather.wind),
          pouring: weather.pouring,
          source: "əl ilə",
          note: `${site.name}: ${decision}. ${weather.officer.trim()}`,
        }),
      })
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Lokal jurnal yazıldı; serverə düşmədi.")
    }
  }

  return (
    <div className="hava">
      <PageHead
        kicker="SƏTƏM"
        title="Hava və dayanma"
        text="Beş obyektin səhər ölçüsü. Dayanma qrafiki uzadır, sübut kimi qalır və növbəti növbəyə xəbərdarlıqdır."
      />

      <div className="statstrip">
        <article>
          <span>Obyekt</span>
          <strong>{SITES.length}</strong>
          <em>{SITES.reduce((sum, item) => sum + item.crew, 0)} nəfər sahədə</em>
        </article>
        <article>
          <span>Bu gün dayanır</span>
          <strong>{held.length}</strong>
          <em className={held.length ? "warn" : undefined}>{held.length ? held.map((item) => item.short).join(", ") : "Hamısı açıqdır"}</em>
        </article>
        <article>
          <span>Sübut</span>
          <strong>{journal.length}</strong>
          <em>{PROOFS.length} arxiv · {weather.log.length} yeni</em>
        </article>
        <article>
          <span>Dayanma günü</span>
          <strong>{reserve}</strong>
          <em>Jurnaldakı sübutlardan</em>
        </article>
      </div>

      <section className="hava-now">
        <div className="hava-now-top">
          <div className="hava-mark" aria-hidden="true">
            <Icon name={site.sky === "Günəşli" ? "sun" : "cloud"} />
          </div>
          <div>
            <p>Səhər növbəsi · {dateAZ(OBSERVED)}</p>
            <h2>{site.name}</h2>
            <span>{site.place} · {site.phase} · {site.crew} nəfər · {site.sky.toLocaleLowerCase("az")}</span>
          </div>
          <div className="hava-temp">
            <strong>{site.temp}°</strong>
            <em>Səhər ölçüsü</em>
          </div>
        </div>
        <div className="hava-meters">
          <article><span>Yağış ehtimalı</span><strong>{weather.rain || "—"}%</strong></article>
          <article><span>Külək</span><strong>{weather.wind || "—"} m/s</strong></article>
          <article><span>Rütubət</span><strong>{site.humidity}%</strong></article>
          <article><span>Yağış yağır</span><strong>{weather.pouring ? "Bəli" : "Xeyr"}</strong></article>
        </div>
        <p className={stops.length ? "hava-alert" : "hava-ok"}>
          {stops.length ? `Dayanır: ${stops.join("; ")}. Yazılanda qrafikə 1 ehtiyat gün düşür.` : "Bu şəraitdə dayanma yoxdur. Açıq işlər gedir."}
        </p>
      </section>

      <section className="hava-sites" aria-label="Obyektlər">
        {SITES.map((item) => {
          const itemStops = verdict(item.rain, item.wind, item.pouring)
          const on = item.id === site.id
          return (
            <button
              type="button"
              key={item.id}
              className={`hava-site${on ? " on" : ""}${itemStops.length ? " stop" : ""}`}
              onClick={() => choose(item.id)}
              aria-pressed={on}
            >
              <div className="hava-site-top">
                <b>{item.temp}°</b>
                <span className={itemStops.length ? "hava-pill stop" : "hava-pill"}>{itemStops.length ? "Dayanır" : "Açıq"}</span>
              </div>
              <strong>{item.name}</strong>
              <span>{item.place} · {item.phase}</span>
              <span>{item.sky}</span>
              <span className="hava-metrics">{item.rain}% yağış · {item.wind} m/s</span>
              <em>{cardStatus(item)}</em>
            </button>
          )
        })}
      </section>

      <section className="panel pad">
        <div className="panel-head">
          <h2>Bakı, növbəti günlər</h2>
          <span className="muted">Yağış 80% və külək 12 m/s həddi</span>
        </div>
        <div className="hava-week">
          {WEEK.map((day) => {
            const dayStops = verdict(day.rain, day.wind, day.pouring)
            return (
              <article key={day.id} className={dayStops.length ? "stop" : undefined}>
                <span>{day.date === OBSERVED ? "Bu gün" : weekday(day.date)}</span>
                <strong>{Number(day.date.slice(8))}</strong>
                <b>{day.temp}°</b>
                <em>{day.sky}</em>
                <small>{dayStops.length ? "Dayanma" : `Külək ${day.wind} m/s`}</small>
              </article>
            )
          })}
        </div>
      </section>

      <div className="hava-split">
        <section className="panel pad">
          <div className="panel-head">
            <h2>Dayanma qaydası</h2>
          </div>
          <p className="lede">Qayda bütün obyektlərdə eynidir.</p>
          {WEATHER_RULES.map((rule) => (
            <div className="step-row" key={rule.when}>
              <span>{rule.when}</span>
              <strong>{rule.stop}</strong>
            </div>
          ))}
          <p className="hava-note">{site.note}</p>
        </section>

        <section className="panel pad">
          <div className="panel-head">
            <h2>Günü yaz</h2>
            <span className="muted">{site.name}</span>
          </div>
          <div className="form-row wide">
            <label>Obyekt
              <Select value={site.id} onValueChange={choose} options={SITES.map((item) => ({ value: item.id, label: item.name }))} />
            </label>
            <label>Yağış ehtimalı, %
              <input value={weather.rain} onChange={(event) => patch((state) => ({ ...state, weather: { ...state.weather, rain: event.target.value } }))} />
            </label>
            <label>Külək, m/s
              <input value={weather.wind} onChange={(event) => patch((state) => ({ ...state, weather: { ...state.weather, wind: event.target.value } }))} />
            </label>
            <label>Yağış yağır
              <Select
                value={weather.pouring ? "beli" : "xeyr"}
                onValueChange={(value) => patch((state) => ({ ...state, weather: { ...state.weather, pouring: value === "beli" } }))}
                options={[{ value: "xeyr", label: "Xeyr" }, { value: "beli", label: "Bəli" }]}
              />
            </label>
            <label>SƏTƏM məsulu
              <input value={weather.officer} onChange={(event) => patch((state) => ({ ...state, weather: { ...state.weather, officer: event.target.value } }))} />
            </label>
            <button type="button" className="btn" onClick={() => void save()}>Günü yaz</button>
          </div>
          {error && <p className="form-error">{error}</p>}
          <p className="lede">{stops.length ? `Dayanır: ${stops.join("; ")}.` : "Bu rəqəmlərlə dayanma yoxdur."}</p>
        </section>
      </div>

      <section className="panel pad">
        <div className="panel-head">
          <h2>Sübut jurnalı</h2>
          <span className="muted">{journal.length} yazı</span>
        </div>
        <div className="table-wrap flat">
          <table className="hava-table">
            <thead>
              <tr>
                <th>Tarix</th>
                <th>Obyekt</th>
                <th>Hava</th>
                <th>Məsul</th>
                <th>Qərar</th>
              </tr>
            </thead>
            <tbody>
              {journal.map((item) => {
                const itemStops = verdict(item.rain, item.wind, item.pouring)
                return (
                  <tr key={item.id}>
                    <td>{dateAZ(item.date)}</td>
                    <td>
                      <div className="name-cell">
                        <b>{item.site}</b>
                        <span className="muted">{item.note || item.sky}</span>
                      </div>
                    </td>
                    <td>{item.temp === "—" ? "" : `${item.temp}° · `}yağış {item.rain || "—"}% · külək {item.wind || "—"} m/s{item.pouring ? " · yağır" : ""}</td>
                    <td>{item.officer}</td>
                    <td><span className={itemStops.length ? "hava-pill stop" : "hava-pill"}>{itemStops.length ? itemStops.join("; ") : "İş dayanmır"}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
