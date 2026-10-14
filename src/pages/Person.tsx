import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api } from "../api"
import type { Person } from "../domain/types"
import { money } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, PageHead, useTitle } from "../ui"

export default function PersonPage() {
  const { id = "" } = useParams()
  const { t } = usePrefs()
  const store = useStore()
  const local = store.people.find((item) => item.id === id)
  const [remote, setRemote] = useState<Person | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (local) return
    let gone = false
    api<Person>(`/api/platform/people/${id}`)
      .then((row) => {
        if (!gone) setRemote(row)
      })
      .catch(() => {
        if (!gone) setMissing(true)
      })
    return () => {
      gone = true
    }
  }, [id, local])

  const person = local ?? remote
  useTitle(person?.name || "İşçi")
  const department = store.departments.find((item) => item.id === person?.departmentId)

  if (!person) {
    return (
      <section className="panel pad">
        <PageHead kicker="Kadr" title={missing ? "İşçi tapılmadı" : "İşçi"} />
        <Link to="/isciler">İşçilərə qayıt</Link>
      </section>
    )
  }

  return (
    <div className="firm">
      <header className="firm-hero">
        <div>
          <p>{person.role || "İşçi"}</p>
          <h1>{person.name}</h1>
          <span>{person.site}</span>
        </div>
        <div className="firm-side">
          <Badge status={person.status} />
          <Link to="/isciler">İşçilərə qayıt</Link>
        </div>
      </header>
      <section className="firm-facts">
        <article><span>Vəzifə</span><strong>{person.role || "—"}</strong></article>
        <article><span>Şöbə</span><strong>{department?.name || "—"}</strong></article>
        <article><span>Maaş</span><strong>{money(Number(person.salary) || 0)}</strong></article>
      </section>
      <section className="firm-grid">
        <article>
          <h2>Əlaqə</h2>
          <Row label="Telefon" value={person.phone} />
          <Row label="E-poçt" value={person.email} />
          <Row label="Kart" value={person.card} />
        </article>
        <article>
          <h2>İş</h2>
          <Row label="Yer" value={`${person.site}${person.placeKind ? ` · ${t(`place.${person.placeKind}`)}` : ""}`} />
          <Row label="Briqada" value={person.crew} />
          <Row label="İşə qəbul" value={person.hired} />
          <Row label="FİN" value={person.pin} />
        </article>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null
  return <div className="firm-row"><span>{label}</span><strong>{value}</strong></div>
}
