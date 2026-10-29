import { useState } from "react"

/** Registered partner logos with a readable initials fallback for unbranded demo records. */
export function PartnerMark({ name, logo = "" }: { name: string; logo?: string }) {
  const [failed, setFailed] = useState("")
  const official = /^qala sığorta$/i.test(name.trim()) ? "/partners/qala-insurance.svg" : ""
  const source = logo || official
  const initials = name.replace(/\([^)]*\)/g, "").trim().split(/\s+/).filter(Boolean).slice(0,2).map((word) => word[0]).join("").toLocaleUpperCase("az")
  const color = [...name].reduce((sum, char) => sum + char.charCodeAt(0),0) % 4
  return <span className={`partner-mark partner-mark-${color}`} aria-hidden="true">{source && failed !== source ? <img src={source} alt="" onError={() => setFailed(source)} /> : <span>{initials || "Ş"}</span>}</span>
}
