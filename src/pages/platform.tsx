import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { dateAZ, moneyShort } from "../format"
import { Icon } from "../icons"
import { Confirm, Empty, Meter, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"
import {
  APPROVALS,
  CATEGORIES,
  CHECKS,
  EXTRA_COSTS,
  FIT_LABEL,
  PARTNER_KINDS,
  SEAT_ROLES,
  SPEC_SECTIONS,
  bankTone,
  boqMath,
  guaranteeAmount,
  hoursUntil,
  lineTotal,
  money,
  patch,
  shiftedDay,
  tenderMath,
  uid,
  useWorkspace,
  type Approval,
  type Fit,
  type Partner,
  type Party,
} from "../workspace"
import { ApiError, api, dec, timeInput } from "../api"
import { DateField, DateTimeField } from "../DateField"
import catalogJson from "../template-catalog.json"
import * as XLSX from "xlsx"
import { FILE_ACCEPT } from "../procure/engine"
import { documentText, readProjectFile } from "../procure/read"
import { GEAR_KINDS, METHODS, REGIONS, gearCost, laborQuote, regionMap, regionMaterial, rulesForMethod, type Complexity, type GearBasis, type Method } from "../procure/smeta"

const PARTY_LABEL: Record<Party, string> = {
  podratci: "Podratçı verir",
  esas: "Əsas podratçı verir",
  sifarisci: "Sifarişçi verir",
}

const emptySeat = { name: "", role: SEAT_ROLES[0] }

const SEAT_CODE: Record<string, string> = {
  Direktor: "direktor",
  "Layihə rəhbəri": "layihe",
  "Smeta mühəndisi": "smeta",
  Satınalma: "satinalma",
  Anbardar: "anbardar",
  Mühasib: "muhasib",
  Kadrlar: "kadr",
  Hüquqşünas: "huquq",
  "Sahə rəisi": "sahe",
}

const SEAT_LABEL = Object.fromEntries(Object.entries(SEAT_CODE).map(([label, code]) => [code, label]))

const PARTNER_CODE: Record<string, string> = {
  Bank: "bank",
  Faktorinq: "faktorinq",
  Sığorta: "sigorta",
  POS: "pos",
  "Əmək haqqı kartı": "kart",
}

const PARTNER_LABEL = Object.fromEntries(Object.entries(PARTNER_CODE).map(([label, code]) => [code, label]))

const PASSPORT_KEYS = ["name", "voen", "legalAddress", "actualAddress", "director", "phone", "email", "activity", "permits", "headcount", "fleet", "pastWork", "turnover", "bankAccount"] as const

function markOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "ŞK"
  return words.slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("az")
}

function shown(value: string) {
  const text = value.trim()
  return text || "—"
}

export function CabinetPage() {
  useTitle("Kabinet")
  const { cabinet, seats } = useWorkspace()
  const [seat, setSeat] = useState(emptySeat)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [seatBusy, setSeatBusy] = useState(false)
  const filled = PASSPORT_KEYS.filter((key) => cabinet[key].trim()).length
  const ratio = Math.round((filled / PASSPORT_KEYS.length) * 100)
  const openRoles = SEAT_ROLES.filter((role) => seats.some((item) => item.role === role)).length

  useEffect(() => {
    let live = true
    api<{ org: { name: string; voen: string; code: string; legalAddress: string; actualAddress: string; director: string; phone: string; email: string; directions: string; permits: string; staffCount: number | null; equipmentPark: string; capacity: string; turnoverNote: string; bankDetails: string; members: { id: string; name: string; seatRole: string }[] } | null }>("/api/platform/me")
      .then((data) => {
        if (!live || !data.org) return
        const org = data.org
        patch((state) => ({
          ...state,
          cabinet: {
            ...state.cabinet,
            name: org.name || "",
            voen: org.voen || "",
            code: org.code || "",
            legalAddress: org.legalAddress || "",
            actualAddress: org.actualAddress || "",
            director: org.director || "",
            phone: org.phone || "",
            email: org.email || "",
            activity: org.directions || "",
            permits: org.permits || "",
            headcount: org.staffCount == null ? "" : String(org.staffCount),
            fleet: org.equipmentPark || "",
            pastWork: org.capacity || "",
            turnover: org.turnoverNote || "",
            bankAccount: org.bankDetails || "",
          },
          seats: org.members.map((member) => ({ id: member.id, name: member.name, role: SEAT_LABEL[member.seatRole] || member.seatRole })),
        }))
      })
      .catch((reason) => { if (live) setError(reason instanceof ApiError ? reason.message : "Kabinet oxunmadı") })
    return () => { live = false }
  }, [])

  async function save() {
    setError("")
    setNote("")
    setSaving(true)
    try {
      const org = await api<{ code: string }>("/api/platform/organizations/current", {
        method: "PATCH",
        body: JSON.stringify({
          name: cabinet.name,
          voen: cabinet.voen,
          legalAddress: cabinet.legalAddress,
          actualAddress: cabinet.actualAddress,
          director: cabinet.director,
          phone: cabinet.phone,
          email: cabinet.email,
          directions: cabinet.activity,
          permits: cabinet.permits,
          staffCount: cabinet.headcount,
          equipmentPark: cabinet.fleet,
          capacity: cabinet.pastWork,
          turnoverNote: cabinet.turnover,
          bankDetails: cabinet.bankAccount,
        }),
      })
      patch((state) => ({ ...state, cabinet: { ...state.cabinet, code: org.code || state.cabinet.code } }))
      setNote("Kabinet bazada saxlandı.")
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Kabinet saxlanmadı")
    } finally {
      setSaving(false)
    }
  }

  async function addSeat() {
    if (!seat.name.trim() || seatBusy) return
    setError("")
    setSeatBusy(true)
    try {
      const created = await api<{ id: string; name: string; seatRole: string }>("/api/platform/members", {
        method: "POST",
        body: JSON.stringify({ name: seat.name, seatRole: SEAT_CODE[seat.role] || "sahe" }),
      })
      patch((state) => ({ ...state, seats: [...state.seats, { id: created.id, name: created.name, role: SEAT_LABEL[created.seatRole] || seat.role }] }))
      setSeat(emptySeat)
      setNote("Səlahiyyət bazada saxlandı.")
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Səlahiyyət saxlanmadı")
    } finally {
      setSeatBusy(false)
    }
  }

  return (
    <div className="cabinet">
      <header className="cabinet-mast">
        <div className="cabinet-mark" aria-hidden="true">{markOf(cabinet.name)}</div>
        <div className="cabinet-id">
          <p>Şəxsi kabinet</p>
          <h1>{cabinet.name.trim() || "Şirkət adı yazılmayıb"}</h1>
          <span>{cabinet.activity.trim() || "Fəaliyyət istiqaməti boşdur"}</span>
        </div>
        <div className="cabinet-mast-side">
          <div className="cabinet-code">
            <em>İdentifikasiya</em>
            <strong>{cabinet.code || "Kod yoxdur"}</strong>
          </div>
          <div className="cabinet-meter" aria-label={`${filled} xana doludur`}>
            <span style={{ width: `${ratio}%` }} />
          </div>
          <small>{filled} / {PASSPORT_KEYS.length} xana · {ratio}%</small>
          <button type="button" className="btn" disabled={saving} onClick={() => void save()}>{saving ? "Saxlanır" : "Saxla"}</button>
        </div>
      </header>

      {note && <p className="cabinet-note" role="status">{note}</p>}
      {error && <p className="cabinet-error" role="alert">{error}</p>}

      <section className="cabinet-facts">
        <article><span>VÖEN</span><strong>{shown(cabinet.voen)}</strong></article>
        <article><span>Direktor</span><strong>{shown(cabinet.director)}</strong></article>
        <article><span>İşçi</span><strong>{shown(cabinet.headcount)}</strong></article>
        <article><span>Dövriyyə, AZN</span><strong>{shown(cabinet.turnover)}</strong></article>
      </section>

      <div className="cabinet-body">
        <div className="cabinet-sheets">
          <section className="cabinet-sheet">
            <h2>Hüquqi şəxs</h2>
            <div className="cabinet-fields">
              <label>Hüquqi ad<input value={cabinet.name} onChange={(event) => setCabinet("name", event.target.value)} /></label>
              <label>VÖEN<input value={cabinet.voen} onChange={(event) => setCabinet("voen", event.target.value)} inputMode="numeric" /></label>
              <label className="wide">Hüquqi ünvan<input value={cabinet.legalAddress} onChange={(event) => setCabinet("legalAddress", event.target.value)} /></label>
              <label className="wide">Faktiki ünvan<input value={cabinet.actualAddress} onChange={(event) => setCabinet("actualAddress", event.target.value)} /></label>
            </div>
          </section>
          <section className="cabinet-sheet">
            <h2>Əlaqə</h2>
            <div className="cabinet-fields">
              <label>Direktor<input value={cabinet.director} onChange={(event) => setCabinet("director", event.target.value)} /></label>
              <label>Telefon<input value={cabinet.phone} onChange={(event) => setCabinet("phone", event.target.value)} inputMode="tel" /></label>
              <label className="wide">E-poçt<input value={cabinet.email} onChange={(event) => setCabinet("email", event.target.value)} inputMode="email" /></label>
            </div>
          </section>
          <section className="cabinet-sheet">
            <h2>Fəaliyyət</h2>
            <div className="cabinet-fields">
              <label>İstiqamət<input value={cabinet.activity} onChange={(event) => setCabinet("activity", event.target.value)} /></label>
              <label>İşçi sayı<input value={cabinet.headcount} onChange={(event) => setCabinet("headcount", event.target.value)} inputMode="numeric" /></label>
              <label className="wide">Lisenziya və icazə<textarea value={cabinet.permits} onChange={(event) => setCabinet("permits", event.target.value)} placeholder="sənədin adı" rows={2} /></label>
              <label className="wide">Texnika<textarea value={cabinet.fleet} onChange={(event) => setCabinet("fleet", event.target.value)} rows={2} /></label>
              <label className="wide">Əvvəlki işlər<textarea value={cabinet.pastWork} onChange={(event) => setCabinet("pastWork", event.target.value)} rows={3} /></label>
            </div>
          </section>
          <section className="cabinet-sheet">
            <h2>Uçot</h2>
            <div className="cabinet-fields">
              <label>Dövriyyə, AZN<input value={cabinet.turnover} onChange={(event) => setCabinet("turnover", event.target.value)} /></label>
              <label className="wide">Bank hesabı<textarea value={cabinet.bankAccount} onChange={(event) => setCabinet("bankAccount", event.target.value)} rows={2} /></label>
            </div>
          </section>
          <div className="cabinet-save">
            <button type="button" className="btn" disabled={saving} onClick={() => void save()}>{saving ? "Saxlanır" : "Kabineti saxla"}</button>
          </div>
        </div>

        <aside className="cabinet-seats">
          <div className="cabinet-sheet">
            <h2>Səlahiyyət</h2>
            <p className="cabinet-seat-lead">{seats.length} nəfər · {openRoles} vəzifə doludur</p>
            <div className="seat-add">
              <label>Əməkdaş<input value={seat.name} onChange={(event) => setSeat({ ...seat, name: event.target.value })} /></label>
              <label>Vəzifə<Select value={seat.role} onValueChange={(role) => setSeat({ ...seat, role })} options={SEAT_ROLES.map((item) => ({ value: item, label: item }))} /></label>
              <button type="button" className="btn" disabled={!seat.name.trim() || seatBusy} onClick={() => void addSeat()}>{seatBusy ? "Yazılır" : "Təyin et"}</button>
            </div>
            <ul className="seat-list">
              {SEAT_ROLES.map((role) => {
                const people = seats.filter((item) => item.role === role).map((item) => item.name)
                return (
                  <li key={role} className={people.length ? "on" : ""}>
                    <span>{role}</span>
                    <strong>{people.length ? people.join(", ") : "Boş"}</strong>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

function setCabinet(key: "name" | "voen" | "legalAddress" | "actualAddress" | "director" | "phone" | "email" | "activity" | "permits" | "headcount" | "fleet" | "pastWork" | "turnover" | "bankAccount", value: string) {
  patch((state) => ({ ...state, cabinet: { ...state.cabinet, [key]: value } }))
}

type TenderRow = {
  id: string
  number: string
  link: string
  buyer: string
  subject: string
  classCode: string
  classText: string
  price: unknown
  deadline: unknown
  bidMode: "fixed" | "percent"
  bidValue: unknown
  sme: boolean
  discount: unknown
  advance: unknown
  task: string
  contractDraft: string
  qualification: string
  similar: string
  bondDays: number | null
  performDays: number | null
  opened: boolean
  confirmed: boolean
  checks: { name: string; fit: Fit }[]
  approvals: { role: string; status: Approval }[]
}

function applyTender(row: TenderRow, setNumber: (value: string) => void) {
  setNumber(row.number || "")
  patch((state) => ({
    ...state,
    tender: {
      ...state.tender,
      id: row.id,
      link: row.link || "",
      buyer: row.buyer || "",
      subject: row.subject || "",
      classCode: row.classCode || "",
      classText: row.classText || "",
      price: dec(row.price),
      deadline: timeInput(row.deadline),
      bidMode: row.bidMode === "percent" ? "percent" : "fixed",
      bidValue: dec(row.bidValue),
      sme: row.sme,
      discount: dec(row.discount),
      advance: dec(row.advance),
      task: row.task || "",
      contractDraft: row.contractDraft || "",
      qualification: row.qualification || "",
      similar: row.similar || "",
      bondDays: row.bondDays == null ? "" : String(row.bondDays),
      performDays: row.performDays == null ? "" : String(row.performDays),
      opened: row.opened,
      confirmed: row.confirmed,
      checks: row.checks.map((item) => ({ name: item.name, fit: item.fit })),
      approvals: row.approvals.map((item) => ({ role: item.role, status: item.status })),
    },
  }))
}

type TenderCase = {
  key: string
  savedId: string
  number: string
  link: string
  buyer: string
  place: string
  subject: string
  classCode: string
  classText: string
  price: string
  deadline: string
  bidMode: "fixed" | "percent"
  bidValue: string
  sme: boolean
  discount: string
  advance: string
  task: string
  contractDraft: string
  qualification: string
  similar: string
  bondDays: string
  performDays: string
  opened: boolean
  confirmed: boolean
  checks: { name: string; fit: Fit }[]
  approvals: { role: string; status: Approval }[]
  lots: { name: string; qty: string }[]
}

const TENDER_FIT = (Object.keys(FIT_LABEL) as Fit[]).map((key) => ({ value: key, label: FIT_LABEL[key] }))
const TENDER_APPROVAL = [
  { value: "gozleyir", label: "Gözləyir" },
  { value: "tesdiq", label: "Təsdiq" },
  { value: "geri", label: "Geri qaytarıldı" },
]

function packChecks(partial: Partial<Record<string, Fit>>) {
  return CHECKS.map((name) => ({ name, fit: partial[name] ?? "uygun" }))
}

function packApprovals(partial: Partial<Record<string, Approval>>) {
  return APPROVALS.map((role) => ({ role, status: partial[role] ?? "gozleyir" }))
}

const TENDER_CASES: TenderCase[] = [
  {
    key: "48291",
    savedId: "",
    number: "ET-48291",
    link: "https://etender.gov.az/main/competition/detail/48291",
    buyer: "Bakı Şəhər İcra Hakimiyyəti",
    place: "Yasamal, Bakı",
    subject: "Yasamal məktəbinin əsaslı təmiri",
    classCode: "45210000-2",
    classText: "Məktəb binasının təmiri",
    price: "2480000",
    deadline: "2026-10-17T11:00",
    bidMode: "percent",
    bidValue: "1.5",
    sme: false,
    discount: "4",
    advance: "10",
    task: "TT-Yasamal-məktəb.pdf",
    contractDraft: "Müqavilə layihəsi MH-48291.docx",
    qualification: "İxtisas paketi SX-2026",
    similar: "Akt, 28 saylı məktəb, 2024",
    bondDays: "20",
    performDays: "30",
    opened: true,
    confirmed: false,
    checks: packChecks({ "İşçi təcrübəsi": "gozleyir", "Texnika sənədi": "gozleyir", "İştirak təminatı": "gozleyir" }),
    approvals: packApprovals({ Smetaçı: "tesdiq", "Layihə rəhbəri": "tesdiq" }),
    lots: [
      { name: "Fasad və dam", qty: "1 860 m²" },
      { name: "Pəncərə bloku", qty: "64 ədəd" },
      { name: "Daxili təmir", qty: "2 140 m²" },
    ],
  },
  {
    key: "48310",
    savedId: "",
    number: "ET-48310",
    link: "https://etender.gov.az/main/competition/detail/48310",
    buyer: "Azərişıq ASC",
    place: "Xırdalan",
    subject: "110 kV yarımstansiyanın sahə işləri",
    classCode: "45310000-3",
    classText: "Elektrik avadanlığının quraşdırılması",
    price: "865000",
    deadline: "2026-10-22T15:00",
    bidMode: "fixed",
    bidValue: "12975",
    sme: true,
    discount: "",
    advance: "0",
    task: "TT-yarımstansiya.pdf",
    contractDraft: "Müqavilə layihəsi AZ-48310.docx",
    qualification: "",
    similar: "",
    bondDays: "15",
    performDays: "20",
    opened: true,
    confirmed: false,
    checks: packChecks({ "Oxşar müqavilə": "catismir", "İcra aktı": "catismir", "Keyfiyyət və SƏTƏM": "el" }),
    approvals: packApprovals({ Smetaçı: "tesdiq", Maliyyə: "geri" }),
    lots: [
      { name: "Hasar", qty: "420 m" },
      { name: "Beton meydança", qty: "680 m²" },
      { name: "Qapı və işıq dirəyi", qty: "18 ədəd" },
    ],
  },
  {
    key: "47902",
    savedId: "",
    number: "ET-47902",
    link: "https://etender.gov.az/main/competition/detail/47902",
    buyer: "Sumqayıt Kimya Sənaye Parkı",
    place: "Sumqayıt",
    subject: "Kimya parkında anbar binası",
    classCode: "45213200-5",
    classText: "Anbar binasının tikintisi",
    price: "4120000",
    deadline: "2026-11-04T10:00",
    bidMode: "percent",
    bidValue: "2",
    sme: false,
    discount: "3",
    advance: "15",
    task: "TT-anbar-SKSP.pdf",
    contractDraft: "Müqavilə layihəsi SK-47902.docx",
    qualification: "İxtisas, anbar və metal karkas",
    similar: "Akt, Sumqayıt anbarı, 2025",
    bondDays: "25",
    performDays: "40",
    opened: true,
    confirmed: true,
    checks: packChecks({}),
    approvals: packApprovals({ Smetaçı: "tesdiq", "Layihə rəhbəri": "tesdiq", Maliyyə: "tesdiq", Direktor: "tesdiq" }),
    lots: [
      { name: "Metal karkas", qty: "3 200 m²" },
      { name: "Sendviç panel", qty: "4 100 m²" },
      { name: "Döşəmə betonu", qty: "3 200 m²" },
    ],
  },
  {
    key: "48155",
    savedId: "",
    number: "ET-48155",
    link: "https://etender.gov.az/main/competition/detail/48155",
    buyer: "ADA Universiteti",
    place: "Nəsimi, Bakı",
    subject: "Tədris korpusunun fasad yenilənməsi",
    classCode: "45443000-4",
    classText: "Fasad örtüyü işləri",
    price: "1290000",
    deadline: "2026-10-12T18:00",
    bidMode: "fixed",
    bidValue: "19350",
    sme: false,
    discount: "",
    advance: "5",
    task: "TT-ADA-fasad.pdf",
    contractDraft: "Müqavilə layihəsi ADA-48155.docx",
    qualification: "Fasad ixtisas paketi",
    similar: "Akt, Port Baku fasadı, 2025",
    bondDays: "20",
    performDays: "30",
    opened: true,
    confirmed: false,
    checks: packChecks({ "İştirak təminatı": "deyil", "İcra təminatı öhdəliyi": "catismir" }),
    approvals: packApprovals({ Smetaçı: "tesdiq" }),
    lots: [
      { name: "Alüminium fasad", qty: "2 450 m²" },
      { name: "Şüşə paket", qty: "980 m²" },
      { name: "İskele və mühafizə", qty: "1 dəst" },
    ],
  },
]

function tenderFrom(row: TenderCase) {
  return {
    id: row.savedId,
    link: row.link,
    buyer: row.buyer,
    subject: row.subject,
    classCode: row.classCode,
    classText: row.classText,
    price: row.price,
    deadline: row.deadline,
    bidMode: row.bidMode,
    bidValue: row.bidValue,
    sme: row.sme,
    discount: row.discount,
    advance: row.advance,
    task: row.task,
    contractDraft: row.contractDraft,
    qualification: row.qualification,
    similar: row.similar,
    bondDays: row.bondDays,
    performDays: row.performDays,
    opened: row.opened,
    confirmed: row.confirmed,
    checks: row.checks,
    approvals: row.approvals,
  }
}

function rowToCase(row: TenderRow): TenderCase {
  return {
    key: row.id,
    savedId: row.id,
    number: row.number || "",
    link: row.link || "",
    buyer: row.buyer || "",
    place: "",
    subject: row.subject || "",
    classCode: row.classCode || "",
    classText: row.classText || "",
    price: dec(row.price),
    deadline: timeInput(row.deadline),
    bidMode: row.bidMode === "percent" ? "percent" : "fixed",
    bidValue: dec(row.bidValue),
    sme: row.sme,
    discount: dec(row.discount),
    advance: dec(row.advance),
    task: row.task || "",
    contractDraft: row.contractDraft || "",
    qualification: row.qualification || "",
    similar: row.similar || "",
    bondDays: row.bondDays == null ? "" : String(row.bondDays),
    performDays: row.performDays == null ? "" : String(row.performDays),
    opened: row.opened,
    confirmed: row.confirmed,
    checks: row.checks.map((item) => ({ name: item.name, fit: item.fit })),
    approvals: row.approvals.map((item) => ({ role: item.role, status: item.status })),
    lots: [],
  }
}

function compose(item: TenderCase, source: ReturnType<typeof tenderFrom>, num: string): TenderCase {
  return { ...item, ...source, key: item.key, savedId: source.id || item.savedId, number: num, place: item.place, lots: item.lots }
}

function dueWord(deadline: string) {
  const hours = hoursUntil(deadline)
  if (hours == null) return "Müddət yoxdur"
  if (hours < 0) return "Keçib"
  const days = Math.max(1, Math.ceil(hours / 24))
  return days === 1 ? "1 gün" : `${days} gün`
}

function clock(value: string) {
  const day = dateAZ(value.slice(0, 10))
  const time = value.slice(11, 16)
  return time ? `${day}, ${time}` : day
}

function stageOf(row: TenderCase) {
  if (row.confirmed) return { word: "Paket hazırdır", tone: "clear" as const }
  const hours = hoursUntil(row.deadline)
  if (hours != null && hours < 0) return { word: "Müddət keçib", tone: "flag" as const }
  if (hours != null && hours <= 72) return { word: "Müddət yaxındır", tone: "wait" as const }
  const left = row.approvals.filter((item) => item.status !== "tesdiq").length
  if (left) return { word: `${left} təsdiq qalıb`, tone: "wait" as const }
  return { word: "Açıqdır", tone: "clear" as const }
}

function pillClass(tone: "clear" | "wait" | "flag") {
  if (tone === "flag") return "yox-pill flag"
  if (tone === "wait") return "yox-pill wait"
  return "yox-pill"
}

type TenderDesk = {
  brief?: { summary: string; risks: string[]; papers: string[]; companyYears: number | null; engineerYears: number | null }
  checks?: { name: string; fit: Fit; why: string }[]
  staff?: { name: string; profession: string; years: number; confirmed: boolean; fits: boolean }[]
  gear?: { required: string; asset: string; documented: boolean }[]
  estimate?: { total: number | null; lines: number; note: string }
  alerts: string[]
  certs: string[]
  letter: string
  portal: string
}

export function ETenderPage() {
  useTitle("e-Tender")
  const { tender, boq, cabinet } = useWorkspace()
  const [cases, setCases] = useState(TENDER_CASES)
  const [active, setActive] = useState(TENDER_CASES[0].key)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [number, setNumber] = useState(TENDER_CASES[0].number)
  const [docs, setDocs] = useState<{ id: string; name: string; kind: string }[]>([])
  const [desk, setDesk] = useState<TenderDesk | null>(null)
  const [paste, setPaste] = useState("")
  const [reading, setReading] = useState(false)
  const selected = cases.find((item) => item.key === active) ?? cases[0]
  const synced = Boolean(tender.subject || tender.link || tender.deadline || tender.buyer)
  const live = synced ? compose(selected, tender, number) : selected
  const math = tenderMath({
    ...tender,
    link: live.link,
    price: live.price,
    deadline: live.deadline,
    subject: live.subject,
    classText: live.classText,
    bidMode: live.bidMode,
    bidValue: live.bidValue,
    sme: live.sme,
    discount: live.discount,
    advance: live.advance,
  })
  const ready = live.approvals.length > 0 && live.approvals.every((item) => item.status === "tesdiq")
  const board = cases.map((item) => (item.key === active ? live : item))
  const openRows = board.filter((item) => !item.confirmed && (hoursUntil(item.deadline) ?? -1) >= 0)
  const upcoming = board
    .map((item) => ({ item, hours: hoursUntil(item.deadline) }))
    .filter((row): row is { item: TenderCase; hours: number } => row.hours != null && row.hours >= 0)
    .sort((a, b) => a.hours - b.hours)
  const nearest = upcoming[0]
  const packed = board.filter((item) => item.confirmed).length
  const stage = stageOf(live)
  const signed = live.approvals.filter((item) => item.status === "tesdiq").length
  const fitCount = live.checks.filter((item) => item.fit === "uygun").length
  const orderedChecks = [...live.checks].sort((a, b) => Number(a.fit === "uygun") - Number(b.fit === "uygun"))
  const companyLine = [cabinet.name, cabinet.voen, cabinet.permits].map((item) => item.trim()).filter(Boolean).join(" · ")
  const missingPapers = [live.task, live.contractDraft, live.qualification, live.similar].filter((item) => !item.trim()).length
  const alertBits = [
    live.confirmed ? "Paket təsdiqlənib. Etenderə ötürülmə növbədədir. Portal sessiyası bağlıdır." : (math.reminders.at(-1) ?? ""),
    math.mismatch ? "Predmetlə təsnifat mətni üst-üstə düşmür" : "",
    missingPapers ? `${missingPapers} sənəd çatışır` : "",
    live.approvals.some((item) => item.status === "geri") ? "Təsdiq geri qaytarılıb" : "",
  ].filter(Boolean)

  useEffect(() => {
    applyCase(TENDER_CASES[0])
    let alive = true
    api<TenderRow[]>("/api/platform/tenders")
      .then((rows) => {
        if (!alive) return
        const filled = rows.filter((row) => row.subject?.trim())
        if (!filled.length) return
        const incoming = filled.map(rowToCase)
        setCases((prev) => [...incoming, ...prev.filter((item) => !incoming.some((row) => row.number && row.number === item.number))])
      })
      .catch((reason) => { if (alive) setError(reason instanceof ApiError ? reason.message : "Saxlanmış tender oxunmadı. Nümunə elanlar açıqdır.") })
    api<{ id: string; name: string; kind: string }[]>("/api/platform/templates")
      .then((rows) => { if (alive) setDocs(rows) })
      .catch(() => { if (alive) setDocs([]) })
    return () => { alive = false }
  }, [])

  function applyCase(row: TenderCase) {
    setNumber(row.number)
    patch((state) => ({ ...state, tender: { ...state.tender, ...tenderFrom(row) } }))
  }

  function edit(partial: Partial<ReturnType<typeof tenderFrom>>) {
    patch((state) => {
    const base = state.tender.subject || state.tender.link || state.tender.deadline || state.tender.buyer ? state.tender : { ...state.tender, ...tenderFrom(selected) }
    const next = { ...base, ...partial }
    if (!("confirmed" in partial)) next.confirmed = false
    return { ...state, tender: next }
    })
  }

  function choose(key: string) {
    if (key === active) return
    const next = cases.find((item) => item.key === key)
    if (!next) return
    if (tender.subject || tender.link || tender.deadline || tender.buyer) setCases((prev) => prev.map((item) => (item.key === active ? compose(item, tender, number) : item)))
    applyCase(next)
    setActive(key)
    setNote("")
    setError("")
  }

  function sourceTender() {
    return tender.subject || tender.link || tender.deadline || tender.buyer ? tender : { ...tender, ...tenderFrom(selected) }
  }

  async function save(extra?: { opened?: boolean; confirmed?: boolean }) {
    const source = sourceTender()
    if (!source.subject.trim()) {
      setNote("")
      setError("Predmet yazılmalıdır.")
      return
    }
    const body = {
      number: number || selected.number,
      link: source.link,
      buyer: source.buyer,
      subject: source.subject,
      classCode: source.classCode,
      classText: source.classText,
      price: source.price,
      deadline: source.deadline,
      bidMode: source.bidMode,
      bidValue: source.bidValue,
      sme: source.sme,
      discount: source.discount,
      advance: source.advance,
      task: source.task,
      contractDraft: source.contractDraft,
      qualification: source.qualification,
      similar: source.similar,
      bondDays: source.bondDays,
      performDays: source.performDays,
      opened: extra?.opened ?? source.opened,
      confirmed: extra?.confirmed ?? source.confirmed,
      checks: source.checks,
      approvals: source.approvals,
    }
    try {
      const saved = await api<TenderRow>(source.id ? `/api/platform/tenders/${source.id}` : "/api/platform/tenders", {
        method: source.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      })
      applyTender(saved, setNumber)
      setCases((prev) => prev.map((item) => (item.key === active ? { ...rowToCase(saved), key: item.key, place: item.place, lots: item.lots } : item)))
      setError("")
      setNote("Tender bazada saxlandı. Portal bağlantısı bağlıdır, sənədlər burada qalır.")
    } catch (reason) {
      setNote("")
      setError(reason instanceof ApiError ? reason.message : "Tender saxlanmadı")
    }
  }

  async function confirm() {
    if (!ready) {
      setNote("")
      setError("Paket növbəyə düşmür. Təsdiq zənciri bitməyib.")
      return
    }
    await save({ opened: true, confirmed: true })
  }

  async function readPaper(file: File) {
    const source = sourceTender()
    if (!source.id) {
      setNote("")
      setError("Əvvəl tenderi bazaya yazın.")
      return
    }
    setReading(true)
    try {
      const text = await documentText(file.name, new Uint8Array(await file.arrayBuffer()))
      if (text.trim().length < 20) {
        setNote("")
        setError("Bu fayldan mətn çıxmadı. Mətni aşağıdakı xanaya yapışdırın.")
        return
      }
      await sendBrief(text)
    } catch (reason) {
      setNote("")
      setError(reason instanceof ApiError ? reason.message : "Sənəd oxunmadı")
    } finally {
      setReading(false)
    }
  }

  async function sendBrief(text: string) {
    const source = sourceTender()
    if (!source.id) {
      setNote("")
      setError("Əvvəl tenderi bazaya yazın.")
      return
    }
    setReading(true)
    try {
      const result = await api<TenderDesk>(`/api/platform/tenders/${source.id}/read`, {
        method: "POST",
        body: JSON.stringify({ text }),
      })
      if (result.checks) edit({ checks: result.checks.map((item) => ({ name: item.name, fit: item.fit })) })
      setDesk(result)
      setError("")
      setNote(`${result.brief?.summary || "Sənəd oxundu."} Portal bağlıdır.`)
    } catch (reason) {
      setNote("")
      setError(reason instanceof ApiError ? reason.message : "Sənəd oxunmadı")
    } finally {
      setReading(false)
    }
  }

  async function refresh() {
    const source = sourceTender()
    if (!source.id) {
      setNote("")
      setError("Əvvəl tenderi bazaya yazın.")
      return
    }
    try {
      const result = await api<TenderDesk>(`/api/platform/tenders/${source.id}/refresh`, { method: "POST" })
      setDesk((prev) => ({ ...result, brief: prev?.brief, checks: prev?.checks, staff: prev?.staff, gear: prev?.gear, estimate: prev?.estimate }))
      setError("")
      const heard = [...result.alerts, ...result.certs]
      setNote(heard.length ? `${heard.join(" · ")} Portal bağlıdır.` : "Müddət yoxlaması saxlandı. Portal bağlıdır.")
    } catch (reason) {
      setNote("")
      setError(reason instanceof ApiError ? reason.message : "Yoxlama alınmadı")
    }
  }

  return (
    <div className="yoxlama etender">
      <PageHead kicker="Dövlət satınalması" title="e-Tender" text="Açıq elan, təminat və təsdiq bir yerdədir. Kartı seç, şərti aşağıda düzəlt.">
        <button type="button" className="btn ghost" onClick={() => void refresh()}>Müddəti yoxla</button>
        <label className="btn ghost small boq-upload">
          {reading ? "Oxunur" : "Sənədi oxu"}
          <input type="file" accept=".pdf,.docx,.txt" disabled={reading} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void readPaper(file) }} />
        </label>
        <button type="button" className="btn" onClick={() => void save({ opened: true })}>Bazaya yaz</button>
      </PageHead>
      {error && <p className="form-error">{error}</p>}
      {note && <p className="lede">{note}</p>}

      <div className="statstrip">
        <article>
          <span>Elan</span>
          <strong>{board.length}</strong>
          <em>{openRows.length} açıqdır</em>
        </article>
        <article>
          <span>Ən yaxın müddət</span>
          <strong>{nearest ? dueWord(nearest.item.deadline) : "—"}</strong>
          <em className={nearest && nearest.hours <= 72 ? "warn" : undefined}>{nearest ? nearest.item.number : "Açıq müddət yoxdur"}</em>
        </article>
        <article>
          <span>Açıq məbləğ</span>
          <strong>{moneyShort(openRows.reduce((sum, item) => sum + (Number(item.price) || 0), 0))}</strong>
          <em>Ehtimal qiymət</em>
        </article>
        <article>
          <span>Hazır paket</span>
          <strong>{packed}</strong>
          <em>{board.length} elandan</em>
        </article>
      </div>

      <section className={`yox-now ${stage.tone === "clear" ? "clear" : stage.tone === "flag" ? "flag" : ""}`}>
        <div className="yox-now-top">
          <div className="yox-mark" aria-hidden="true"><Icon name="stamp" /></div>
          <div>
            <p>{live.number}{math.id ? ` · portal ${math.id}` : ""}{live.place ? ` · ${live.place}` : ""}</p>
            <h2>{live.subject || "Predmet yazılmayıb"}</h2>
            <span>{live.buyer || "Alıcı yazılmayıb"} · {live.classCode} {live.classText}</span>
          </div>
          <div className="yox-score">
            <strong>{moneyShort(Number(live.price) || 0)}</strong>
            <em>ehtimal qiymət</em>
          </div>
        </div>
        <div className="yox-meters">
          <article><span>İştirak təminatı</span><strong>{money(math.bid)} AZN</strong></article>
          <article><span>İcra təminatı</span><strong>{money(math.perform)} AZN · {math.performRate}%</strong></article>
          <article><span>Avans təminatı</span><strong>{money(math.advance)} AZN</strong></article>
          <article><span>Son tarix</span><strong>{live.deadline ? clock(live.deadline) : "Yazılmayıb"}</strong></article>
        </div>
        {live.lots.length > 0 && (
          <div className="etender-lots">
            {live.lots.map((lot) => (
              <div key={lot.name}><span>{lot.name}</span><strong>{lot.qty}</strong></div>
            ))}
          </div>
        )}
        <p className={stage.tone === "clear" ? "yox-ok" : "yox-alert"}>{alertBits.join(" · ") || "Şərt yazılıb. Müddət hələ uzaqdır."}</p>
      </section>

      <section className="etender-cards" aria-label="Elanlar">
        {board.map((item) => {
          const itemStage = stageOf(item)
          return (
            <button type="button" key={item.key} className={`yox-topic ${itemStage.tone}${item.key === active ? " on" : ""}`} onClick={() => choose(item.key)} aria-pressed={item.key === active}>
              <div className="yox-topic-top">
                <b>{item.number}</b>
                <span className={pillClass(itemStage.tone)}>{itemStage.word}</span>
              </div>
              <strong>{item.subject}</strong>
              <span>{item.buyer}</span>
              <em>{moneyShort(Number(item.price) || 0)} · {dueWord(item.deadline)}</em>
            </button>
          )
        })}
      </section>

      <div className="yox-split">
        <section className="panel pad">
          <div className="panel-head">
            <h2>Sənəd qovluğu</h2>
            <span className="muted">{missingPapers ? `${missingPapers} çatışır` : "Əsas sənədlər yazılıb"}</span>
          </div>
          {([
            ["Texniki tapşırıq", live.task, "task", "akt"],
            ["Müqavilə layihəsi", live.contractDraft, "contractDraft", "müqavilə"],
            ["İxtisas sənədi", live.qualification, "qualification", "ixtisas"],
            ["Oxşar iş sübutu", live.similar, "similar", "təhvil"],
          ] as const).map(([label, value, key, kind]) => {
            const hit = !value && docs.find((doc) => doc.kind.toLocaleLowerCase("az").includes(kind) || doc.name.toLocaleLowerCase("az").includes(kind))
            return (
              <div className="step-row" key={label}>
                <span>{label}</span>
                {value ? <strong>{value}</strong> : hit ? <button type="button" className="btn small" onClick={() => edit({ [key]: hit.name })}>Qovluğa yaz</button> : <strong>Çatışmır</strong>}
              </div>
            )
          })}
          <div className="step-row"><span>Şirkət kartı</span><strong>{companyLine || "Kabinet boşdur"}</strong></div>
          <div className="step-row"><span>BOQ</span><strong><Link to="/boq">{boq.lines.length ? `${boq.lines.length} sətir` : boq.sheets.filter(Boolean).join(", ") || "Aç"}</Link></strong></div>
        </section>

        <section className="panel pad">
          <div className="panel-head">
            <h2>Təsdiq zənciri</h2>
            <span className="muted">{signed}/{live.approvals.length || 4}</span>
          </div>
          <Meter value={live.approvals.length ? (signed / live.approvals.length) * 100 : 0} tone="pine" />
          {live.approvals.map((item) => (
            <div className="check-row" key={item.role}>
              <span>{item.role}</span>
              <Select compact value={item.status} onValueChange={(status) => edit({ confirmed: false, approvals: live.approvals.map((row) => row.role === item.role ? { ...row, status: status as Approval } : row) })} options={TENDER_APPROVAL} />
            </div>
          ))}
          <button type="button" className="etender-pack" onClick={() => void confirm()}>
            <Icon name="check" />
            <span>Təsdiqlə və paket hazırla</span>
          </button>
          {live.confirmed && <p className="lede">Paket təsdiqlənib. Göndəriş portal sessiyası bağlanana qədər növbədə qalır.</p>}
        </section>
      </div>

      <section className="panel pad">
        <div className="panel-head">
          <h2>Sənəd yoxlaması</h2>
          <span className="muted">{live.checks.length ? `${fitCount}/${live.checks.length} uyğundur` : "Siyahı boşdur"}</span>
        </div>
        {live.checks.length === 0 && <button type="button" className="btn" onClick={() => edit({ opened: true, confirmed: false, checks: CHECKS.map((name) => ({ name, fit: "catismir" as Fit })), approvals: APPROVALS.map((role) => ({ role, status: "gozleyir" as Approval })) })}>Yoxlama siyahısını aç</button>}
        <div className="etender-checks">
          {orderedChecks.map((item) => (
            <div className="check-row" key={item.name}>
              <span>{item.name}</span>
              <Select compact value={item.fit} onValueChange={(fit) => edit({ checks: live.checks.map((row) => row.name === item.name ? { ...row, fit: fit as Fit } : row) })} options={TENDER_FIT} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel pad">
        <div className="panel-head">
          <h2>Tender köməkçisi</h2>
          <span className="muted">etender.gov.az bağlıdır. Oxuma yüklənmiş sənəddən gedir.</span>
        </div>
        <label className="wide">Tender mətni
          <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={4} placeholder="PDF-dən mətn çıxmasa, şərti bura yapışdırın" />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" disabled={reading || paste.trim().length < 20} onClick={() => void sendBrief(paste)}>Mətni oxu</button>
        </div>
        {desk?.brief && (
          <>
            <p className="lede">{desk.brief.summary}</p>
            {desk.brief.risks.map((item) => <div className="step-row" key={item}><span>Risk</span><strong>{item}</strong></div>)}
            {desk.brief.papers.map((item) => <div className="step-row" key={item}><span>Sənəd</span><strong>{item}</strong></div>)}
          </>
        )}
        {desk?.checks && desk.checks.map((item) => (
          <div className="step-row" key={item.name}><span>{item.name}</span><strong>{FIT_LABEL[item.fit]}. {item.why}</strong></div>
        ))}
        {desk?.staff && desk.staff.length > 0 && desk.staff.map((item) => (
          <div className="step-row" key={item.name}><span>{item.fits ? "Uyğun kadr" : "Kadr"}</span><strong>{item.name} · {item.profession} · {item.years} il{item.confirmed ? "" : " · təsdiqsiz"}</strong></div>
        ))}
        {desk?.gear && desk.gear.map((item) => (
          <div className="step-row" key={item.required}><span>Texnika</span><strong>{item.required}{item.asset ? ` · ${item.asset}` : " · bazada yoxdur"}{item.documented ? "" : item.asset ? " · sənəd gözləyir" : ""}</strong></div>
        ))}
        {desk?.estimate && <div className="step-row"><span>Smeta təklifi</span><strong>{desk.estimate.total == null ? desk.estimate.note : `${money(desk.estimate.total)} AZN. ${desk.estimate.note}`}</strong></div>}
        {desk && [...desk.alerts, ...desk.certs].map((item) => <div className="step-row" key={item}><span>Bildiriş</span><strong>{item}</strong></div>)}
        {desk?.letter && <pre className="lede">{desk.letter}</pre>}
      </section>

      <section className="panel pad">
        <div className="panel-head">
          <h2>Şərti düzəlt</h2>
          <span className="muted">{live.number}</span>
        </div>
        <div className="form-row wide">
          <label>etender.gov.az linki<input value={live.link} onChange={(event) => edit({ link: event.target.value, opened: false, confirmed: false })} placeholder="https://etender.gov.az/main/competition/detail/..." /></label>
          <label>Elan nömrəsi<input value={live.number} onChange={(event) => setNumber(event.target.value)} /></label>
          <label>Alıcı<input value={live.buyer} onChange={(event) => edit({ buyer: event.target.value })} /></label>
          <label>Predmet<input value={live.subject} onChange={(event) => edit({ subject: event.target.value })} /></label>
          <label>Təsnifat kodu<input value={live.classCode} onChange={(event) => edit({ classCode: event.target.value })} /></label>
          <label>Təsnifat mətni<input value={live.classText} onChange={(event) => edit({ classText: event.target.value })} /></label>
          <label>Son tarix<DateTimeField value={live.deadline} onChange={(deadline) => edit({ deadline })} ariaLabel="Son tarix" /></label>
          <label>Ehtimal qiymət, AZN<input value={live.price} onChange={(event) => edit({ price: event.target.value })} inputMode="decimal" /></label>
          <label>İştirak təminatı<Select value={live.bidMode} onValueChange={(bidMode) => edit({ bidMode: bidMode as "fixed" | "percent" })} options={[{ value: "fixed", label: "Sabit məbləğ" }, { value: "percent", label: "Faiz" }]} /></label>
          <label>{live.bidMode === "fixed" ? "İştirak, AZN" : "İştirak, %"}<input value={live.bidValue} onChange={(event) => edit({ bidValue: event.target.value })} /></label>
          <label>Mikro və ya kiçik<Select value={live.sme ? "beli" : "xeyr"} onValueChange={(value) => edit({ sme: value === "beli" })} options={[{ value: "xeyr", label: "Xeyr, icra 10%" }, { value: "beli", label: "Bəli, icra 5%" }]} /></label>
          <label>İcra faizinə güzəşt<input value={live.discount} onChange={(event) => edit({ discount: event.target.value })} placeholder="məs. 4" /></label>
          <label>Avans təminatı, %<input value={live.advance} onChange={(event) => edit({ advance: event.target.value })} /></label>
          <label>Texniki tapşırıq<input value={live.task} onChange={(event) => edit({ task: event.target.value })} /></label>
          <label>Müqavilə layihəsi<input value={live.contractDraft} onChange={(event) => edit({ contractDraft: event.target.value })} /></label>
          <label>İxtisas sənədi<input value={live.qualification} onChange={(event) => edit({ qualification: event.target.value })} /></label>
          <label>Oxşar iş sübutu<input value={live.similar} onChange={(event) => edit({ similar: event.target.value })} /></label>
          <label>İştirak təminatı, gün<input value={live.bondDays} onChange={(event) => edit({ bondDays: event.target.value })} /></label>
          <label>İcra təminatı, gün<input value={live.performDays} onChange={(event) => edit({ performDays: event.target.value })} /></label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => void confirm()}>Təsdiq</button>
        </div>
      </section>
    </div>
  )
}

type BoqRow = {
  id: string
  profit: unknown
  vat: unknown
  management: string
  lines: { sheet: string; name: string; unit: string; qty: unknown; material: unknown; labor: unknown; laborOnly: boolean }[]
  costs: { kind: string; name: string; amount: unknown }[]
}

function volumeCell(row: Record<string, unknown>, keys: string[]) {
  for (const [key, value] of Object.entries(row)) {
    if (keys.includes(key.trim().toLocaleLowerCase("az"))) return String(value ?? "").trim()
  }
  return ""
}

function applyBoq(book: BoqRow) {
  patch((state) => {
    const savedExtras = book.costs.filter((row) => row.kind === "extra")
    const extras = savedExtras.length
      ? [
          ...EXTRA_COSTS.map((name) => {
            const hit = savedExtras.find((row) => row.name === name)
            return { id: name, name, amount: hit ? dec(hit.amount) : "" }
          }),
          ...savedExtras.filter((row) => !EXTRA_COSTS.includes(row.name)).map((row) => ({ id: uid(), name: row.name, amount: dec(row.amount) })),
        ]
      : state.boq.extras
    const sheets = Array.from(new Set(book.lines.map((line) => line.sheet).filter(Boolean)))
    return {
      ...state,
      boq: {
        ...state.boq,
        id: book.id,
        profit: dec(book.profit) || state.boq.profit,
        vat: dec(book.vat) || state.boq.vat,
        management: typeof book.management === "string" ? book.management : state.boq.management,
        sheets: sheets.length ? sheets : state.boq.sheets,
        lines: book.lines.map((line) => {
          const prev = state.boq.lines.find((item) => item.sheet === line.sheet && item.name === line.name)
          return {
            id: prev?.id || uid(),
            sheet: line.sheet,
            name: line.name,
            unit: line.unit,
            qty: dec(line.qty),
            material: dec(line.material),
            labor: dec(line.labor),
            laborOnly: line.laborOnly,
            confirmed: prev?.confirmed ?? true,
            source: prev?.source || "Baza",
            pricedOn: prev?.pricedOn || "",
            stale: prev?.stale ?? false,
          }
        }),
        indirect: book.costs.filter((row) => row.kind === "indirect").map((row) => ({ id: uid(), name: row.name, amount: dec(row.amount) })),
        overhead: book.costs.filter((row) => row.kind === "overhead").map((row) => ({ id: uid(), name: row.name, amount: dec(row.amount) })),
        extras,
      },
    }
  })
}

function lineMark(line: { stale?: boolean; confirmed?: boolean; laborOnly: boolean }) {
  if (line.stale) return { tone: "gold", word: "Köhnə qiymət" }
  if (line.confirmed === false) return { tone: "stone", word: "Təsdiqsiz" }
  return { tone: "pine", word: line.laborOnly ? "Yalnız işçilik" : "Təsdiqli" }
}

function CostBlock({
  title,
  text,
  rows,
  draft,
  setDraft,
  onAdd,
  onRemove,
}: {
  title: string
  text: string
  rows: { id: string; name: string; amount: string }[]
  draft: { name: string; amount: string }
  setDraft: (next: { name: string; amount: string }) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  const sum = rows.reduce((total, row) => total + (Number(row.amount) || 0), 0)
  return (
    <section className="panel pad">
      <div className="panel-head">
        <h2>{title}</h2>
        <strong>{money(sum)} AZN</strong>
      </div>
      <p className="lede">{text}</p>
      {rows.length === 0 && <p className="lede">Sətir yoxdur.</p>}
      {rows.map((row) => (
        <div className="step-row" key={row.id}>
          <span>{row.name}</span>
          <span className="boq-row-side">
            <strong>{money(Number(row.amount) || 0)} AZN</strong>
            <button type="button" className="icon-btn boq-del" aria-label={`${row.name} sil`} onClick={() => onRemove(row.id)}><Icon name="bin" /></button>
          </span>
        </div>
      ))}
      <div className="form-row wide">
        <label>Ad<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Məbləğ, AZN<input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
        <button type="button" className="btn" onClick={onAdd}>Əlavə et</button>
      </div>
    </section>
  )
}

export function BoqPage() {
  useTitle("BOQ")
  const { boq } = useWorkspace()
  const math = boqMath(boq)
  const [sheetName, setSheetName] = useState("")
  const [sheet, setSheet] = useState("hamisi")
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState({ sheet: "Dəmir-beton", name: "", unit: "m3", qty: "", material: "", labor: "", laborOnly: false })
  const [indirect, setIndirect] = useState({ name: "", amount: "" })
  const [overhead, setOverhead] = useState({ name: "", amount: "" })
  const [duty, setDuty] = useState({ work: "", party: "podratci" as Party })
  const [staff, setStaff] = useState({ role: "", count: "" })
  const [gear, setGear] = useState({ name: "", count: "", insurance: "", basis: "gun" as GearBasis, rate: "", span: "", fuel: "", operator: "", minSpan: "" })
  const [boqNote, setBoqNote] = useState("")
  const active = sheet !== "hamisi" && boq.sheets.includes(sheet) ? sheet : ""
  const lineSheet = boq.sheets.includes(draft.sheet) ? draft.sheet : (active || boq.sheets[0] || "")
  const needle = query.trim().toLocaleLowerCase("az")
  const shown = boq.lines.filter((line) => {
    if (active && line.sheet !== active) return false
    if (needle && !`${line.name} ${line.source || ""}`.toLocaleLowerCase("az").includes(needle)) return false
    return true
  })
  const shownTotal = shown.reduce((sum, line) => sum + lineTotal(line), 0)
  const skipped = boq.lines.filter((line) => line.confirmed === false || line.stale).length
  const machines = boq.gear ?? []
  const crew = boq.staff.reduce((sum, row) => sum + (Number(row.count) || 0), 0)
  const sheetBars = boq.sheets.map((name) => ({
    name,
    total: boq.lines.filter((line) => line.sheet === name).reduce((sum, line) => sum + lineTotal(line), 0),
  }))
  const peak = Math.max(...sheetBars.map((row) => row.total), 1)
  const scale = math.gross || 1
  const shares = [
    ["Material", math.material, "pine"],
    ["İşçilik", math.labor, ""],
    ["Dolayı", math.indirect, "copper"],
    ["Üstəlik", math.overhead, "copper"],
    ["Əlavə", math.extra, ""],
    ["Mənfəət", math.profit, "pine"],
    ["Vergi", math.vat, ""],
  ] as const
  const noteWarn = /olmadı|yoxdur|tapılmadı|yazılmayıb/.test(boqNote)

  useEffect(() => {
    let live = true
    api<BoqRow[]>("/api/platform/boq")
      .then((rows) => { if (live && rows[0]?.lines?.length) applyBoq(rows[0]) })
      .catch((reason) => { if (live) setBoqNote(reason instanceof ApiError ? reason.message : "Smeta oxunmadı") })
    return () => { live = false }
  }, [])

  async function saveBoq(lines = boq.lines) {
    const costs = [
      ...boq.indirect.map((row) => ({ kind: "indirect", name: row.name, amount: row.amount })),
      ...boq.overhead.map((row) => ({ kind: "overhead", name: row.name, amount: row.amount })),
      ...boq.extras.filter((row) => row.amount.trim()).map((row) => ({ kind: "extra", name: row.name, amount: row.amount })),
    ]
    try {
      const saved = await api<BoqRow>(boq.id ? "/api/platform/boq" : "/api/platform/boq", {
        method: "POST",
        body: JSON.stringify({
          id: boq.id || undefined,
          profit: boq.profit,
          vat: boq.vat,
          management: boq.management,
          lines: lines.map((row) => ({ sheet: row.sheet, name: row.name, unit: row.unit, qty: row.qty, material: row.material, labor: row.labor, laborOnly: row.laborOnly })),
          costs,
        }),
      })
      applyBoq(saved)
      setBoqNote("Həcm və qiymət cədvəli bazada saxlandı.")
    } catch (reason) {
      setBoqNote(reason instanceof ApiError ? reason.message : "Smeta saxlanmadı")
    }
  }

  async function uploadVolume(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (ext === "xls" || ext === "xlsx" || ext === "csv" || ext === "txt") {
      const book = XLSX.read(await file.arrayBuffer())
      const sheetName = book.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName], { defval: "" })
      const lines = rows.map((row) => ({
        id: uid(),
        sheet: volumeCell(row, ["fənn", "fenn", "sheet"]) || "Həcm",
        name: volumeCell(row, ["iş", "is", "name", "ad"]),
        unit: volumeCell(row, ["vahid", "unit"]) || "eded",
        qty: volumeCell(row, ["miqdar", "qty", "həcm", "hecm"]),
        material: volumeCell(row, ["material"]),
        labor: volumeCell(row, ["işçilik", "iscilik", "labor"]),
        laborOnly: false,
        confirmed: false,
        source: file.name,
        pricedOn: "",
        stale: false,
      })).filter((row) => row.name)
      if (!lines.length) {
        setBoqNote("Cədvəldə iş sətri tapılmadı. Sütunlar: İş, Vahid, Miqdar, Material, İşçilik.")
        return
      }
      patch((state) => ({ ...state, boq: { ...state.boq, lines, sheets: Array.from(new Set(lines.map((row) => row.sheet))) } }))
      await saveBoq(lines)
      setBoqNote("Sətirlər gəldi. Təsdiqlənməyən və köhnə qiymət hesaba düşmür.")
      return
    }
    const parsed = await readProjectFile(file.name, new Uint8Array(await file.arrayBuffer()))
    if (!parsed.scan.ok) {
      setBoqNote(parsed.scan.note)
      return
    }
    const lines = parsed.rows.filter((row) => row.width || row.profile || (row.name && !row.flags.includes("oxunmadi"))).map((row) => ({
      id: uid(),
      sheet: "Həcm",
      name: row.name,
      unit: "eded",
      qty: row.qty || "1",
      material: "",
      labor: "",
      laborOnly: false,
      confirmed: false,
      source: [row.profile, row.width && row.height ? `${row.width}×${row.height}` : "", file.name].filter(Boolean).join(" · "),
      pricedOn: "",
      stale: false,
    }))
    if (!lines.length) {
      setBoqNote(parsed.scan.note || "Fayldan iş sətri çıxmadı. Ölçü və profil təsdiq üçün Fayl səhifəsində qalır.")
      return
    }
    patch((state) => ({ ...state, boq: { ...state.boq, lines, sheets: ["Həcm"] } }))
    setBoqNote(`${lines.length} sətir çıxdı. Təsdiqdən əvvəl hesaba düşmür. ${parsed.rows.some((row) => row.flags.includes("qeyri-deqiq")) ? "Bəzi ölçü xətdən gəlib, yazılı ölçü deyil." : ""}`.trim())
  }

  function chooseMethod(method: Method) {
    patch((state) => ({ ...state, boq: { ...state.boq, method, rules: rulesForMethod(state.boq.rules, method) } }))
  }

  function applyLabor() {
    let hit = 0
    patch((state) => ({
      ...state,
      boq: {
        ...state.boq,
        lines: state.boq.lines.map((line) => {
          const quote = laborQuote(line.name, state.boq.region, state.boq.complexity, "vahid")
          if (!quote) return line
          hit += 1
          return { ...line, labor: String(quote.amount), source: `Tarif · ${quote.trade} · ${quote.region}`, pricedOn: new Date().toISOString().slice(0, 10), stale: false }
        }),
      },
    }))
    setBoqNote(hit ? `${hit} sətirin işçiliyi peşə tarifindən yazıldı.` : "Bu sətirlərə uyğun peşə tarifi tapılmadı.")
  }

  function applyRegion() {
    let hit = 0
    patch((state) => ({
      ...state,
      boq: {
        ...state.boq,
        lines: state.boq.lines.map((line) => {
          const price = regionMaterial(line.name, state.boq.region)
          if (!price) return line
          hit += 1
          return { ...line, material: String(price.price), unit: line.unit || price.unit, source: `Rayon · ${price.material} · ${price.region}`, pricedOn: new Date().toISOString().slice(0, 10), stale: false }
        }),
      },
    }))
    setBoqNote(hit ? `${hit} sətir ${boq.region} qiymətinə bağlandı.` : "Bu sətirlərdə rayon kataloqundakı material tapılmadı.")
  }

  async function bindPrices() {
    let cards: { name: string; code: string; price: number; unit: string; validUntil: string; stale: boolean }[] = []
    try {
      const rows = await api<{ name: string; code?: string; price: unknown; unit?: string; validUntil?: string | null; stale?: boolean }[]>("/api/platform/market/products")
      const today = new Date().toISOString().slice(0, 10)
      cards = rows.map((row) => {
        const validUntil = row.validUntil ? String(row.validUntil).slice(0, 10) : ""
        return {
          name: row.name,
          code: row.code || "",
          price: Number(row.price) || 0,
          unit: row.unit || "",
          validUntil,
          stale: row.stale === true || (Boolean(validUntil) && validUntil < today),
        }
      })
    } catch {
      cards = []
    }
    if (!cards.length) {
      setBoqNote("Kataloqda bağlanacaq qiymət tapılmadı.")
      return
    }
    patch((state) => ({
      ...state,
      boq: {
        ...state.boq,
        lines: state.boq.lines.map((line) => {
          const hit = cards.find((card) => line.name.toLocaleLowerCase("az").includes(card.name.toLocaleLowerCase("az")) || card.name.toLocaleLowerCase("az").includes(line.name.toLocaleLowerCase("az")))
          if (!hit) return { ...line, source: line.source || "Uyğun qiymət yoxdur" }
          if (hit.stale) return { ...line, stale: true, source: `${hit.code || hit.name} · müddəti bitib ${hit.validUntil}`, pricedOn: hit.validUntil, confirmed: false }
          return { ...line, material: String(hit.price), source: hit.code || hit.name, pricedOn: hit.validUntil || new Date().toISOString().slice(0, 10), stale: false }
        }),
      },
    }))
    setBoqNote("Uyğun sətir kataloq qiymətinə bağlandı. Köhnə qiymət aktual sayılmır.")
  }

  async function makeOffer() {
    const lines = boq.lines.filter((line) => line.confirmed !== false && !line.stale && line.name.trim())
    if (!lines.length) {
      setBoqNote("Təklif üçün təsdiqli və aktual sətir yoxdur.")
      return
    }
    try {
      await api("/api/platform/inquiries", {
        method: "POST",
        body: JSON.stringify({
          title: "BOQ təklifi",
          lines: [
            ...lines.map((line) => ({ name: line.name, unit: line.unit, qty: line.qty, spec: line.source || "" })),
            ...machines.filter((row) => row.name.trim()).map((row) => {
              const cost = gearCost(row)
              return { name: row.name, unit: row.basis || "gun", qty: String(cost.used || row.count), spec: `icarə ${row.rate || "0"}, yanacaq ${row.fuel || "0"}, operator ${row.operator || "0"}` }
            }),
          ],
        }),
      })
      setBoqNote("Təsdiqli sətirlər qiymət sorğusuna çevrildi.")
    } catch (reason) {
      setBoqNote(reason instanceof ApiError ? reason.message : "Təklif yaranmadı")
    }
  }

  function openSheet() {
    const name = sheetName.trim()
    if (!name) {
      setBoqNote("Ad yazılmayıb. Əvvəl fənnin adını xanaya yazın, sonra vərəq açın.")
      return
    }
    const known = boq.sheets.includes(name)
    if (!known) {
      patch((state) => ({ ...state, boq: { ...state.boq, sheets: [...state.boq.sheets, name] } }))
    }
    setSheet(name)
    setDraft((row) => ({ ...row, sheet: name }))
    setSheetName("")
    setQuery("")
    setBoqNote(known
      ? `«${name}» artıq var. Cədvəl indi yalnız bu fənni göstərir.`
      : `«${name}» vərəqi açıldı. Bu fənn hələ boşdur. Digər sətirlər Hamısı bölməsində qalır.`)
  }

  function addLine() {
    if (!draft.name.trim() || !lineSheet) return
    patch((state) => ({
      ...state,
      boq: {
        ...state.boq,
        lines: [...state.boq.lines, {
          ...draft,
          id: uid(),
          sheet: lineSheet,
          confirmed: true,
          source: "Əl ilə",
          pricedOn: new Date().toISOString().slice(0, 10),
          stale: false,
        }],
      },
    }))
    setDraft({ sheet: lineSheet, name: "", unit: draft.unit, qty: "", material: "", labor: "", laborOnly: false })
  }

  return (
    <div className="boq-page">
      <PageHead
        kicker="Smeta"
        title="İşlərin həcmi"
        text="Material və işçilik ayrıdır. On üç xərc tender üsuluna görə açılır və bağlanır. Mənfəət vahid qiymətə qarışmır."
      >
        <label className="btn ghost small boq-upload">
          Həcm yüklə
          <input type="file" accept={FILE_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadVolume(file) }} />
        </label>
        <button type="button" className="btn ghost small" onClick={() => void bindPrices()}>Qiyməti bağla</button>
        <button type="button" className="btn ghost small" onClick={() => void makeOffer()}>Təklifə çevir</button>
        <button type="button" className="btn small" onClick={() => void saveBoq()}>Bazaya yaz</button>
      </PageHead>
      {boqNote && <p className={noteWarn ? "boq-banner warn" : "boq-banner"}>{boqNote}</p>}
      <section className="statstrip">
        <article>
          <span>Sətir</span>
          <strong>{boq.lines.length}</strong>
          <em className={skipped ? "warn" : undefined}>{skipped ? `${skipped} sətir hesaba düşmür` : "Hamısı hesaba düşür"}</em>
        </article>
        <article>
          <span>Material</span>
          <strong>{money(math.material)}</strong>
          <em>AZN, təsdiqli sətirlər</em>
        </article>
        <article>
          <span>İşçilik</span>
          <strong>{money(math.labor)}</strong>
          <em>AZN, vahid qiymət × miqdar</em>
        </article>
        <article>
          <span>Yekun</span>
          <strong>{money(math.gross)}</strong>
          <em>AZN · mənfəət {boq.profit}% · ƏDV {boq.vat}%</em>
        </article>
      </section>
      <section className="panel pad">
        <div className="panel-head">
          <h2>On üç xərc</h2>
          <span className="muted">{METHODS.find((item) => item[0] === boq.method)?.[1]} · {boq.region}</span>
        </div>
        <p className="lede">Hər xərc üsula görə açılır. Material üsulu işçilik və texnikanı bağlayır. İşçilik üsulu materialı bağlayır. Podrat və tam smeta hamısını saxlayır.</p>
        <div className="form-row wide">
          <label>Üsul
            <Select value={boq.method} onValueChange={(method) => chooseMethod(method as Method)} options={METHODS.map(([value, label]) => ({ value, label }))} />
          </label>
          <label>Rayon
            <Select value={boq.region} onValueChange={(region) => patch((state) => ({ ...state, boq: { ...state.boq, region } }))} options={REGIONS.map((region) => ({ value: region, label: region }))} />
          </label>
          <label>Mürəkkəblik
            <Select value={boq.complexity} onValueChange={(complexity) => patch((state) => ({ ...state, boq: { ...state.boq, complexity: complexity as Complexity } }))} options={[{ value: "sade", label: "Sadə" }, { value: "orta", label: "Orta" }, { value: "murakkeb", label: "Mürəkkəb" }]} />
          </label>
          <button type="button" className="btn ghost" onClick={applyLabor}>İşçilik tarifi</button>
          <button type="button" className="btn ghost" onClick={applyRegion}>Rayon qiyməti</button>
        </div>
        {math.parts.map((part) => (
          <div className="step-row" key={part.key}>
            <label className="checkline">
              <input
                type="checkbox"
                checked={part.on}
                onChange={() => patch((state) => ({ ...state, boq: { ...state.boq, rules: state.boq.rules.map((rule) => rule.key === part.key ? { ...rule, on: !rule.on } : rule) } }))}
              />
              {part.name}
            </label>
            <strong>{money(part.on ? part.amount : 0)} AZN</strong>
          </div>
        ))}
        <div className="table-wrap flat">
          <table className="boq-table">
            <thead>
              <tr>
                <th>Material</th>
                {REGIONS.map((region) => <th key={region} className="num">{region}</th>)}
              </tr>
            </thead>
            <tbody>
              {regionMap().map((row) => (
                <tr key={row.material}>
                  <td>{row.material}, {row.unit}</td>
                  {row.cells.map((cell) => <td key={cell.region} className="num">{money(cell.price)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="boq-split">
        <section className="panel pad">
          <div className="panel-head">
            <h2>
              {boq.id ? "Həcm cədvəli" : "Port Baku Residence"}
              {!boq.id && <span className="badge gold">Nümunə</span>}
            </h2>
            <span className="muted">{shown.length} sətir · {money(shownTotal)} AZN</span>
          </div>
          <div className="boq-tools">
            <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
              <Icon name="search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İş və ya mənbə" aria-label="Smetada axtar" />
            </form>
            <Tabs
              value={boq.sheets.includes(sheet) || sheet === "hamisi" ? sheet : "hamisi"}
              onChange={(id) => {
                setSheet(id)
                if (id !== "hamisi") setDraft((row) => ({ ...row, sheet: id }))
              }}
              options={[
                { id: "hamisi", label: `Hamısı · ${boq.lines.length}` },
                ...boq.sheets.map((item) => ({ id: item, label: `${item} · ${boq.lines.filter((line) => line.sheet === item).length}` })),
              ]}
            />
          </div>
          <form className="boq-sheet-add" onSubmit={(event) => { event.preventDefault(); openSheet() }}>
            <label>
              Yeni fənn
              <input value={sheetName} placeholder="Məsələn, Dam" onChange={(event) => setSheetName(event.target.value)} />
            </label>
            <button type="submit" className="btn ghost small">Vərəq aç</button>
            <p>Adı yazın və düyməni basın. Yeni boş vərəq açılır, cədvəl ona keçir. Əvvəlki sətirlər silinmir, Hamısı bölməsində qalır.</p>
          </form>
          {shown.length === 0 && (
            <Empty
              title={active ? `${active} boşdur` : "Uyğun sətir yoxdur"}
              text={active ? "İlk işi aşağıdakı formadan yazın. Bu, digər fənnlərin sətirlərini silmir." : "Axtarışı təmizləyin və ya başqa fənn seçin."}
            />
          )}
          {shown.length > 0 && (
            <div className="table-wrap flat">
              <table className="boq-table">
                <thead>
                  <tr>
                    <th>İş</th>
                    <th>Vahid</th>
                    <th className="num">Miqdar</th>
                    <th className="num">Material</th>
                    <th className="num">İşçilik</th>
                    <th className="num">Cəmi</th>
                    <th>Təsdiq</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((line) => {
                    const mark = lineMark(line)
                    return (
                      <tr key={line.id} className={line.stale ? "stale" : undefined}>
                        <td>
                          <div className="boq-name">
                            <b>{line.name}</b>
                            <span className={`badge ${mark.tone}`}>{mark.word}</span>
                          </div>
                          <span className="boq-sub">{!active && `${line.sheet} · `}{line.source || "Mənbə yoxdur"}{line.pricedOn ? ` · ${line.pricedOn}` : ""}</span>
                        </td>
                        <td>{line.unit}</td>
                        <td className="num">{line.qty || "—"}</td>
                        <td className="num">{line.laborOnly ? "—" : money(Number(line.material) || 0)}</td>
                        <td className="num">{money(Number(line.labor) || 0)}</td>
                        <td className="num">{money(lineTotal(line))}</td>
                        <td>
                          <span className="boq-row-side">
                            <label className="boq-check">
                              <input
                                type="checkbox"
                                checked={line.confirmed !== false && !line.stale}
                                disabled={line.stale}
                                aria-label={`${line.name} təsdiqi`}
                                onChange={(event) => patch((state) => ({ ...state, boq: { ...state.boq, lines: state.boq.lines.map((item) => item.id === line.id ? { ...item, confirmed: event.target.checked } : item) } }))}
                              />
                              <span />
                            </label>
                            <button type="button" className="icon-btn boq-del" aria-label={`${line.name} sətrini sil`} onClick={() => patch((state) => ({ ...state, boq: { ...state.boq, lines: state.boq.lines.filter((item) => item.id !== line.id) } }))}><Icon name="bin" /></button>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>{active || "Hamısı"} · {shown.length} sətir</td>
                    <td className="num">{money(shownTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <h2 className="block-title">Yeni sətir</h2>
          <div className="form-row wide">
            <label>Fənn
              <Select value={lineSheet} onValueChange={(value) => { setDraft({ ...draft, sheet: value }); setSheet(value) }} options={boq.sheets.map((item) => ({ value: item, label: item }))} />
            </label>
            <label>İş<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Vahid<input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
            <label>Miqdar<input value={draft.qty} onChange={(event) => setDraft({ ...draft, qty: event.target.value })} /></label>
            <label>Material, AZN<input value={draft.material} onChange={(event) => setDraft({ ...draft, material: event.target.value })} disabled={draft.laborOnly} /></label>
            <label>İşçilik, AZN<input value={draft.labor} onChange={(event) => setDraft({ ...draft, labor: event.target.value })} /></label>
            <label>Materialı kim verir
              <Select value={draft.laborOnly ? "beli" : "xeyr"} onValueChange={(value) => setDraft({ ...draft, laborOnly: value === "beli", material: value === "beli" ? "" : draft.material })} options={[{ value: "xeyr", label: "Sətirə yazılır" }, { value: "beli", label: "Yalnız işçilik" }]} />
            </label>
            <button type="button" className="btn" onClick={addLine}>Sətir əlavə et</button>
          </div>
        </section>
        <aside className="panel pad boq-offer">
          <p className="eyebrow">Təklif</p>
          <strong className="boq-gross">{money(math.gross)}</strong>
          <span className="muted">AZN · {boq.lines.length - skipped} sətir hesaba düşür</span>
          <div className="form-row wide">
            <label>Mənfəət, %<input value={boq.profit} onChange={(event) => patch((state) => ({ ...state, boq: { ...state.boq, profit: event.target.value } }))} /></label>
            <label>Vergi rejimi
              <Select value={boq.vat} onValueChange={(vat) => patch((state) => ({ ...state, boq: { ...state.boq, vat } }))} options={[{ value: "18", label: "Adi, ƏDV 18%" }, { value: "0", label: "AFEZ zonası, 0%" }]} />
            </label>
          </div>
          <div className="hbars">
            {shares.map(([label, value, tone]) => (
              <div className="hbar" key={label}>
                <span>{label}</span>
                <div className="hbar-track"><i className={tone} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} /></div>
                <b>{money(value)}</b>
              </div>
            ))}
          </div>
          <h2 className="block-title">Fənn üzrə</h2>
          <div className="hbars">
            {sheetBars.map((row) => (
              <div className="hbar" key={row.name}>
                <span>{row.name}</span>
                <div className="hbar-track"><i className="pine" style={{ width: `${Math.min(100, (row.total / peak) * 100)}%` }} /></div>
                <b>{money(row.total)}</b>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="boq-costs">
        <CostBlock
          title="Dolayı xərc"
          text="Sahənin öz xərcidir. Vahid qiymətə qarışmır."
          rows={boq.indirect}
          draft={indirect}
          setDraft={setIndirect}
          onAdd={() => { if (!indirect.name.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, indirect: [...state.boq.indirect, { ...indirect, id: uid() }] } })); setIndirect({ name: "", amount: "" }) }}
          onRemove={(id) => patch((state) => ({ ...state, boq: { ...state.boq, indirect: state.boq.indirect.filter((row) => row.id !== id) } }))}
        />
        <CostBlock
          title="Üstəlik"
          text="İdarəetmə və nəzarət. Mənfəət bunları da örtür."
          rows={boq.overhead}
          draft={overhead}
          setDraft={setOverhead}
          onAdd={() => { if (!overhead.name.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, overhead: [...state.boq.overhead, { ...overhead, id: uid() }] } })); setOverhead({ name: "", amount: "" }) }}
          onRemove={(id) => patch((state) => ({ ...state, boq: { ...state.boq, overhead: state.boq.overhead.filter((row) => row.id !== id) } }))}
        />
        <section className="panel pad">
          <div className="panel-head">
            <h2>Əlavə xərc</h2>
            <strong>{money(math.extra)} AZN</strong>
          </div>
          <p className="lede">Boş xana cəmə düşmür.</p>
          {(boq.extras.length ? boq.extras : EXTRA_COSTS.map((name) => ({ id: name, name, amount: "" }))).map((row) => (
            <label className="boq-extra" key={row.id}>
              {row.name}
              <input
                value={row.amount}
                inputMode="decimal"
                aria-label={`${row.name}, AZN`}
                placeholder="0"
                onChange={(event) => {
                  const amount = event.target.value
                  patch((state) => {
                    const base = state.boq.extras.length ? state.boq.extras : EXTRA_COSTS.map((name) => ({ id: name, name, amount: "" }))
                    return { ...state, boq: { ...state.boq, extras: base.map((item) => item.id === row.id ? { ...item, amount } : item) } }
                  })
                }}
              />
            </label>
          ))}
        </section>
      </div>
      <div className="boq-people">
        <section className="panel pad">
          <div className="panel-head">
            <h2>Məsuliyyət</h2>
            <span className="muted">{boq.duties.length} iş</span>
          </div>
          {boq.duties.length === 0 && <p className="lede">Məsuliyyət sətri yoxdur.</p>}
          {boq.duties.map((row) => (
            <div className="step-row" key={row.id}>
              <span>{row.work}</span>
              <span className="boq-row-side">
                <strong>{PARTY_LABEL[row.party]}</strong>
                <button type="button" className="icon-btn boq-del" aria-label={`${row.work} sil`} onClick={() => patch((state) => ({ ...state, boq: { ...state.boq, duties: state.boq.duties.filter((item) => item.id !== row.id) } }))}><Icon name="bin" /></button>
              </span>
            </div>
          ))}
          <div className="form-row wide">
            <label>İş<input value={duty.work} onChange={(event) => setDuty({ ...duty, work: event.target.value })} /></label>
            <label>Material
              <Select value={duty.party} onValueChange={(party) => setDuty({ ...duty, party: party as Party })} options={(Object.keys(PARTY_LABEL) as Party[]).map((key) => ({ value: key, label: PARTY_LABEL[key] }))} />
            </label>
            <button type="button" className="btn" onClick={() => { if (!duty.work.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, duties: [...state.boq.duties, { ...duty, id: uid() }] } })); setDuty({ work: "", party: "podratci" }) }}>Əlavə et</button>
          </div>
        </section>
        <section className="panel pad">
          <div className="panel-head">
            <h2>Heyət</h2>
            <strong>{crew} nəfər</strong>
          </div>
          {boq.staff.length === 0 && <p className="lede">Heyət sətri yoxdur.</p>}
          {boq.staff.map((row) => {
            const daily = laborQuote(row.role, boq.region, boq.complexity, "gun")
            return (
            <div className="step-row" key={row.id}>
              <span>{row.role}{daily ? ` · ${money(daily.amount)} AZN/gün` : ""}</span>
              <span className="boq-row-side">
                <strong>{row.count || "0"}</strong>
                <button type="button" className="icon-btn boq-del" aria-label={`${row.role} sil`} onClick={() => patch((state) => ({ ...state, boq: { ...state.boq, staff: state.boq.staff.filter((item) => item.id !== row.id) } }))}><Icon name="bin" /></button>
              </span>
            </div>
            )
          })}
          <div className="form-row wide">
            <label>Vəzifə<input value={staff.role} onChange={(event) => setStaff({ ...staff, role: event.target.value })} /></label>
            <label>Say<input value={staff.count} onChange={(event) => setStaff({ ...staff, count: event.target.value })} /></label>
            <button type="button" className="btn" onClick={() => { if (!staff.role.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, staff: [...state.boq.staff, { ...staff, id: uid() }] } })); setStaff({ role: "", count: "" }) }}>Əlavə et</button>
          </div>
        </section>
        <section className="panel pad">
          <div className="panel-head">
            <h2>Texnika, növbə və yanacaq</h2>
            <strong>{money(machines.reduce((sum, row) => sum + gearCost(row).total, 0))} AZN</strong>
          </div>
          {machines.length === 0 && <p className="lede">Texnika sətri yoxdur.</p>}
          {machines.map((row) => {
            const cost = gearCost(row)
            return (
            <div className="step-row" key={row.id}>
              <span>{row.name} · {row.count || "0"} · {row.basis || "sığorta"} {cost.used || "—"}</span>
              <span className="boq-row-side">
                <strong>{money(cost.total)} AZN</strong>
                <button type="button" className="icon-btn boq-del" aria-label={`${row.name} sil`} onClick={() => patch((state) => ({ ...state, boq: { ...state.boq, gear: (state.boq.gear ?? []).filter((item) => item.id !== row.id) } }))}><Icon name="bin" /></button>
              </span>
            </div>
            )
          })}
          <div className="form-row wide">
            <label>Texnika
              <Select value={gear.name} onValueChange={(name) => setGear({ ...gear, name })} options={[{ value: "", label: "Seçin" }, ...GEAR_KINDS.map((name) => ({ value: name, label: name }))]} />
            </label>
            <label>Say<input value={gear.count} onChange={(event) => setGear({ ...gear, count: event.target.value })} /></label>
            <label>Ölçü
              <Select value={gear.basis} onValueChange={(basis) => setGear({ ...gear, basis: basis as GearBasis })} options={[{ value: "saat", label: "Saat" }, { value: "novbe", label: "Növbə" }, { value: "gun", label: "Gün" }, { value: "ay", label: "Ay" }, { value: "hecm", label: "Həcm" }]} />
            </label>
            <label>İcarə, AZN<input value={gear.rate} onChange={(event) => setGear({ ...gear, rate: event.target.value })} /></label>
            <label>Müddət<input value={gear.span} onChange={(event) => setGear({ ...gear, span: event.target.value })} /></label>
            <label>Yanacaq<input value={gear.fuel} onChange={(event) => setGear({ ...gear, fuel: event.target.value })} /></label>
            <label>Operator<input value={gear.operator} onChange={(event) => setGear({ ...gear, operator: event.target.value })} /></label>
            <label>Minimum<input value={gear.minSpan} onChange={(event) => setGear({ ...gear, minSpan: event.target.value })} /></label>
            <label>Sığorta, AZN<input value={gear.insurance} onChange={(event) => setGear({ ...gear, insurance: event.target.value })} /></label>
            <button type="button" className="btn" onClick={() => { if (!gear.name.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, gear: [...(state.boq.gear ?? []), { ...gear, id: uid() }] } })); setGear({ name: "", count: "", insurance: "", basis: gear.basis, rate: "", span: "", fuel: "", operator: "", minSpan: "" }) }}>Əlavə et</button>
          </div>
        </section>
      </div>
      <section className="panel pad">
        <div className="panel-head">
          <h2>İdarəetmə</h2>
        </div>
        <label className="manage-note">Layihə necə idarə olunacaq
          <textarea value={boq.management ?? ""} onChange={(event) => patch((state) => ({ ...state, boq: { ...state.boq, management: event.target.value } }))} placeholder="Forma, heyət və texnika tender mətninə buradan düşəcək" />
        </label>
        {!(boq.management ?? "").trim() && <p className="lede">İdarəetmə mətni yazılmayıb.</p>}
      </section>
    </div>
  )
}

function filledPartner(row: Partner): Partner {
  return {
    ...row,
    note: row.note ?? "",
    logo: row.logo ?? "",
    commission: row.commission ?? "",
    discount: row.discount ?? "",
    light: row.light ?? "gozleme",
    proof: row.proof ?? "",
    proofDate: row.proofDate ?? "",
    api: row.api ?? "bagli",
  }
}

type BondStatus = "tesdiq" | "gozleme" | "paket" | "legv"
type BondPaper = { name: string; file: string; ready: boolean }
type BondCase = {
  id: string
  project: string
  buyer: string
  kind: "istirak" | "icra" | "avans"
  mode: "percent" | "fixed"
  base: string
  rate: string
  offer: string
  bank: string
  days: string
  until: string
  opened: string
  status: BondStatus
  reviewed: boolean
  packed: boolean
  note: string
  papers: BondPaper[]
}
type DeskBank = {
  id: string
  name: string
  short: string
  commission: string
  discount: string
  light: Partner["light"]
  proof: string
  proofDate: string
  api: Partner["api"]
  term: string
  contact: string
  live: boolean
}
type LiveBond = {
  id: string
  kind: string
  mode: string
  amount: unknown
  rate: unknown
  buyer: string
  title: string
  days: number | null
  packed: boolean
  light: string
  partner: { name: string } | null
}

const KIND_LABEL: Record<string, string> = { istirak: "İştirak", icra: "İcra", avans: "Avans" }

const BOND_STATUS: Record<BondStatus, { word: string; tone: "ok" | "wait" | "stop" }> = {
  tesdiq: { word: "Təsdiq", tone: "ok" },
  gozleme: { word: "Bank gözləyir", tone: "wait" },
  paket: { word: "Paket hazırdır", tone: "wait" },
  legv: { word: "Ləğv", tone: "stop" },
}

const BOND_BANKS: Omit<DeskBank, "live">[] = [
  { id: "abb", name: "Azərbaycan Beynəlxalq Bankı", short: "ABB", commission: "1.2", discount: "0.3", light: "tesdiq", proof: "Əməkdaşlıq məktubu 14/2026", proofDate: "2026-09-01", api: "bagli", term: "5 iş günü", contact: "qarant@abb.example" },
  { id: "kapital", name: "Kapital Bank", short: "Kapital", commission: "1.4", discount: "0.2", light: "tesdiq", proof: "Limit məktubu 22/2026", proofDate: "2026-08-18", api: "novbe", term: "4 iş günü", contact: "tender@kapital.example" },
  { id: "pasha", name: "Paşa Bank", short: "Paşa", commission: "1.5", discount: "", light: "gozleme", proof: "", proofDate: "", api: "bagli", term: "7 iş günü", contact: "korporativ@pasha.example" },
  { id: "respublika", name: "Bank Respublika", short: "Respublika", commission: "1.8", discount: "0.5", light: "tesdiq", proof: "Çərçivə sazişi 3/2026", proofDate: "2026-06-02", api: "bagli", term: "6 iş günü", contact: "qarantiya@respublika.example" },
]

const BOND_CASES: BondCase[] = [
  {
    id: "QR-2414",
    project: "Xəzər Business Center",
    buyer: "Xəzər Development MMC",
    kind: "avans",
    mode: "percent",
    base: "2140000",
    rate: "15",
    offer: "",
    bank: "Kapital Bank",
    days: "120",
    until: "2027-02-11",
    opened: "2026-10-08",
    status: "gozleme",
    reviewed: true,
    packed: true,
    note: "Avans məktubu 8 oktyabrda banka gedib. Əlavə sənəd istənilməyib.",
    papers: [
      { name: "Texniki tapşırıq", file: "TT-Xezar-04.pdf", ready: true },
      { name: "Müqavilə layihəsi", file: "Muqavile-xezar.pdf", ready: true },
      { name: "İxtisas sənədi", file: "Ixtisas-2026.pdf", ready: true },
      { name: "Oxşar iş sübutu", file: "", ready: false },
    ],
  },
  {
    id: "QR-2408",
    project: "Port Baku Residence",
    buyer: "Pasha Construction",
    kind: "icra",
    mode: "percent",
    base: "4860000",
    rate: "5",
    offer: "4.7",
    bank: "Azərbaycan Beynəlxalq Bankı",
    days: "180",
    until: "2027-04-12",
    opened: "2026-09-18",
    status: "tesdiq",
    reviewed: true,
    packed: true,
    note: "İcra qarantiyası 12 sentyabr tarixli məktubla təsdiqlənib. Güzəşt 0,3 faizdir.",
    papers: [
      { name: "Texniki tapşırıq", file: "TT-Port-07.pdf", ready: true },
      { name: "Müqavilə layihəsi", file: "Muqavile-port.pdf", ready: true },
      { name: "İxtisas sənədi", file: "Ixtisas-2026.pdf", ready: true },
      { name: "Oxşar iş sübutu", file: "Oxsar-yasamal.pdf", ready: true },
    ],
  },
  {
    id: "QR-2391",
    project: "Xırdalan məktəbi",
    buyer: "Abşeron Rayon Təhsil Şöbəsi",
    kind: "istirak",
    mode: "percent",
    base: "840000",
    rate: "2",
    offer: "",
    bank: "Azərbaycan Beynəlxalq Bankı",
    days: "90",
    until: "2027-01-07",
    opened: "2026-10-09",
    status: "paket",
    reviewed: true,
    packed: false,
    note: "Paket yığılıb, hələ banka ötürülməyib. Tender müddəti 21 oktyabrdır.",
    papers: [
      { name: "Texniki tapşırıq", file: "TT-mekteb.pdf", ready: true },
      { name: "Müqavilə layihəsi", file: "Muqavile-mekteb.pdf", ready: true },
      { name: "İxtisas sənədi", file: "Ixtisas-2026.pdf", ready: true },
      { name: "Oxşar iş sübutu", file: "Oxsar-mekteb.pdf", ready: true },
    ],
  },
  {
    id: "QR-2377",
    project: "Sumqayıt Lojistik Park",
    buyer: "Sumqayıt Kimya Sənaye Parkı",
    kind: "icra",
    mode: "percent",
    base: "1920000",
    rate: "10",
    offer: "5",
    bank: "Paşa Bank",
    days: "150",
    until: "2027-03-02",
    opened: "2026-10-02",
    status: "gozleme",
    reviewed: true,
    packed: true,
    note: "KOB güzəşti 5% yazılıb. Bankın təsdiq məktubu hələ gəlməyib.",
    papers: [
      { name: "Texniki tapşırıq", file: "TT-Sumqayit.pdf", ready: true },
      { name: "Müqavilə layihəsi", file: "", ready: false },
      { name: "İxtisas sənədi", file: "Ixtisas-2026.pdf", ready: true },
      { name: "Oxşar iş sübutu", file: "Oxsar-park.pdf", ready: true },
    ],
  },
  {
    id: "QR-2388",
    project: "Abşeron Villa Qrupu",
    buyer: "Abşeron Villaları MMC",
    kind: "avans",
    mode: "percent",
    base: "640000",
    rate: "20",
    offer: "",
    bank: "Azərbaycan Beynəlxalq Bankı",
    days: "90",
    until: "2026-12-20",
    opened: "2026-09-22",
    status: "tesdiq",
    reviewed: true,
    packed: true,
    note: "Avans qarantiyası təhvilə qədər qüvvədədir. 20 dekabrda bitir.",
    papers: [
      { name: "Texniki tapşırıq", file: "TT-Villa.pdf", ready: true },
      { name: "Müqavilə layihəsi", file: "Muqavile-villa.pdf", ready: true },
      { name: "İxtisas sənədi", file: "Ixtisas-2026.pdf", ready: true },
      { name: "Oxşar iş sübutu", file: "Oxsar-merdekan.pdf", ready: true },
    ],
  },
  {
    id: "QR-2420",
    project: "Gəncə Şəhər Klinikası",
    buyer: "Gəncə Şəhər İcra Hakimiyyəti",
    kind: "istirak",
    mode: "fixed",
    base: "12000",
    rate: "",
    offer: "",
    bank: "Bank Respublika",
    days: "60",
    until: "2026-09-30",
    opened: "2026-08-12",
    status: "legv",
    reviewed: true,
    packed: true,
    note: "Tender bağlandı. Zəmanət məbləği geri qaytarılır.",
    papers: [
      { name: "Texniki tapşırıq", file: "TT-Klinika.pdf", ready: true },
      { name: "Müqavilə layihəsi", file: "Muqavile-klinika.pdf", ready: true },
      { name: "İxtisas sənədi", file: "Ixtisas-2026.pdf", ready: true },
      { name: "Oxşar iş sübutu", file: "", ready: false },
    ],
  },
]

function bondMath(row: { mode: "percent" | "fixed"; base: string; rate: string; offer: string }) {
  return guaranteeAmount({ kind: "", mode: row.mode, amount: row.base, rate: row.rate, offer: row.offer, light: "gozleme", bankId: "", reviewed: false, packed: false })
}

function daysLeft(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return "—"
  const end = Date.UTC(year, month - 1, day)
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const left = Math.round((end - today) / 864e5)
  if (left < 0) return "Müddət bitib"
  if (left === 0) return "Bu gün bitir"
  return `${left} gün qalıb`
}

function deskBanks(live: Partner[]): DeskBank[] {
  const used = new Set<string>()
  const rows: DeskBank[] = BOND_BANKS.map((sample) => {
    const match = live.find((item) => item.name === sample.name)
    if (match) used.add(match.id)
    return {
      ...sample,
      id: match?.id || sample.id,
      live: Boolean(match),
      commission: match?.commission.trim() ? match.commission : sample.commission,
      discount: match?.discount.trim() ? match.discount : sample.discount,
      light: match?.light || sample.light,
      proof: match?.proof.trim() ? match.proof : sample.proof,
      proofDate: match?.proofDate.trim() ? match.proofDate : sample.proofDate,
      api: match?.api || sample.api,
    }
  })
  for (const item of live) {
    if (used.has(item.id)) continue
    rows.push({
      id: item.id,
      name: item.name || "Adsız bank",
      short: markOf(item.name),
      commission: item.commission,
      discount: item.discount,
      light: item.light,
      proof: item.proof,
      proofDate: item.proofDate,
      api: item.api,
      term: "Sənəd mübadiləsi",
      contact: "",
      live: true,
    })
  }
  return rows
}

export function GuaranteePage() {
  useTitle("Qarantiya")
  const { guarantee, tender, partners, cabinet } = useWorkspace()
  const math = guaranteeAmount(guarantee)
  const suggested = tenderMath(tender)
  const banks = useMemo(() => partners.filter((item) => item.kind === "Bank").map(filledPartner), [partners])
  const desk = useMemo(() => deskBanks(banks), [banks])
  const bank = desk.find((item) => item.id === guarantee.bankId)
  const tone = bank ? bankTone(bank) : { color: "wait" as const, word: "Bank seçilməyib" }
  const [caseId, setCaseId] = useState(BOND_CASES[0].id)
  const [filter, setFilter] = useState("hamisi")
  const [projectQuery, setProjectQuery] = useState("")
  const [bankQuery, setBankQuery] = useState("")
  const [packNote, setPackNote] = useState("")
  const [live, setLive] = useState<LiveBond[]>([])
  const active = BOND_CASES.find((item) => item.id === caseId) ?? BOND_CASES[0]
  const days = active.days || (guarantee.kind === "istirak" ? tender.bondDays : tender.performDays)
  const feeRate = Number(bank?.commission) || 0
  const fee = math.applied * feeRate / 100
  const openCases = BOND_CASES.filter((item) => item.status !== "legv")
  const waiting = BOND_CASES.filter((item) => item.status === "gozleme").length
  const confirmed = BOND_CASES.filter((item) => item.status === "tesdiq").length
  const exposure = openCases.reduce((sum, item) => sum + bondMath(item).applied, 0)
  const readyPapers = active.papers.filter((item) => item.ready).length
  const projectQueryText = projectQuery.trim().toLocaleLowerCase("az")
  const bankQueryText = bankQuery.trim().toLocaleLowerCase("az")
  const projectRows = BOND_CASES.filter((item) => {
    if (filter !== "hamisi" && item.status !== filter) return false
    if (!projectQueryText) return true
    const bankName = BOND_BANKS.find((row) => row.name === item.bank)?.short || item.bank
    return `${item.project} ${item.buyer} ${item.id} ${item.bank} ${bankName} ${KIND_LABEL[item.kind]} ${BOND_STATUS[item.status].word}`.toLocaleLowerCase("az").includes(projectQueryText)
  })
  const bankRows = desk.filter((item) => !bankQueryText || `${item.name} ${item.short}`.toLocaleLowerCase("az").includes(bankQueryText))
  const liveRows = live.filter((item) => !BOND_CASES.some((row) => item.title.includes(row.project)))

  useEffect(() => {
    loadPartners().catch((reason) => setPackNote(reason instanceof ApiError ? reason.message : "Banklar oxunmadı"))
    api<LiveBond[]>("/api/platform/finance/guarantees")
      .then(setLive)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (desk.some((item) => item.id === guarantee.bankId)) return
    const named = BOND_BANKS.find((item) => item.id === guarantee.bankId)
    const next = named ? desk.find((item) => item.name === named.name) : undefined
    if (!next) return
    patch((state) => ({ ...state, guarantee: { ...state.guarantee, bankId: next.id } }))
  }, [desk, guarantee.bankId])

  useEffect(() => {
    if (guarantee.amount.trim()) return
    const first = BOND_CASES[0]
    const match = desk.find((item) => item.name === first.bank)
    patch((state) => ({
      ...state,
      guarantee: {
        ...state.guarantee,
        kind: first.kind,
        mode: first.mode,
        amount: first.base,
        rate: first.rate,
        offer: first.offer,
        bankId: match?.id || first.bank,
        reviewed: first.reviewed,
        packed: first.packed,
        light: first.status === "tesdiq" ? "tesdiq" : first.status === "legv" ? "legv" : "gozleme",
      },
    }))
  }, [desk, guarantee.amount])

  function openCase(item: BondCase) {
    const match = desk.find((row) => row.name === item.bank)
    setCaseId(item.id)
    setPackNote("")
    patch((state) => ({
      ...state,
      guarantee: {
        ...state.guarantee,
        kind: item.kind,
        mode: item.mode,
        amount: item.base,
        rate: item.rate,
        offer: item.offer,
        bankId: match?.id || item.bank,
        reviewed: item.reviewed,
        packed: item.packed,
        light: item.status === "tesdiq" ? "tesdiq" : item.status === "legv" ? "legv" : "gozleme",
      },
    }))
  }

  function pull() {
    if (!tender.opened) return
    patch((state) => ({
      ...state,
      guarantee: state.guarantee.kind === "istirak"
        ? { ...state.guarantee, packed: false, mode: state.tender.bidMode, amount: state.tender.bidMode === "fixed" ? state.tender.bidValue : state.tender.price, rate: state.tender.bidValue }
        : state.guarantee.kind === "avans"
          ? { ...state.guarantee, packed: false, mode: "percent", amount: state.tender.price, rate: state.tender.advance || "0" }
          : { ...state.guarantee, packed: false, mode: "percent", amount: state.tender.price, rate: String(suggested.performRate), offer: state.tender.discount },
    }))
  }

  async function pack() {
    if (!bank || !guarantee.reviewed) return
    const papers = active.papers.map((item) => [item.name, item.file])
    if (!bank.live) {
      patch((state) => ({ ...state, guarantee: { ...state.guarantee, packed: true, light: "gozleme" } }))
      setPackNote("Nümunə bankdır. Reyestrdəki bank seçiləndə paket bazaya yazılır.")
      return
    }
    try {
      await api("/api/platform/finance/guarantees", {
        method: "POST",
        body: JSON.stringify({
          kind: guarantee.kind,
          mode: guarantee.mode,
          base: guarantee.amount,
          value: guarantee.mode === "percent" ? guarantee.rate : guarantee.amount,
          partnerId: guarantee.bankId,
          buyer: active.buyer || tender.buyer,
          title: active.project || tender.subject,
          days,
          consent: true,
        }),
      })
      await api("/api/platform/finance/applications", {
        method: "POST",
        body: JSON.stringify({
          consent: true,
          kind: "qarant",
          partnerId: guarantee.bankId,
          amount: math.applied,
          purpose: active.project || tender.subject || "Bank zəmanəti",
          payload: { buyer: active.buyer || tender.buyer, days, papers },
        }),
      })
      const rows = await api<LiveBond[]>("/api/platform/finance/guarantees")
      setLive(rows)
      patch((state) => ({ ...state, guarantee: { ...state.guarantee, packed: true, light: "gozleme" } }))
      setPackNote("Paket bazada saxlandı. Qərar bankındır, status əl ilə yazılır.")
    } catch (reason) {
      setPackNote(reason instanceof ApiError ? reason.message : "Paket saxlanmadı")
    }
  }

  return (
    <div className="qar">
      <PageHead
        kicker="Bank"
        title="Bank qarantiyası"
        text="Altı işin zəmanət paketi. Məbləğ şərtdən hesablanır, qərar bankındır, sənəd mübadiləsi API bağlı olanda da gedir."
      />

      <section className="statstrip">
        <article>
          <span>Açıq iş</span>
          <strong>{openCases.length}</strong>
          <em>{BOND_CASES.length} paketdən {BOND_CASES.length - openCases.length} bağlanıb</em>
        </article>
        <article>
          <span>Təminat</span>
          <strong>{money(exposure)}</strong>
          <em>AZN, ləğv olunmayanlar</em>
        </article>
        <article>
          <span>Bank gözləyir</span>
          <strong>{waiting}</strong>
          <em className={waiting ? "warn" : undefined}>{waiting ? "Qərar hələ yazılmayıb" : "Gözləyən iş yoxdur"}</em>
        </article>
        <article>
          <span>Təsdiq</span>
          <strong>{confirmed}</strong>
          <em>Məktubu olan zəmanət</em>
        </article>
      </section>

      <div className="library">
        <div className="library-bar">
          <div>
            <strong>{BOND_CASES.length} layihə</strong>
            <span>{openCases.length} açıq · {money(exposure)} AZN təminat</span>
          </div>
          <Select
            ariaLabel="Layihə statusu"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "hamisi", label: "Hamısı" },
              { value: "gozleme", label: "Gözləyir" },
              { value: "paket", label: "Paket" },
              { value: "tesdiq", label: "Təsdiq" },
              { value: "legv", label: "Ləğv" },
            ]}
          />
        </div>
        <div className="library-body">
          <div className="file-index">
            <label className="file-find">
              <Icon name="search" />
              <input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Layihə axtar" aria-label="Layihə axtar" />
            </label>
            <div className="file-list">
              {projectRows.map((item) => {
                const amount = bondMath(item)
                const status = BOND_STATUS[item.status]
                const short = BOND_BANKS.find((row) => row.name === item.bank)?.short || item.bank
                return (
                  <button key={item.id} type="button" className={item.id === active.id ? "file-card on" : "file-card"} aria-pressed={item.id === active.id} onClick={() => openCase(item)}>
                    <em>{KIND_LABEL[item.kind]}</em>
                    <span className="file-card-copy">
                      <strong>{item.project}</strong>
                      <small>{money(amount.applied)} AZN · {short} · {status.word}</small>
                    </span>
                  </button>
                )
              })}
              {filter === "hamisi" && !projectQueryText && liveRows.map((item) => (
                <div key={item.id} className="file-card">
                  <em>{KIND_LABEL[item.kind] || item.kind}</em>
                  <span className="file-card-copy">
                    <strong>{item.title || "Adsız paket"}</strong>
                    <small>Baza · {item.partner?.name || "bank yoxdur"} · {money(Number(dec(item.amount)) || 0)} AZN</small>
                  </span>
                </div>
              ))}
              {projectRows.length === 0 && <p className="lede">Uyğun layihə yoxdur.</p>}
            </div>
          </div>
          <section className="file-sheet">
            <header>
              <div>
                <p>{active.id} · {KIND_LABEL[active.kind]} · {BOND_STATUS[active.status].word} · {dateAZ(active.opened)}</p>
                <h2>{active.project}</h2>
                <p>{active.buyer} · {bank?.name || active.bank} · {daysLeft(active.until)}</p>
              </div>
              <strong className="qar-sheet-sum">{money(math.applied)} AZN</strong>
            </header>
            <p className="lede">{active.note}</p>
            <h3 className="qar-block">Müraciət paketi</h3>
            <div className="step-row"><span>Şirkət</span><strong>{cabinet.name.trim() || "AFEZ İnşaat"} · {cabinet.voen.trim() || "1700123451"}</strong></div>
            <div className="step-row"><span>Sənəd</span><strong>{readyPapers}/{active.papers.length} hazırdır</strong></div>
            <div className="step-row"><span>Qüvvədə</span><strong>{days} gün · {dateAZ(active.until)}</strong></div>
            <div className="qar-docs">
              {active.papers.map((item) => (
                <article key={item.name} className={item.ready ? "ready" : "miss"}>
                  <span />
                  <div>
                    <strong>{item.name}</strong>
                    <em>{item.ready ? item.file : "Fayl çatışmır"}</em>
                  </div>
                  <b>{item.ready ? "Hazırdır" : "Çatışmır"}</b>
                </article>
              ))}
            </div>
            <Meter value={active.papers.length ? (readyPapers / active.papers.length) * 100 : 0} tone={readyPapers === active.papers.length ? "pine" : "copper"} />
            <div className="qar-actions">
              <label className="qar-check">
                <input type="checkbox" checked={guarantee.reviewed} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, reviewed: event.target.checked, packed: false } }))} />
                Şirkət paketi yoxladı
              </label>
              <button type="button" className="qar-action" onClick={() => void pack()} disabled={!bank || !guarantee.reviewed}>Sənəd mübadiləsinə hazırla</button>
              <button type="button" className="qar-action" onClick={pull} disabled={!tender.opened}>Yazılmış şərti gətir</button>
            </div>
            <p className="lede">{packNote || (guarantee.packed ? "Paket sənəd mübadiləsi üçün hazırdır. Bank API-si bağlı olsa da proses dayanmır." : "Paket bank seçiləndən və yoxlamadan sonra açılır.")}</p>
            <h3 className="qar-block">Hesab</h3>
            <div className="form-row wide">
              <label>Növ<Select value={guarantee.kind} onValueChange={(kind) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, kind, packed: false } }))} options={[{ value: "istirak", label: "İştirak" }, { value: "icra", label: "İcra" }, { value: "avans", label: "Avans" }]} /></label>
              <label>Hesab<Select value={guarantee.mode} onValueChange={(mode) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, mode: mode as "percent" | "fixed", packed: false } }))} options={[{ value: "percent", label: "Faiz" }, { value: "fixed", label: "Sabit məbləğ" }]} /></label>
              <label>Baza, AZN<input value={guarantee.amount} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, amount: event.target.value, packed: false } }))} /></label>
              <label>Şərtdəki faiz<input value={guarantee.rate} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, rate: event.target.value, packed: false } }))} disabled={guarantee.mode === "fixed"} /></label>
              <label>Bank güzəşti, %<input value={guarantee.offer} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, offer: event.target.value, packed: false } }))} placeholder="boşdursa şərt qalır" disabled={guarantee.mode === "fixed"} /></label>
            </div>
            {tender.opened && <p className="lede">Tender şərti: iştirak {money(suggested.bid)} AZN, icra {money(suggested.perform)} AZN, avans {money(suggested.advance)} AZN.</p>}
            <div className="step-row"><span>Şərt üzrə</span><strong>{money(math.asked)} AZN</strong></div>
            <div className="step-row"><span>Tətbiq olunan</span><strong>{money(math.applied)} AZN{guarantee.mode === "percent" ? ` · ${math.rate}%` : ""}</strong></div>
            <div className="step-row"><span>Komissiya</span><strong>{bank?.commission.trim() ? `${bank.commission}% · ${money(fee)} AZN` : "Yazılmayıb"}</strong></div>
          </section>
        </div>
      </div>

      <div className="library">
        <div className="library-bar">
          <div>
            <strong>{desk.length} bank</strong>
            <span>{active.project} üçün {bank?.short || active.bank}</span>
          </div>
          <Link to="/partnyorlar">Reyestr</Link>
        </div>
        <div className="library-body">
          <div className="file-index">
            <label className="file-find">
              <Icon name="search" />
              <input value={bankQuery} onChange={(event) => setBankQuery(event.target.value)} placeholder="Bank axtar" aria-label="Bank axtar" />
            </label>
            <div className="file-list">
              {bankRows.map((item) => {
                const itemTone = bankTone(item)
                const on = item.id === guarantee.bankId
                return (
                  <button key={item.id} type="button" className={on ? "file-card on" : "file-card"} aria-pressed={on} onClick={() => patch((state) => ({ ...state, guarantee: { ...state.guarantee, bankId: item.id, packed: false } }))}>
                    <em>{item.short.slice(0, 3)}</em>
                    <span className="file-card-copy">
                      <strong>{item.name}</strong>
                      <small>Komissiya {item.commission.trim() ? `${item.commission}%` : "—"} · {itemTone.word}</small>
                    </span>
                  </button>
                )
              })}
              {bankRows.length === 0 && <p className="lede">Uyğun bank yoxdur.</p>}
            </div>
          </div>
          {bank && (
            <section className="file-sheet">
              <header>
                <div>
                  <p>{bank.short} · {tone.word}</p>
                  <h2>{bank.name}</h2>
                  <p>{bank.api === "novbe" ? "Kanal növbədədir" : "Sənəd mübadiləsi"}{bank.live ? " · reyestrdə" : ""} · {bank.term}</p>
                </div>
                <strong className="qar-sheet-sum">{bank.commission.trim() ? `${bank.commission}%` : "—"}</strong>
              </header>
              <div className="step-row"><span>Komissiya</span><strong>{bank.commission.trim() ? `${bank.commission}% · ${money(fee)} AZN` : "Yazılmayıb"}</strong></div>
              <div className="step-row"><span>Güzəşt</span><strong>{bank.discount.trim() ? `${bank.discount}%` : "Yoxdur"}</strong></div>
              <div className="step-row"><span>Təsdiq sənədi</span><strong>{bank.proof.trim() ? `${bank.proof} · ${dateAZ(bank.proofDate)}` : "Sənəd yoxdur"}</strong></div>
              {bank.contact && <div className="step-row"><span>Əlaqə</span><strong>{bank.contact}</strong></div>}
              <div className="qar-actions">
                <button type="button" className="qar-action" disabled={!bank.discount.trim() || guarantee.mode === "fixed"} onClick={() => patch((state) => ({ ...state, guarantee: { ...state.guarantee, offer: bank.discount, packed: false } }))}>Güzəşti tətbiq et</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

const SPEC_GUIDE: Record<string, { group: string; question: string; paper: string }> = {
  "01100 İcmal": {
    group: "Ümumi şərtlər",
    question: "İşin həcmi, sərhədi və kimin nəyə cavabdeh olduğu bir yerdə yazılıbmı?",
    paper: "Texniki tapşırıq və müqavilənin predmeti",
  },
  "01200 Keyfiyyət təminatı": {
    group: "Ümumi şərtlər",
    question: "Keyfiyyəti kim yoxlayır və hansı qayda ilə?",
    paper: "Keyfiyyət planı",
  },
  "01330 Sənəd təhvili": {
    group: "Ümumi şərtlər",
    question: "Hansı sənəd, kimə və nə vaxt təhvil verilməlidir?",
    paper: "Təhvil siyahısı",
  },
  "01400 Keyfiyyət tələbləri": {
    group: "Ümumi şərtlər",
    question: "Qəbul meyarı və yol verilən kənarlaşma yazılıbmı?",
    paper: "Texniki şərt",
  },
  "01500 Müvəqqəti qurğular": {
    group: "Ümumi şərtlər",
    question: "Sahədə müvəqqəti tikili, yol və mühafizə nəzərdə tutulubmu?",
    paper: "Sahənin təşkili sxemi",
  },
  "01600 Məhsul tələbləri": {
    group: "Ümumi şərtlər",
    question: "Material və məmulat hansı standartla gəlməlidir?",
    paper: "Məhsul siyahısı və standart",
  },
  "03300 Yerində tökülən beton": {
    group: "Material və konstruksiya",
    question: "Betonun markası, tökülmə və baxım qaydası sənəddə varmı?",
    paper: "Beton resepti və tökmə jurnalı",
  },
  "05120 Konstruktiv polad": {
    group: "Material və konstruksiya",
    question: "Poladın markası, birləşmə və qoruyucu örtük yazılıbmı?",
    paper: "Konstruksiya cizgisi və sertifikat",
  },
  "Sınaq və sertifikat": {
    group: "Sınaq",
    question: "Hər partiya üçün sınaq protokolu və sertifikat varmı?",
    paper: "Material pasportu",
  },
}

const SPEC_GROUPS = ["Ümumi şərtlər", "Material və konstruksiya", "Sınaq"] as const

const FIT_HINT: Record<Fit, string> = {
  uygun: "Sənəd tələblə üst-üstə düşür.",
  deyil: "Sənəd var, amma tələbə uyğun gəlmir.",
  catismir: "Bu bölmə üçün sənəd tapılmayıb.",
  gozleyir: "Sənəd göndərilib, cavab hələ gəlməyib.",
  el: "Hələ heç kim yoxlamayıb.",
}

const FIT_OPTIONS = (Object.keys(FIT_LABEL) as Fit[]).map((key) => ({ value: key, label: FIT_LABEL[key] }))

function sectionBits(name: string) {
  const match = /^(\d+)\s+(.+)$/.exec(name)
  if (!match) return { code: "", title: name }
  return { code: match[1], title: match[2] }
}

function knownFit(value: string | undefined): Fit {
  return value && value in FIT_LABEL ? value as Fit : "el"
}

function writeFit(name: string, fit: Fit) {
  patch((state) => {
    const known = new Set<string>(SPEC_SECTIONS)
    const base = SPEC_SECTIONS.map((section) => ({
      name: section,
      fit: section === name ? fit : knownFit(state.spec.find((item) => item.name === section)?.fit),
    }))
    const extra = state.spec
      .filter((item) => !known.has(item.name))
      .map((item) => ({ name: item.name, fit: item.name === name ? fit : knownFit(item.fit) }))
    return { ...state, spec: [...base, ...extra] }
  })
}

export function SpecPage() {
  useTitle("Spesifikasiya")
  const { spec } = useWorkspace()
  const [filter, setFilter] = useState("hamisi")

  const rows = [
    ...SPEC_SECTIONS.map((name) => ({
      name,
      fit: knownFit(spec.find((item) => item.name === name)?.fit),
      group: SPEC_GUIDE[name]?.group ?? "Digər",
      question: SPEC_GUIDE[name]?.question ?? "Bu bölmənin sənədi tələblə tutuşdurulubmu?",
      paper: SPEC_GUIDE[name]?.paper ?? "Layihə sənədi",
      ...sectionBits(name),
    })),
    ...spec
      .filter((item) => !SPEC_SECTIONS.includes(item.name))
      .map((item) => ({
        name: item.name,
        fit: knownFit(item.fit),
        group: "Digər",
        question: "Bu bölmənin sənədi tələblə tutuşdurulubmu?",
        paper: "Layihə sənədi",
        ...sectionBits(item.name),
      })),
  ]

  const decided = rows.filter((row) => row.fit !== "el").length
  const problems = rows.filter((row) => row.fit === "deyil" || row.fit === "catismir").length
  const waiting = rows.filter((row) => row.fit === "gozleyir").length
  const ok = rows.filter((row) => row.fit === "uygun").length
  const shown = rows.filter((row) => {
    if (filter === "el") return row.fit === "el"
    if (filter === "problem") return row.fit === "deyil" || row.fit === "catismir"
    if (filter === "gozleyir") return row.fit === "gozleyir"
    if (filter === "uygun") return row.fit === "uygun"
    return true
  })
  const groups = [...SPEC_GROUPS, "Digər"]
    .map((group) => ({ group, items: shown.filter((row) => row.group === group) }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="spec-page">
      <PageHead
        kicker="Sənəd yoxlaması"
        title="Spesifikasiya"
        text="Hər kart bir sualdır: şirkətin sənədi bu tələbə cavab verirmi? Nömrə şablon kodudur. Qərarı siz yazırsınız, siyahı bütün layihələr üçün eynidir."
      />
      {decided === 0 && (
        <section className="panel pad spec-start">
          <div>
            <h2>Necə yoxlanılır</h2>
            <p className="lede">Siyahı artıq açıqdır. Heç nə seçilməyibsə, bölmə hələ yoxlanılmayıb. Nəticəni seçəndə qərar yadda qalır.</p>
          </div>
          <ol className="spec-steps">
            <li>
              <b>1</b>
              <strong>Sualı oxuyun</strong>
              <span>Kart bölmənin nəyi yoxladığını sadə dildə deyir.</span>
            </li>
            <li>
              <b>2</b>
              <strong>Sənədə baxın</strong>
              <span>Hər kartda hansı kağıza baxmaq lazım olduğu yazılıb.</span>
            </li>
            <li>
              <b>3</b>
              <strong>Nəticəni seçin</strong>
              <span>Uyğundur, uyğun deyil, sənəd çatışmır və ya təsdiq gözləyir.</span>
            </li>
          </ol>
        </section>
      )}
      <section className="statstrip">
        <article>
          <span>Yoxlanılıb</span>
          <strong>{decided}/{rows.length}</strong>
          <em>{rows.length - decided} bölmə hələ açıqdır</em>
        </article>
        <article>
          <span>Uyğundur</span>
          <strong>{ok}</strong>
          <em>Sənəd tələblə düşür</em>
        </article>
        <article>
          <span>Problem</span>
          <strong>{problems}</strong>
          <em className={problems ? "warn" : undefined}>{problems ? "Uyğun deyil və ya sənəd yoxdur" : "Açıq problem yoxdur"}</em>
        </article>
        <article>
          <span>Gözləyir</span>
          <strong>{waiting}</strong>
          <em>{waiting ? "Təsdiq cavabı gəlməyib" : "Gözləyən bölmə yoxdur"}</em>
        </article>
      </section>
      <section className="spec-progress" aria-label="Yoxlama gedişi">
        <div>
          <strong>{decided === rows.length ? "Bütün bölmələr yoxlanılıb" : `${rows.length - decided} bölmə hələ yoxlanılmayıb`}</strong>
          <span>{decided} qərar yazılıb, cəmi {rows.length} bölmə.</span>
        </div>
        <Meter value={rows.length ? (decided / rows.length) * 100 : 0} tone="pine" />
      </section>
      <section className="spec-legend" aria-label="Nəticələrin mənası">
        {(Object.keys(FIT_HINT) as Fit[]).map((key) => (
          <article key={key}>
            <span className={`badge ${fitTone(key)}`}>{FIT_LABEL[key]}</span>
            <p>{FIT_HINT[key]}</p>
          </article>
        ))}
      </section>
      <div className="toolbar">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { id: "hamisi", label: "Hamısı" },
            { id: "el", label: "Yoxlanılmayıb" },
            { id: "problem", label: "Problem" },
            { id: "gozleyir", label: "Gözləyir" },
            { id: "uygun", label: "Uyğundur" },
          ]}
        />
      </div>
      {shown.length === 0 && <Empty title="Bu süzgəcə düşən bölmə yoxdur" text="Başqa süzgəc seçin. Bölmələr siyahıda qalır, silinmir." />}
      {groups.map(({ group, items }) => (
        <section className="spec-group" key={group}>
          <h2>{group}</h2>
          <div className="spec-grid">
            {items.map((row) => (
              <article className={`spec-card ${fitTone(row.fit)}`} key={row.name}>
                <header>
                  <div>
                    {row.code ? <p className="spec-code">Şablon {row.code}</p> : <p className="spec-code">Əlavə bölmə</p>}
                    <h3>{row.title}</h3>
                  </div>
                  <span className={`badge ${fitTone(row.fit)}`}>{FIT_LABEL[row.fit]}</span>
                </header>
                <p>{row.question}</p>
                <p className="paper">Baxılacaq sənəd: {row.paper}</p>
                <label>
                  Nəticə
                  <Select ariaLabel={`${row.title} nəticəsi`} value={row.fit} onValueChange={(fit) => writeFit(row.name, fit as Fit)} options={FIT_OPTIONS} />
                </label>
                <p className="hint">{FIT_HINT[row.fit]}</p>
                {row.name === "Sınaq və sertifikat" && <Link className="btn ghost small" to="/pasport">Material pasportuna keç</Link>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

type ScheduleBook = {
  id: string
  bondDay: number | null
  project: { name: string } | null
  tasks: { id: string; name: string; startDay: number | null; endDay: number | null }[]
  weather: { id: string; rain: number | null; wind: number | null; pouring: boolean; stop: string; officer: string }[]
}

function showSchedule(book: ScheduleBook) {
  patch((state) => ({
    ...state,
    schedule: {
      bondDay: book.bondDay == null ? "" : String(book.bondDay),
      rows: book.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        start: task.startDay == null ? "" : String(task.startDay),
        end: task.endDay == null ? "" : String(task.endDay),
      })),
    },
    weather: {
      ...state.weather,
      log: book.weather.map((item) => ({
        id: item.id,
        rain: item.rain == null ? "" : String(item.rain),
        wind: item.wind == null ? "" : String(item.wind),
        pouring: item.pouring,
        stop: item.stop,
        officer: item.officer,
      })),
    },
  }))
}

export function SchedulePage() {
  useTitle("Qrafik")
  const { schedule, weather } = useWorkspace()
  const [books, setBooks] = useState<ScheduleBook[]>([])
  const [pick, setPick] = useState("")
  const [name, setName] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  useEffect(() => {
    api<ScheduleBook[]>("/api/platform/schedules")
      .then((rows) => {
        setBooks(rows)
        const first = rows[0]
        if (!first) return
        setPick(first.id)
        showSchedule(first)
      })
      .catch(() => undefined)
  }, [])
  const reserve = weather.log.filter((item) => item.stop !== "İş dayanmır").length
  const bondDay = schedule.bondDay ?? ""
  return (
    <>
      <PageHead kicker="Layihə" title="İş qrafiki" text="Gün nömrəsi ilə yazılır. Hava dayanması bitmə gününü ehtiyat qədər sürüşdürür." />
      <section className="panel pad">
        <h2 className="block-title">İcra qarantiyası</h2>
        {books.length > 0 && (
          <div className="form-row">
            <label>Obyekt
              <Select
                value={pick}
                onValueChange={(id) => {
                  setPick(id)
                  const book = books.find((item) => item.id === id)
                  if (book) showSchedule(book)
                }}
                options={books.map((item) => ({ value: item.id, label: `${item.project?.name || "Layihə"} · ${item.tasks.length} iş` }))}
              />
            </label>
          </div>
        )}
        <div className="form-row wide">
          <label>Təqdim günü<input value={bondDay} onChange={(event) => patch((state) => ({ ...state, schedule: { ...state.schedule, bondDay: event.target.value } }))} placeholder="gün nömrəsi" /></label>
        </div>
        <div className="step-row"><span>İcra qarantiyası təqdim olunmalıdır</span><strong>{bondDay.trim() ? `${bondDay} gün` : "Gün yazılmayıb"}</strong></div>
        <div className="form-row wide">
          <label>İş<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Başlanğıc gün<input value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>Bitmə gün<input value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          <button type="button" className="btn" onClick={() => { if (!name.trim()) return; patch((state) => ({ ...state, schedule: { ...state.schedule, rows: [...state.schedule.rows, { id: uid(), name, start, end }] } })); setName(""); setStart(""); setEnd("") }}>Əlavə et</button>
        </div>
        <div className="step-row"><span>Hava ehtiyatı</span><strong>{reserve} gün</strong></div>
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>İş</th><th>Başlanğıc</th><th>Bitmə</th><th>Hava ilə bitmə</th></tr></thead>
            <tbody>
              {schedule.rows.length === 0 && <tr><td colSpan={4}>Qrafik boşdur.</td></tr>}
              {schedule.rows.map((row) => {
                const shifted = shiftedDay(row.end, reserve)
                return <tr key={row.id}><td>{row.name}</td><td>{row.start || "—"}</td><td>{row.end || "—"}</td><td>{shifted || "Gün rəqəm deyil"}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

const emptyOffer = { name: "", category: CATEGORIES[0], price: "", vat: "xaric", source: "", updated: "", region: "", delivery: "", validUntil: "", unit: "" }

function offerPrice(value: string) {
  const raw = value.trim().replace(/\s/g, "").replace(",", ".")
  if (!raw) return ""
  const amount = Number(raw)
  if (!Number.isFinite(amount)) return value.trim()
  return money(amount)
}

function offerDate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return azDate(trimmed) || trimmed
}

function offerClosed(item: { stale?: boolean; validUntil: string }) {
  if (item.stale) return true
  const left = daysUntil(item.validUntil)
  return left != null && left < 0
}

function infoValue(value: string | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed || "yazılmayıb"
}

function infoRows(item: { name: string; category: string; price: string; vat: string; source: string; updated: string; region: string; delivery: string; validUntil: string; unit?: string; stale?: boolean }) {
  const closed = offerClosed(item)
  const amount = offerPrice(item.price)
  const until = item.validUntil.trim()
  const left = daysUntil(until)
  const untilText = !until ? "yazılmayıb" : `${offerDate(until)}${left != null && left < 0 ? " · müddəti bitib" : left != null && left <= 30 ? ` · ${left} gün qalıb` : ""}`
  const priceText = amount ? `${amount} AZN${item.unit?.trim() ? ` / ${item.unit.trim()}` : ""}` : "yazılmayıb"
  return [
    { label: "Kateqoriya", value: infoValue(item.category) },
    { label: "Vahid", value: infoValue(item.unit) },
    { label: "Alış qiyməti", value: closed && amount ? `${priceText} · müddəti bitib` : priceText, tone: !amount ? "miss" : closed ? "late" : undefined },
    { label: "ƏDV", value: item.vat === "daxil" ? "Daxil" : "Xaric" },
    { label: "Təchizatçı", value: infoValue(item.source), tone: item.source.trim() ? undefined : "miss" },
    { label: "Region", value: infoValue(item.region), tone: item.region.trim() ? undefined : "miss" },
    { label: "Çatdırılma", value: infoValue(item.delivery), tone: item.delivery.trim() ? undefined : "miss" },
    { label: "Tarix", value: item.updated.trim() ? offerDate(item.updated) : "yazılmayıb", tone: item.updated.trim() ? undefined : "miss" },
    { label: "Qüvvədədir", value: untilText, tone: !until ? "miss" : left != null && left < 0 ? "late" : left != null && left <= 30 ? "soon" : undefined },
  ]
}

export function MarketPage() {
  useTitle("Bazar")
  const { market } = useWorkspace()
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState(emptyOffer)
  const [find, setFind] = useState("")
  const [category, setCategory] = useState("hamisi")
  const [vat, setVat] = useState("hamisi")
  const [compose, setCompose] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    api<{ id: string; name: string; category: string; unit: string; price: unknown; supplier?: string; regions?: string; validUntil?: string | null }[]>("/api/platform/market/products")
      .then((rows) => {
        patch((state) => ({
          ...state,
          market: rows.map((row) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            price: row.price == null ? "" : String(row.price),
            vat: "xaric",
            source: row.supplier || "",
            updated: "",
            region: row.regions || "",
            delivery: "",
            unit: row.unit || "",
            validUntil: row.validUntil ? String(row.validUntil).slice(0, 10) : "",
            stale: row.price == null,
          })),
        }))
      })
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  const categories = useMemo(() => {
    const known = new Set<string>(CATEGORIES)
    const extra = market.map((item) => item.category).filter((item) => item && !known.has(item))
    return [...CATEGORIES, ...new Set(extra)]
  }, [market])

  const shown = useMemo(() => {
    const query = find.trim().toLocaleLowerCase("az")
    return market
      .filter((item) => {
        if (category !== "hamisi" && item.category !== category) return false
        if (vat !== "hamisi" && item.vat !== vat) return false
        if (!query) return true
        const hay = [item.name, item.category, item.source, item.region, item.unit, item.delivery].join(" ").toLocaleLowerCase("az")
        return hay.includes(query)
      })
      .sort((a, b) => {
        const rank = Number(offerClosed(a)) - Number(offerClosed(b))
        if (rank !== 0) return rank
        return a.name.localeCompare(b.name, "az")
      })
  }, [market, find, category, vat])

  const suppliers = new Set(market.map((item) => item.source.trim()).filter(Boolean)).size
  const live = market.filter((item) => item.price.trim() && !offerClosed(item)).length
  const attention = market.filter((item) => {
    if (offerClosed(item)) return true
    const left = daysUntil(item.validUntil)
    return left != null && left <= 30
  }).length

  function openNew() {
    setEditing(null)
    setForm(emptyOffer)
    setCompose(true)
  }

  function openEdit(item: (typeof market)[number]) {
    setEditing(item.id)
    setForm({
      name: item.name,
      category: item.category || CATEGORIES[0],
      price: item.price,
      vat: item.vat === "daxil" ? "daxil" : "xaric",
      source: item.source,
      updated: item.updated,
      region: item.region,
      delivery: item.delivery,
      validUntil: item.validUntil,
      unit: item.unit || "",
    })
    setCompose(true)
  }

  function save() {
    if (!form.name.trim()) return
    const row = { ...form, name: form.name.trim(), stale: false }
    patch((state) => ({
      ...state,
      market: editing
        ? state.market.map((item) => item.id === editing ? { ...item, ...row } : item)
        : [...state.market, { ...row, id: uid() }],
    }))
    setCompose(false)
    setEditing(null)
  }

  function remove(id: string) {
    patch((state) => ({ ...state, market: state.market.filter((item) => item.id !== id) }))
    setDrop(null)
  }

  const formCategories = form.category && !CATEGORIES.includes(form.category) ? [form.category, ...CATEGORIES] : CATEGORIES
  const viewed = market.find((item) => item.id === viewId) ?? null

  return (
    <div className="market-page">
      <PageHead kicker="Təchizat" title="Material bazarı" text="İstənilən şirkət sifariş verir. Kabinet ödənişlidir. Qiymətin ƏDV vəziyyəti seçilir.">
        <button type="button" className="btn" onClick={openNew}><Icon name="plus" /> Yeni</button>
      </PageHead>
      <section className="statstrip">
        <article>
          <span>Məhsul</span>
          <strong>{market.length}</strong>
          <em>Kataloq sətri</em>
        </article>
        <article>
          <span>Təchizatçı</span>
          <strong>{suppliers}</strong>
          <em>Şirkət sayı</em>
        </article>
        <article>
          <span>Canlı qiymət</span>
          <strong>{live}</strong>
          <em>Qüvvədə olan</em>
        </article>
        <article>
          <span>Diqqət</span>
          <strong>{attention}</strong>
          <em className={attention ? "warn" : undefined}>{attention ? "Bitib və ya 30 günə bitir" : "Yaxın bitmə yoxdur"}</em>
        </article>
      </section>
      <div className="toolbar market-toolbar">
        <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="search" />
          <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Məhsul, təchizatçı, region" aria-label="Bazarda axtar" />
        </form>
        <div className="market-filters">
          <Select
            value={category}
            onValueChange={setCategory}
            ariaLabel="Kateqoriya"
            options={[{ value: "hamisi", label: "Bütün kateqoriyalar" }, ...categories.map((item) => ({ value: item, label: item }))]}
          />
          <Tabs
            value={vat}
            onChange={setVat}
            options={[
              { id: "hamisi", label: "Hamısı" },
              { id: "xaric", label: "ƏDV xaric" },
              { id: "daxil", label: "ƏDV daxil" },
            ]}
          />
        </div>
      </div>
      {!ready && <p className="lede">Kataloq oxunur.</p>}
      {ready && market.length === 0 && <Empty title="Kataloq boşdur" text="Yeni düyməsi ilə məhsul yazın. Sətir cədvələ düşəcək." />}
      {ready && market.length > 0 && shown.length === 0 && <Empty title="Bu süzgəcə düşən məhsul yoxdur" text="Axtarışı, kateqoriyanı və ya ƏDV süzgəcini dəyişin." />}
      {shown.length > 0 && (
        <>
          <p className="market-count">{shown.length} məhsul{shown.length !== market.length ? ` · ${market.length} içindən` : ""}</p>
          <div className="pricebook">
            <table>
              <thead>
                <tr>
                  <th>Məhsul</th>
                  <th>Təchizatçı</th>
                  <th>Region</th>
                  <th className="num">Qiymət</th>
                  <th>ƏDV</th>
                  <th>Qüvvədədir</th>
                  <th className="acts"><span className="sr">Əməliyyat</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const closed = offerClosed(item)
                  const amount = offerPrice(item.price)
                  const until = item.validUntil.trim()
                  const left = daysUntil(until)
                  const unit = item.unit?.trim() ?? ""
                  const vatLabel = item.vat === "daxil" ? "Daxil" : "Xaric"
                  const untilText = !until ? "—" : left != null && left < 0 ? "Müddəti bitib" : left != null && left <= 30 ? `${left} gün` : offerDate(until)
                  return (
                    <tr
                      key={item.id}
                      className="click"
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a, button, .row-menu")) return
                        setViewId(item.id)
                      }}
                    >
                      <td>
                        <span className="name-cell">
                          <b>{item.name}</b>
                          <span className="muted">{item.category.trim() || "Kateqoriya yazılmayıb"}</span>
                        </span>
                      </td>
                      <td>{item.source.trim() || "—"}</td>
                      <td>{item.region.trim() || "—"}</td>
                      <td className="num ask">{amount && !closed ? <>{amount} <span className="muted">AZN{unit ? ` / ${unit}` : ""}</span></> : <span className={closed ? "late" : "muted"}>{closed ? "Müddəti bitib" : "—"}</span>}</td>
                      <td><span className={`badge ${item.vat === "daxil" ? "pine" : "stone"}`}>{vatLabel}</span></td>
                      <td className={left != null && left < 0 ? "late" : left != null && left <= 30 ? "soon" : undefined}>{untilText}</td>
                      <td className="acts">
                        <RowMenu
                          items={[
                            { id: "edit", label: "Düzəlt", onClick: () => openEdit(item) },
                            { id: "delete", label: "Sil", onClick: () => setDrop({ id: item.id, name: item.name }) },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {compose && (
        <Modal wide className="market-modal" title={editing ? "Sətri düzəlt" : "Yeni sətir"} onClose={() => { setCompose(false); setEditing(null) }}>
          <div className="market-fields">
            <label className="span-2">Məhsul<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="məsələn, Portland sement CEM II" /></label>
            <label>Kateqoriya<Select value={form.category} onValueChange={(next) => setForm({ ...form, category: next })} options={formCategories.map((item) => ({ value: item, label: item }))} /></label>
            <label>Vahid<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="ton, m³, ədəd" /></label>
            <label>Alış qiyməti<input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} inputMode="decimal" placeholder="0,00" /></label>
            <label>ƏDV<Select value={form.vat} onValueChange={(next) => setForm({ ...form, vat: next })} options={[{ value: "xaric", label: "Xaric" }, { value: "daxil", label: "Daxil" }]} /></label>
            <label>Təchizatçı<input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label>
            <label>Region<input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></label>
            <label>Çatdırılma<input value={form.delivery} onChange={(event) => setForm({ ...form, delivery: event.target.value })} placeholder="anbar və ya ünvan" /></label>
            <label>Tarix<input type="date" value={form.updated} onChange={(event) => setForm({ ...form, updated: event.target.value })} /></label>
            <label>Qüvvədədir<input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => { setCompose(false); setEditing(null) }}>Ləğv et</button>
            <button type="button" className="btn" disabled={!form.name.trim()} onClick={save}>{editing ? "Saxla" : "Əlavə et"}</button>
          </div>
        </Modal>
      )}
      {viewed && (
        <Modal className="market-info-modal" title={viewed.name} onClose={() => setViewId(null)}>
          <dl className="market-info">
            {infoRows(viewed).map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.tone}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setViewId(null)}>Bağla</button>
            <button type="button" className="btn" onClick={() => { setViewId(null); openEdit(viewed) }}>Düzəlt</button>
          </div>
        </Modal>
      )}
      {drop && <Confirm title="Sətri sil" text={`${drop.name} bazardan silinəcək.`} onClose={() => setDrop(null)} onYes={() => remove(drop.id)} />}
    </div>
  )
}

export function WindowsPage() {
  useTitle("Qapı-pəncərə")
  const [form, setForm] = useState({ width: "", height: "", count: "1", price: "", vat: "xaric", waste: "" })
  const width = Number(form.width) || 0
  const height = Number(form.height) || 0
  const count = Number(form.count) || 0
  const glass = (width / 1000) * (height / 1000) * count
  const wasteRate = Number(form.waste)
  const wasteOn = form.waste.trim() !== "" && Number.isFinite(wasteRate)
  const glassWithWaste = wasteOn ? glass * (1 + wasteRate / 100) : glass
  return (
    <>
      <PageHead kicker="İstehsal" title="Qapı və pəncərə" text="Kəsim qaydasını istehsalçı təsdiqləyənə qədər kiloqram hesabı çıxmır. Şüşə sahəsi ölçüdən gəlir." />
      <section className="panel pad">
        <div className="form-row wide">
          <label>En, mm<input value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })} /></label>
          <label>Hündürlük, mm<input value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} /></label>
          <label>Say<input value={form.count} onChange={(event) => setForm({ ...form, count: event.target.value })} /></label>
          <label>Alış, AZN/kq<input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label>ƏDV<Select value={form.vat} onValueChange={(vat) => setForm({ ...form, vat })} options={[{ value: "xaric", label: "Xaric" }, { value: "daxil", label: "Daxil" }]} /></label>
          <label>İtki, %<input value={form.waste} onChange={(event) => setForm({ ...form, waste: event.target.value })} /></label>
        </div>
        <div className="step-row"><span>Şüşə sahəsi</span><strong>{glass ? `${glass.toFixed(2)} m²` : "Ölçü yoxdur"}</strong></div>
        <div className="step-row"><span>İtki ilə sahə</span><strong>{glass ? `${glassWithWaste.toFixed(2)} m²${wasteOn ? ` · itki ${form.waste}%` : " · itki yazılmayıb"}` : "Ölçü yoxdur"}</strong></div>
        <div className="step-row"><span>Profil kilosu</span><strong>İstehsalçı təsdiqi yoxdur</strong></div>
        <div className="step-row"><span>Alış qiyməti</span><strong>{form.price || "—"} AZN/kq · ƏDV {form.vat}</strong></div>
      </section>
    </>
  )
}

export function CashflowPage() {
  useTitle("Pul axını")
  const { boq, guarantee, cash, partners } = useWorkspace()
  const math = boqMath(boq)
  const sources = cash
  const bank = partners.filter((item) => item.kind === "Bank").map(filledPartner).find((item) => item.id === guarantee.bankId)
  const bond = bank && bankTone(bank).color === "ok" ? guaranteeAmount(guarantee).applied : 0
  const inflow = (Number(sources.inflow) || 0) + (Number(sources.advance) || 0) + (Number(sources.equity) || 0) + (Number(sources.loan) || 0)
  const outflow = math.measured + math.indirect + math.overhead + math.extra + bond
  const rows = [
    ["Ölçülmüş iş", math.measured],
    ["Dolayı xərc", math.indirect],
    ["Üstəlik", math.overhead],
    ["Əlavə xərc", math.extra],
    ["Mənfəət", math.profit],
    ["Vergi", math.vat],
    ["Təsdiqli zəmanət", bond],
    ["Mənbə cəmi", inflow],
    ["Çıxış", outflow],
    ["Qalıq", inflow - outflow],
  ] as const

  function setCash(key: keyof typeof sources, value: string) {
    patch((state) => ({ ...state, cash: { ...(state.cash ?? sources), [key]: value } }))
  }

  return (
    <>
      <PageHead kicker="Maliyyə" title="Pul axını" text="Bir uçotdur. Mənbə xanaları boşdur, rəqəm yazılanda cəmə düşür. Çıxış smeta və bank qərarından gəlir." />
      <section className="panel pad">
        <div className="form-row wide">
          <label>Daxilolma, AZN<input value={sources.inflow} onChange={(event) => setCash("inflow", event.target.value)} placeholder="boş" /></label>
          <label>Avans, AZN<input value={sources.advance} onChange={(event) => setCash("advance", event.target.value)} placeholder="boş" /></label>
          <label>Öz vəsait, AZN<input value={sources.equity} onChange={(event) => setCash("equity", event.target.value)} placeholder="boş" /></label>
          <label>Kredit, AZN<input value={sources.loan} onChange={(event) => setCash("loan", event.target.value)} placeholder="boş" /></label>
          <label>30 gün, AZN<input value={sources.days30} onChange={(event) => setCash("days30", event.target.value)} placeholder="boş" /></label>
          <label>60 gün, AZN<input value={sources.days60} onChange={(event) => setCash("days60", event.target.value)} placeholder="boş" /></label>
          <label>90 gün, AZN<input value={sources.days90} onChange={(event) => setCash("days90", event.target.value)} placeholder="boş" /></label>
        </div>
        <div className="step-row"><span>30 gün</span><strong>{sources.days30.trim() ? `${money(Number(sources.days30) || 0)} AZN` : "Yazılmayıb"}</strong></div>
        <div className="step-row"><span>60 gün</span><strong>{sources.days60.trim() ? `${money(Number(sources.days60) || 0)} AZN` : "Yazılmayıb"}</strong></div>
        <div className="step-row"><span>90 gün</span><strong>{sources.days90.trim() ? `${money(Number(sources.days90) || 0)} AZN` : "Yazılmayıb"}</strong></div>
        {rows.map(([name, value]) => <div className="step-row" key={name}><span>{name}</span><strong>{money(value)} AZN</strong></div>)}
      </section>
    </>
  )
}

const COOP_MODULES = ["Hesablama", "Tender", "Təchizat", "Maliyyə", "Kadr", "İnşaat"]
const COOP_STATUSES = ["Təhlil olunur", "Nəticə yazılıb", "Razılaşıb", "Dayanıb"] as const

type CoopFinding = { id: string; topic: string; finding: string; createdAt?: string }
type CoopRequest = {
  id: string
  company: string
  note: string
  module: string
  owner: string
  result: string
  status: string
  createdAt?: string
  findings: CoopFinding[]
}

function coopTone(status: string) {
  if (status === "Razılaşıb") return "pine"
  if (status === "Dayanıb") return "rose"
  if (status === "Nəticə yazılıb") return "copper"
  return "gold"
}

function coopWhen(value?: string) {
  if (!value) return ""
  return dateAZ(String(value).slice(0, 10))
}

export function CoopPage() {
  useTitle("Əməkdaşlıq")
  const [rows, setRows] = useState<CoopRequest[]>([])
  const [form, setForm] = useState({ company: "", note: "", module: COOP_MODULES[0], owner: "" })
  const [finding, setFinding] = useState({ id: "", topic: "", text: "", status: "Nəticə yazılıb" })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [find, setFind] = useState("")
  const [filter, setFilter] = useState("hamisi")

  function load() {
    return api<CoopRequest[]>("/api/platform/coop").then(setRows)
  }

  useEffect(() => {
    load()
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Sorğular oxunmadı"))
      .finally(() => setReady(true))
  }, [])

  const shown = useMemo(() => {
    const query = find.trim().toLocaleLowerCase("az")
    return rows.filter((row) => {
      if (filter === "tehlil" && row.status !== "Təhlil olunur") return false
      if (filter === "netice" && row.status !== "Nəticə yazılıb") return false
      if (filter === "razi" && row.status !== "Razılaşıb") return false
      if (filter === "dayanib" && row.status !== "Dayanıb") return false
      if (!query) return true
      const hay = [row.company, row.note, row.module, row.owner, row.result, row.status, ...row.findings.flatMap((item) => [item.topic, item.finding])].join(" ").toLocaleLowerCase("az")
      return hay.includes(query)
    })
  }, [rows, find, filter])

  const open = rows.filter((row) => row.status === "Təhlil olunur").length
  const agreed = rows.filter((row) => row.status === "Razılaşıb").length
  const held = rows.filter((row) => row.status === "Dayanıb").length
  const selected = rows.find((row) => row.id === finding.id)

  async function accept() {
    if (!form.company.trim() || busy) return
    setMessage("")
    setError("")
    setBusy(true)
    try {
      await api("/api/platform/coop", { method: "POST", body: JSON.stringify(form) })
      setForm({ company: "", note: "", module: form.module, owner: "" })
      await load()
      setMessage("Sorğu qəbul olundu və modula bağlandı.")
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Sorğu yazılmadı")
    } finally {
      setBusy(false)
    }
  }

  async function writeFinding() {
    if (!finding.id || !finding.text.trim() || busy) return
    setMessage("")
    setError("")
    setBusy(true)
    try {
      await api(`/api/platform/coop/${finding.id}/findings`, {
        method: "POST",
        body: JSON.stringify({
          topic: finding.topic || "Təhlil",
          finding: finding.text,
          module: selected?.module || form.module,
          owner: selected?.owner || form.owner,
          status: finding.status,
        }),
      })
      const id = finding.id
      setFinding({ id, topic: "", text: "", status: finding.status })
      await load()
      setMessage("Tapıntı və nəticə yazıldı.")
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Tapıntı yazılmadı")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="coop-page">
      <PageHead kicker="Klub" title="Əməkdaşlıq" text="Hər kart bir tərəfin sorğusudur. Modul, məsul şəxs, tapıntı və nəticə həmin kartda qalır." />
      <section className="statstrip">
        <article>
          <span>Sorğu</span>
          <strong>{rows.length}</strong>
          <em>Bazadakı kart</em>
        </article>
        <article>
          <span>Təhlildə</span>
          <strong>{open}</strong>
          <em>Nəticə hələ bağlanmayıb</em>
        </article>
        <article>
          <span>Razılaşıb</span>
          <strong>{agreed}</strong>
          <em>Nəticə bağlanıb</em>
        </article>
        <article>
          <span>Dayanıb</span>
          <strong>{held}</strong>
          <em className={held ? "warn" : undefined}>Qəbul dayanıb</em>
        </article>
      </section>
      <div className="toolbar">
        <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="search" />
          <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Şirkət, məsul, tapıntı" aria-label="Əməkdaşlıqda axtar" />
        </form>
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { id: "hamisi", label: "Hamısı" },
            { id: "tehlil", label: "Təhlil" },
            { id: "netice", label: "Nəticə" },
            { id: "razi", label: "Razılaşıb" },
            { id: "dayanib", label: "Dayanıb" },
          ]}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="lede">{message}</p>}
      {!ready && <p className="lede">Sorğular oxunur.</p>}
      {ready && !error && rows.length === 0 && <Empty title="Bu şirkətdə sorğu yoxdur" text="Aşağıdakı forma boş kartdır. Şirkəti yazıb qəbul edəndə o, bazada kart kimi görünər." />}
      {ready && rows.length > 0 && shown.length === 0 && <Empty title="Bu süzgəcə düşən sorğu yoxdur" text="Axtarışı və ya süzgəci dəyişin. Kartlar bazada qalır." />}
      {shown.length > 0 && (
        <div className="coop-grid">
          {shown.map((row) => {
            const when = coopWhen(row.createdAt)
            const on = finding.id === row.id
            return (
              <article
                key={row.id}
                className={on ? "coop-card on" : "coop-card"}
                role="button"
                tabIndex={0}
                onClick={() => setFinding({ ...finding, id: row.id })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setFinding({ ...finding, id: row.id })
                  }
                }}
              >
                <header>
                  <div>
                    <p>{row.module.trim() || "Modul yazılmayıb"}{when ? ` · ${when}` : ""}</p>
                    <h2>{row.company}</h2>
                  </div>
                  <span className={`badge ${coopTone(row.status)}`}>{row.status || "Təhlil olunur"}</span>
                </header>
                <p className={row.note.trim() ? undefined : "miss"}>{row.note.trim() || "Sorğu mətni yazılmayıb"}</p>
                <dl>
                  <div>
                    <dt>Məsul</dt>
                    <dd className={row.owner.trim() ? undefined : "miss"}>{row.owner.trim() || "yazılmayıb"}</dd>
                  </div>
                  <div>
                    <dt>Tapıntı</dt>
                    <dd>{row.findings.length}</dd>
                  </div>
                </dl>
                {row.findings.length > 0 && (
                  <ul>
                    {row.findings.map((item) => (
                      <li key={item.id}>
                        <b>{item.topic}</b>
                        <span>{item.finding}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {row.result.trim() && (
                  <p className={row.status === "Dayanıb" ? "coop-result hold" : "coop-result"}>
                    <span>Nəticə</span>
                    {row.result}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}
      <div className="coop-forms">
        <section className="panel pad">
          <h2>Yeni sorğu</h2>
          <p className="lede">Bu forma hələ məlumat deyil. Qəbul edəndə kart yuxarıdakı siyahıya düşür.</p>
          <div className="form-row wide">
            <label>Şirkət<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="məsələn, Abşeron Şüşə" /></label>
            <label>Sorğu<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="nə soruşulur" /></label>
            <label>Modul<Select value={form.module} onValueChange={(module) => setForm({ ...form, module })} options={COOP_MODULES.map((item) => ({ value: item, label: item }))} /></label>
            <label>Məsul<input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="adı" /></label>
            <button type="button" className="btn" disabled={busy || !form.company.trim()} onClick={() => void accept()}>{busy ? "Yazılır" : "Qəbul et"}</button>
          </div>
        </section>
        <section className="panel pad">
          <h2>Tapıntı</h2>
          <p className="lede">{selected ? `${selected.company} kartına yazılır.` : "Kartı seçin, tapıntı həmin sorğuya düşsün."}</p>
          <div className="form-row wide">
            <label>Sorğu<Select value={finding.id} onValueChange={(id) => setFinding({ ...finding, id })} options={[{ value: "", label: "Seçin" }, ...rows.map((row) => ({ value: row.id, label: row.company }))]} /></label>
            <label>Mövzu<input value={finding.topic} onChange={(event) => setFinding({ ...finding, topic: event.target.value })} placeholder="məsələn, Qiymət" /></label>
            <label>Nəticə<input value={finding.text} onChange={(event) => setFinding({ ...finding, text: event.target.value })} placeholder="nə məlum oldu" /></label>
            <label>Vəziyyət<Select value={finding.status} onValueChange={(status) => setFinding({ ...finding, status })} options={COOP_STATUSES.map((item) => ({ value: item, label: item }))} /></label>
            <button type="button" className="btn" disabled={busy || !finding.id || !finding.text.trim()} onClick={() => void writeFinding()}>{busy ? "Yazılır" : "Yaz"}</button>
          </div>
        </section>
      </div>
    </div>
  )
}

type Pack = { id: string; name: string; features: string; amount: unknown; userLimit: number | null; smetaLimit: number | null }
type SubState = { status: string; endsOn: string | null; daysLeft: number | null; warn: boolean; locked: string[]; package: Pack | null }

export function SubscribePage() {
  useTitle("Abunə")
  const [packs, setPacks] = useState<Pack[]>([])
  const [state, setState] = useState<SubState | null>(null)
  const [months, setMonths] = useState("1")
  const [invoice, setInvoice] = useState("")
  const [note, setNote] = useState("")

  function load() {
    return Promise.all([
      api<Pack[]>("/api/platform/packages"),
      api<SubState>("/api/platform/subscription/state"),
    ]).then(([rows, next]) => {
      setPacks(rows)
      setState(next)
    })
  }

  useEffect(() => {
    load().catch((reason) => setNote(reason instanceof ApiError ? reason.message : "Abunə oxunmadı"))
  }, [])

  async function choose(id: string) {
    try {
      await api("/api/platform/subscription", { method: "POST", body: JSON.stringify({ packageId: id, months }) })
      await load()
      setNote("Paket seçildi və müddət başladı. Ödəniş sənədi qeyd olunmayana qədər bağlı modul açılmır. Kartla pul tutulmur.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Paket seçilmədi")
    }
  }

  async function pay() {
    const pack = state?.package
    if (!pack) {
      setNote("Əvvəlcə paket seçilməlidir.")
      return
    }
    try {
      await api("/api/platform/subscription/payment", {
        method: "POST",
        body: JSON.stringify({ months, amount: Number(pack.amount) || 0, invoice: invoice || "Əl ilə ödəniş sənədi" }),
      })
      await load()
      setNote("Ödəniş sənəd kimi qeyd olundu. Müddət başladı.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Ödəniş qeyd olunmadı")
    }
  }

  return (
    <>
      <PageHead kicker="Platforma" title="Abunə" text="Məbləğ idarə panelindən dəyişir. Ödəniş sənəd kimi qeyd olunur. Kartla pul tutulmur. Ödənilməyəndə bağlı modul açılmır." />
      <section className="panel pad">
        {state?.warn && <p className="form-error">Abunə {state.daysLeft} günə bitir.</p>}
        {state && <p className="lede">Vəziyyət: {state.status}{state.endsOn ? ` · bitmə ${String(state.endsOn).slice(0, 10)}` : ""}. {state.locked.length ? `Bağlı: ${state.locked.join(", ")}` : "Bütün modullar açıqdır."}</p>}
        <div className="work-grid">
          {packs.map((pack) => (
            <article key={pack.id} className="panel pad">
              <strong>{pack.name}</strong>
              <p>{pack.features}</p>
              <p>{pack.amount == null ? "Məbləğ yazılmayıb" : `${pack.amount} AZN`} · istifadəçi {pack.userLimit ?? "limitsiz"} · layihə {pack.smetaLimit ?? "limitsiz"}</p>
              <button type="button" className="btn" onClick={() => void choose(pack.id)}>Seç</button>
            </article>
          ))}
        </div>
        <div className="form-row wide">
          <label>Ay<input value={months} onChange={(event) => setMonths(event.target.value)} /></label>
          <label>Ödəniş sənədi<input value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="qaimə və ya qəbz nömrəsi" /></label>
          <button type="button" className="btn" onClick={() => void pay()}>Ödənişi qeyd et</button>
        </div>
        {note && <p className="lede">{note}</p>}
      </section>
    </>
  )
}

const emptyPassport = { material: "", section: SPEC_SECTIONS[0], fit: "el" as Fit, maker: "", standard: "", certificate: "", issuer: "", validUntil: "", batch: "", origin: "", protocol: "" }

type ApiPassport = {
  id: string
  material: string
  section: string
  fit: Fit
  maker: string
  standard: string
  certificate: string
  issuer: string
  validUntil: string | null
  batch: string
  origin: string
  protocol: string
}

const PASSPORT_FACTS = [
  ["maker", "İstehsalçı"],
  ["standard", "Standart"],
  ["certificate", "Sertifikat"],
  ["issuer", "Verən"],
  ["batch", "Partiya"],
  ["origin", "Mənşə"],
  ["protocol", "Sınaq protokolu"],
] as const

function mapPassport(row: ApiPassport) {
  return {
    id: row.id,
    material: row.material,
    section: row.section || "",
    fit: row.fit in FIT_LABEL ? row.fit : "el" as Fit,
    maker: row.maker || "",
    standard: row.standard || "",
    certificate: row.certificate || "",
    issuer: row.issuer || "",
    validUntil: row.validUntil ? String(row.validUntil).slice(0, 10) : "",
    batch: row.batch || "",
    origin: row.origin || "",
    protocol: row.protocol || "",
  }
}

function daysUntil(value: string) {
  const day = value.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [year, month, date] = day.split("-").map(Number)
  const end = Date.UTC(year, month - 1, date)
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((end - today) / 86400000)
}

function azDate(value: string) {
  const day = value.trim().slice(0, 10)
  const [year, month, date] = day.split("-")
  if (!year || !month || !date) return ""
  return `${date}.${month}.${year}`
}

function passportField(row: { maker: string; standard: string; certificate: string; issuer: string; batch: string; origin: string; protocol: string; validUntil: string }, key: (typeof PASSPORT_FACTS)[number][0] | "validUntil") {
  return String(row[key] ?? "").trim()
}

function passportGaps(row: { maker: string; standard: string; certificate: string; issuer: string; batch: string; origin: string; protocol: string; validUntil: string }) {
  const missing = PASSPORT_FACTS.filter(([key]) => !passportField(row, key)).length
  return missing + (passportField(row, "validUntil") ? 0 : 1)
}

function fitTone(fit: Fit) {
  if (fit === "uygun") return "pine"
  if (fit === "deyil" || fit === "catismir") return "rose"
  if (fit === "gozleyir") return "gold"
  return "stone"
}

export function PassportPage() {
  useTitle("Pasport")
  const { passports } = useWorkspace()
  const [form, setForm] = useState(emptyPassport)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [find, setFind] = useState("")
  const [filter, setFilter] = useState("hamisi")

  function remember(rows: ApiPassport[]) {
    patch((state) => ({ ...state, passports: rows.map(mapPassport) }))
  }

  function load() {
    return api<ApiPassport[]>("/api/platform/passports").then(remember)
  }

  useEffect(() => {
    load()
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Pasportlar oxunmadı"))
      .finally(() => setReady(true))
  }, [])

  const shown = useMemo(() => {
    const query = find.trim().toLocaleLowerCase("az")
    return passports.filter((row) => {
      const gaps = passportGaps(row)
      const left = daysUntil(row.validUntil)
      if (filter === "tam" && gaps > 0) return false
      if (filter === "catismayan" && gaps === 0) return false
      if (filter === "bitme" && (left == null || left > 30)) return false
      if (!query) return true
      const hay = [row.material, row.section, row.maker, row.standard, row.certificate, row.batch, row.origin, row.protocol].map((value) => value ?? "").join(" ").toLocaleLowerCase("az")
      return hay.includes(query)
    })
  }, [passports, find, filter])

  const complete = passports.filter((row) => passportGaps(row) === 0).length
  const expiring = passports.filter((row) => {
    const left = daysUntil(row.validUntil)
    return left != null && left <= 30
  }).length

  async function add() {
    if (!form.material.trim() || busy) return
    setNote("")
    setError("")
    setBusy(true)
    try {
      await api("/api/platform/passports", { method: "POST", body: JSON.stringify(form) })
      await load()
      setForm({ ...emptyPassport, section: form.section, fit: form.fit })
      setNote("Pasport bazada saxlandı və kart siyahısına düşdü.")
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Pasport saxlanmadı")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="passport-page">
      <PageHead kicker="Keyfiyyət" title="Material pasportu" text="Hər kart bazada saxlanan material sənədidir. Boş sahə «yazılmayıb» kimi durur, ona görə formadakı boş xanalar məlumat sayılmır." />
      <section className="statstrip">
        <article>
          <span>Pasport</span>
          <strong>{passports.length}</strong>
          <em>Bazadakı kart</em>
        </article>
        <article>
          <span>Tam kart</span>
          <strong>{complete}</strong>
          <em>8 sahənin hamısı yazılıb</em>
        </article>
        <article>
          <span>Çatışmayan</span>
          <strong>{passports.length - complete}</strong>
          <em className={passports.length - complete ? "warn" : undefined}>Sertifikat və ya sınaq boşdur</em>
        </article>
        <article>
          <span>30 günə bitən</span>
          <strong>{expiring}</strong>
          <em className={expiring ? "warn" : undefined}>Müddəti yaxınlaşan</em>
        </article>
      </section>
      <div className="toolbar">
        <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="search" />
          <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Material, partiya, sertifikat" aria-label="Pasportda axtar" />
        </form>
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { id: "hamisi", label: "Hamısı" },
            { id: "tam", label: "Tam" },
            { id: "catismayan", label: "Çatışmayan" },
            { id: "bitme", label: "Bitməyə yaxın" },
          ]}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      {note && <p className="lede">{note}</p>}
      {!ready && <p className="lede">Pasportlar oxunur.</p>}
      {ready && !error && passports.length === 0 && <Empty title="Bu şirkətdə pasport yoxdur" text="Aşağıdakı forma boş kartdır. Materialı yazıb saxlayanda o, bazada kart kimi görünər." />}
      {ready && passports.length > 0 && shown.length === 0 && <Empty title="Bu süzgəcə düşən pasport yoxdur" text="Axtarışı və ya süzgəci dəyişin. Kartlar bazada qalır." />}
      {shown.length > 0 && (
        <div className="pass-grid">
          {shown.map((row) => {
            const gaps = passportGaps(row)
            const until = row.validUntil.trim()
            const left = daysUntil(until)
            const untilText = until ? azDate(until) : "yazılmayıb"
            const untilNote = left == null ? "" : left < 0 ? " · müddəti bitib" : left <= 30 ? ` · ${left} gün qalıb` : ""
            return (
              <article className="pass-card" key={row.id}>
                <header>
                  <div>
                    <p>{row.section.trim() || "Bölmə yazılmayıb"}</p>
                    <h2>{row.material}</h2>
                  </div>
                  <span className={`badge ${fitTone(row.fit)}`}>{FIT_LABEL[row.fit]}</span>
                </header>
                <dl>
                  {PASSPORT_FACTS.map(([key, label]) => {
                    const value = passportField(row, key)
                    return (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd className={value ? undefined : "miss"}>{value || "yazılmayıb"}</dd>
                      </div>
                    )
                  })}
                  <div>
                    <dt>Qüvvədədir</dt>
                    <dd className={!until ? "miss" : left != null && left < 0 ? "late" : left != null && left <= 30 ? "soon" : undefined}>{untilText}{untilNote}</dd>
                  </div>
                </dl>
                <footer>
                  <span className={`badge ${gaps ? "gold" : "pine"}`}>{gaps ? `${8 - gaps}/8 sahə yazılıb` : "Tam kart"}</span>
                  <em>Bazada saxlanılıb</em>
                </footer>
              </article>
            )
          })}
        </div>
      )}
      <section className="panel pad passport-form">
        <h2>Yeni pasport</h2>
        <p className="lede">Bu forma hələ məlumat deyil. Saxlayanda kart yuxarıdakı siyahıya düşür.</p>
        <div className="form-row wide">
          <label>Material<input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} placeholder="məsələn, Armatur A500 Ø16" /></label>
          <label>İstehsalçı<input value={form.maker} onChange={(event) => setForm({ ...form, maker: event.target.value })} /></label>
          <label>Standart<input value={form.standard} onChange={(event) => setForm({ ...form, standard: event.target.value })} /></label>
          <label>Sertifikat nömrəsi<input value={form.certificate} onChange={(event) => setForm({ ...form, certificate: event.target.value })} /></label>
          <label>Verən<input value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.target.value })} /></label>
          <label>Qüvvədədir<input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label>
          <label>Partiya<input value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} /></label>
          <label>Mənşə<input value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} /></label>
          <label>Sınaq protokolu<input value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value })} /></label>
          <label>Bölmə<Select value={form.section} onValueChange={(section) => setForm({ ...form, section })} options={SPEC_SECTIONS.map((item) => ({ value: item, label: item }))} /></label>
          <label>Nəticə<Select value={form.fit} onValueChange={(fit) => setForm({ ...form, fit: fit as Fit })} options={(Object.keys(FIT_LABEL) as Fit[]).map((key) => ({ value: key, label: FIT_LABEL[key] }))} /></label>
          <button type="button" className="btn" disabled={busy || !form.material.trim()} onClick={() => void add()}>{busy ? "Saxlanır" : "Bazaya yaz"}</button>
        </div>
      </section>
    </div>
  )
}

const emptyPartner = { kind: PARTNER_KINDS[0], name: "", note: "", logo: "", commission: "", discount: "", light: "gozleme" as Partner["light"], proof: "", proofDate: "", api: "bagli" as Partner["api"] }

type ApiPartner = {
  id: string
  kind: string
  name: string
  note: string
  logo: string
  commission: unknown
  discount: unknown
  light: Partner["light"]
  proof: string
  proofDate: string | null
}

function mapPartner(row: ApiPartner): Partner {
  return filledPartner({
    id: row.id,
    kind: PARTNER_LABEL[row.kind] || row.kind,
    name: row.name,
    note: row.note || "",
    logo: row.logo || "",
    commission: dec(row.commission),
    discount: dec(row.discount),
    light: row.light || "gozleme",
    proof: row.proof || "",
    proofDate: row.proofDate ? String(row.proofDate).slice(0, 10) : "",
    api: "bagli",
  })
}

function loadPartners() {
  return api<ApiPartner[]>("/api/platform/finance/partners").then((rows) => {
    patch((state) => ({ ...state, partners: rows.map(mapPartner) }))
  })
}

export function RegistryPage() {
  useTitle("Tərəfdaşlar")
  const { partners } = useWorkspace()
  const [form, setForm] = useState(emptyPartner)
  const [note, setNote] = useState("")

  useEffect(() => {
    loadPartners().catch((reason) => setNote(reason instanceof ApiError ? reason.message : "Reyestr oxunmadı"))
  }, [])

  async function addPartner() {
    if (!form.name.trim()) return
    try {
      await api("/api/platform/finance/partners", {
        method: "POST",
        body: JSON.stringify({
          kind: PARTNER_CODE[form.kind] || "bank",
          name: form.name,
          note: form.note,
          logo: form.logo,
          commission: form.commission,
          discount: form.discount,
          light: "gozleme",
        }),
      })
      await loadPartners()
      setForm(emptyPartner)
      setNote("Tərəfdaş bazada saxlandı. Canlı bank bağlantısı bağlıdır.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Tərəfdaş saxlanmadı")
    }
  }

  async function saveBank(row: Partner) {
    try {
      await api(`/api/platform/finance/partners/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: row.name,
          note: row.note,
          logo: row.logo,
          commission: row.commission,
          discount: row.discount,
          light: row.light,
          proof: row.proof,
          proofDate: row.proofDate,
        }),
      })
      await loadPartners()
      setNote("Bank kartı bazada saxlandı. Yaşıl yalnız təsdiq sənədi və tarix ilə yanır.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Bank kartı saxlanmadı")
    }
  }

  function setBank(id: string, row: Partial<Partner>) {
    patch((state) => ({
      ...state,
      partners: state.partners.map((item) => item.id === id ? { ...filledPartner(item), ...row } : item),
      guarantee: state.guarantee.bankId === id ? { ...state.guarantee, packed: false } : state.guarantee,
    }))
  }

  return (
    <>
      <PageHead kicker="Maliyyə" title="Bank və tərəfdaş reyestri" text="Bank kartında loqo, komissiya, güzəşt və üç rəng var. Yaşıl yalnız təsdiq sənədi və tarix yazılanda yanır. API mərhələli açılır." />
      <section className="panel pad">
        <div className="form-row wide">
          <label>Növ<Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind })} options={PARTNER_KINDS.map((item) => ({ value: item, label: item }))} /></label>
          <label>Ad<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Qeyd<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
          {form.kind === "Bank" && (
            <>
              <label>Loqo<input value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} placeholder="boş" /></label>
              <label>Komissiya, %<input value={form.commission} onChange={(event) => setForm({ ...form, commission: event.target.value })} placeholder="boş" /></label>
              <label>Güzəşt, %<input value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} placeholder="boş" /></label>
            </>
          )}
          <button type="button" className="btn" onClick={() => void addPartner()}>Əlavə et</button>
        </div>
        {note && <p className="lede">{note}</p>}
        {partners.length === 0 && <p className="lede">Reyestr boşdur.</p>}
        {partners.map((raw) => {
          const row = filledPartner(raw)
          const tone = bankTone(row)
          return (
            <article key={row.id} style={{ marginTop: 16 }}>
              <div className="step-row"><span>{row.kind} · {row.name}</span><strong>{row.kind === "Bank" ? <span className={`badge bank ${tone.color}`}>{tone.word}</span> : row.note || "Qeyd yoxdur"}</strong></div>
              {row.kind === "Bank" && (
                <div className="form-row wide">
                  <label>Loqo<input value={row.logo} onChange={(event) => setBank(row.id, { logo: event.target.value })} placeholder="boş" /></label>
                  <label>Komissiya, %<input value={row.commission} onChange={(event) => setBank(row.id, { commission: event.target.value })} placeholder="boş" /></label>
                  <label>Güzəşt, %<input value={row.discount} onChange={(event) => setBank(row.id, { discount: event.target.value })} placeholder="boş" /></label>
                  <label>Rəng<Select value={row.light} onValueChange={(light) => setBank(row.id, { light: light as Partner["light"] })} options={[{ value: "gozleme", label: "Gözləmə" }, { value: "tesdiq", label: "Təsdiq" }, { value: "legv", label: "Ləğv" }]} /></label>
                  <label>Təsdiq sənədi<input value={row.proof} onChange={(event) => setBank(row.id, { proof: event.target.value })} placeholder="boş" /></label>
                  <label>Sənəd tarixi<input value={row.proofDate} onChange={(event) => setBank(row.id, { proofDate: event.target.value })} placeholder="boş" /></label>
                  <label>API<Select value={row.api} onValueChange={(apiMode) => setBank(row.id, { api: apiMode as Partner["api"] })} options={[{ value: "bagli", label: "Bağlıdır" }, { value: "novbe", label: "Növbədədir" }]} /></label>
                  <button type="button" className="btn" onClick={() => void saveBank(row)}>Kartı saxla</button>
                </div>
              )}
            </article>
          )
        })}
        <p className="lede">Yaşıl status bankın rəsmi təsdiqi olan yerdə görünür. Canlı API yoxdursa təsdiq sənədi və tarix yazılır. Kanal bağlı olanda sənəd mübadiləsi davam edir.</p>
      </section>
    </>
  )
}

const TEMPLATE_KINDS = ["Müqavilə", "Akt", "Zəmanət", "Sifariş"] as const
const TEMPLATE_LEGAL = ["Gözləyir", "Baxıldı", "Geri qaytarıldı"] as const
const TEMPLATE_FIELDS = [
  { key: "sirket", label: "Şirkət" },
  { key: "voen", label: "VÖEN" },
  { key: "unvan", label: "Ünvan" },
  { key: "teref", label: "Tərəf" },
  { key: "mebleg", label: "Məbləğ" },
  { key: "tarix", label: "Tarix" },
  { key: "layihe", label: "Layihə" },
  { key: "muddet", label: "Müddət" },
  { key: "dovr", label: "Dövr" },
] as const

const emptyTemplate = {
  name: "",
  kind: "Müqavilə",
  version: "1.0",
  legal: "Gözləyir",
  party: "",
  body: "Bu müqavilə {{tarix}} tarixində {{sirket}} (VÖEN {{voen}}) ilə {{teref}} arasında bağlanır.\n\nPredmet: {{layihe}}.\nMəbləğ: {{mebleg}} AZN.\nMüddət: {{muddet}}.",
}

const emptyFields = { teref: "Xəzər Holdinq", mebleg: "186 000", tarix: "2026-10-14", layihe: "Port Baku Residence", muddet: "90 gün", dovr: "oktyabr 2026" }

type TemplateRow = {
  id: string
  name: string
  kind: string
  version: string
  legal: string
  party: string
  body: string
  updatedOn: string | null
  organizationId?: string | null
}

const CATALOG: TemplateRow[] = catalogJson.map((row) => ({ ...row, organizationId: null }))

function kindLabel(kind: string) {
  const key = kind.trim().toLowerCase()
  if (key === "techizat" || key === "muqavile" || key === "müqavilə") return "Müqavilə"
  if (key === "akt") return "Akt"
  if (key === "zemanet" || key === "zəmanət") return "Zəmanət"
  if (key === "sifaris" || key === "sifariş") return "Sifariş"
  return kind || "Şablon"
}

function legalLabel(legal: string) {
  const value = legal.toLowerCase()
  if (value.includes("geri")) return "Geri qaytarıldı"
  if (value.includes("bax") || value.includes("yoxlan")) return "Baxıldı"
  return "Gözləyir"
}

function legalTone(legal: string) {
  const label = legalLabel(legal)
  if (label === "Baxıldı") return "pine"
  if (label === "Geri qaytarıldı") return "rose"
  return "gold"
}

function kindTone(kind: string) {
  const label = kindLabel(kind)
  if (label === "Akt") return "pine"
  if (label === "Zəmanət") return "gold"
  if (label === "Sifariş") return "stone"
  return "copper"
}

function templateExcerpt(body: string) {
  const text = body.replace(/\{\{\s*[a-z0-9_]+\s*\}\}/gi, "…").replace(/\s+/g, " ").trim()
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}

function usedTokens(body: string) {
  return new Set([...body.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((match) => match[1].toLowerCase()))
}

function highlightBody(value: string) {
  return value.split(/(\{\{\s*[a-z0-9_]+\s*\}\})/gi).map((part, index) => (
    part.startsWith("{{") ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>
  ))
}

function fillLocal(body: string, fields: Record<string, string>) {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    const value = fields[key]
    return value && value.trim() ? value : match
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] ?? char))
}

function TemplateBodyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const used = usedTokens(value)

  function insert(key: string) {
    const token = `{{${key}}}`
    const area = areaRef.current
    const start = area?.selectionStart ?? value.length
    const end = area?.selectionEnd ?? start
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`
    onChange(next)
    const cursor = start + token.length
    requestAnimationFrame(() => {
      area?.focus()
      area?.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="tpl-body">
      <div className="tpl-body-top">
        <span>Mətn</span>
        <em>{used.size} sahə</em>
      </div>
      <div className="tpl-tokens">
        {TEMPLATE_FIELDS.map((field) => (
          <button key={field.key} type="button" className={used.has(field.key) ? "on" : ""} onClick={() => insert(field.key)}>
            {field.label}
            <code>{`{{${field.key}}}`}</code>
          </button>
        ))}
      </div>
      <div className="tpl-sheet">
        <pre className="tpl-mirror" aria-hidden="true">
          {value ? highlightBody(value) : <span className="tpl-placeholder">Müqavilə mətnini yazın. Sahə əlavə etmək üçün yuxarıdakı düyməyə basın.</span>}
          {"\n"}
        </pre>
        <textarea
          ref={areaRef}
          value={value}
          aria-label="Mətn"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}

export function TemplatesPage() {
  useTitle("Şablonlar")
  const { cabinet } = useWorkspace()
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [form, setForm] = useState(emptyTemplate)
  const [owned, setOwned] = useState(false)
  const [editingId, setEditingId] = useState("")
  const [query, setQuery] = useState("")
  const [kindFilter, setKindFilter] = useState("hamisi")
  const [fields, setFields] = useState(emptyFields)
  const [rendered, setRendered] = useState("")
  const [meta, setMeta] = useState({ version: "", legal: "" })
  const [note, setNote] = useState("")
  const picked = useRef(false)

  const library = useMemo(() => {
    const apiIds = new Set(rows.map((row) => row.id))
    return [...rows, ...CATALOG.filter((row) => !apiIds.has(row.id))]
  }, [rows])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return library.filter((row) => {
      if (kindFilter !== "hamisi" && kindLabel(row.kind) !== kindFilter) return false
      if (!needle) return true
      return [row.name, row.party, row.body, kindLabel(row.kind), row.legal].join(" ").toLowerCase().includes(needle)
    })
  }, [library, query, kindFilter])

  const reviewed = library.filter((row) => legalLabel(row.legal) === "Baxıldı").length
  const waiting = library.filter((row) => legalLabel(row.legal) === "Gözləyir").length
  const returned = library.filter((row) => legalLabel(row.legal) === "Geri qaytarıldı").length

  function openRow(row: TemplateRow) {
    picked.current = true
    setEditingId(row.id)
    setOwned(Boolean(row.organizationId))
    setRendered("")
    setForm({
      name: row.name,
      kind: kindLabel(row.kind),
      version: row.version || "1.0",
      legal: legalLabel(row.legal),
      party: row.party || "",
      body: row.body || "",
    })
  }

  function startNew() {
    picked.current = true
    setEditingId("")
    setOwned(false)
    setRendered("")
    setForm(emptyTemplate)
  }

  useEffect(() => {
    api<TemplateRow[]>("/api/platform/templates")
      .then(setRows)
      .catch((reason) => setNote(reason instanceof ApiError ? reason.message : "Şablonlar oxunmadı"))
  }, [])

  useEffect(() => {
    if (picked.current || library.length === 0) return
    openRow(library[0])
  }, [library])

  const liveFields: Record<string, string> = {
    sirket: cabinet.name,
    voen: cabinet.voen,
    unvan: cabinet.legalAddress,
    ...fields,
  }
  const liveText = fillLocal(form.body, liveFields)
  const paper = rendered || liveText

  async function save() {
    if (!form.name.trim()) return
    try {
      if (editingId && owned) {
        const updated = await api<TemplateRow>(`/api/platform/templates/${editingId}`, { method: "PATCH", body: JSON.stringify(form) })
        setRows((current) => current.map((row) => row.id === updated.id ? updated : row))
        setNote("Şablon yeniləndi.")
        return
      }
      const created = await api<TemplateRow>("/api/platform/templates", { method: "POST", body: JSON.stringify(form) })
      setRows((current) => [created, ...current.filter((row) => row.id !== created.id)])
      setEditingId(created.id)
      setOwned(true)
      setNote(editingId ? "Şirkət nüsxəsi saxlandı." : "Şablon bazada saxlandı.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Şablon saxlanmadı")
    }
  }

  async function renderText() {
    const saved = library.find((row) => row.id === editingId)
    const local = fillLocal(form.body, liveFields)
    if (!editingId || !saved || saved.body !== form.body) {
      setRendered(local)
      setMeta({ version: form.version, legal: form.legal })
      setNote("Mətn yığıldı. Hüquqi rəy əvəzi deyil.")
      return
    }
    try {
      const result = await api<{ text: string; version: string; legal: string }>(`/api/platform/templates/${editingId}/render`, {
        method: "POST",
        body: JSON.stringify({ fields }),
      })
      setRendered(result.text)
      setMeta({ version: result.version, legal: result.legal })
      setNote("Mətn yığıldı. Hüquqi rəy əvəzi deyil.")
    } catch (reason) {
      setRendered(local)
      setMeta({ version: form.version, legal: form.legal })
      setNote(reason instanceof ApiError ? reason.message : "Yerli yığım göstərilir. Hüquqi rəy əvəzi deyil.")
    }
  }

  function download(kind: "doc" | "pdf") {
    if (!paper.trim()) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(form.name || "Sənəd")}</title></head><body><p>Versiya ${escapeHtml(meta.version || form.version || "—")} · ${escapeHtml(meta.legal || form.legal || "Gözləyir")} · hüquqi rəy əvəzi deyil</p><pre>${escapeHtml(paper)}</pre></body></html>`
    if (kind === "pdf") {
      const frame = window.open("", "_blank")
      if (!frame) return
      frame.document.write(html)
      frame.document.close()
      frame.focus()
      frame.print()
      return
    }
    const blob = new Blob(["\ufeff", html], { type: "application/msword" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${form.name || "sened"}.doc`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="tpl-page">
      <PageHead kicker="Sənəd" title="Hüquqi şablonlar" text="Müqavilə, akt, zəmanət və sifariş mətnləri burada saxlanır. Şirkət adı və VÖEN kabinetdən gəlir. Rəsmi imza sisteminə ötürülmür.">
        <button type="button" className="btn" onClick={startNew}>Yeni şablon</button>
      </PageHead>
      <section className="statstrip">
        <article><span>Şablon</span><strong>{library.length}</strong><em>kitabxanada</em></article>
        <article><span>Baxılıb</span><strong>{reviewed}</strong><em>hüquq yoxlaması keçib</em></article>
        <article><span>Gözləyir</span><strong>{waiting}</strong><em>hələ baxılmayıb</em></article>
        <article><span>Geri qaytarılıb</span><strong>{returned}</strong><em className={returned ? "warn" : undefined}>düzəliş istəyir</em></article>
      </section>
      <div className="tpl-layout">
        <section className="panel pad tpl-library">
          <div className="panel-head">
            <h2>Kitabxana</h2>
            <span className="muted">{filtered.length} sənəd</span>
          </div>
          <label className="search tpl-search">
            <Icon name="search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad, tərəf və ya mətn" />
          </label>
          <Tabs
            value={kindFilter}
            onChange={setKindFilter}
            options={[{ id: "hamisi", label: "Hamısı" }, ...TEMPLATE_KINDS.map((item) => ({ id: item, label: item }))]}
          />
          <div className="tpl-cards">
            {filtered.length === 0 && <Empty title="Şablon tapılmadı" text="Filtri və axtarışı təmizləyin, ya da yeni şablon yazın." />}
            {filtered.map((row) => (
              <button key={row.id} type="button" className={`tpl-card${row.id === editingId ? " on" : ""}`} onClick={() => openRow(row)}>
                <span className="tpl-card-top">
                  <span className={`badge ${kindTone(row.kind)}`}>{kindLabel(row.kind)}</span>
                  <span className={`badge ${legalTone(row.legal)}`}>{legalLabel(row.legal)}</span>
                </span>
                <strong>{row.name}</strong>
                <p>{templateExcerpt(row.body)}</p>
                <span className="tpl-card-meta">
                  <span>v.{row.version || "—"}</span>
                  <span>{row.party || "Tərəf yoxdur"}</span>
                  <span>{row.updatedOn ? dateAZ(String(row.updatedOn).slice(0, 10)) : "tarix yoxdur"}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel pad tpl-studio">
          <div className="tpl-studio-head">
            <div>
              <p className="eyebrow">{owned ? "Şirkət şablonu" : editingId ? "Ümumi kitabxana" : "Yeni şablon"}</p>
              <h2>{form.name.trim() || "Adsız şablon"}</h2>
            </div>
            <div className="tpl-studio-actions">
              <button type="button" className="btn ghost small" onClick={() => void renderText()}>Mətni yığ</button>
              <button type="button" className="btn" onClick={() => void save()}>{owned ? "Yenilə" : editingId ? "Nüsxə saxla" : "Saxla"}</button>
            </div>
          </div>
          <div className="tpl-fields">
            <label>Şablon adı<input value={form.name} onChange={(event) => { setRendered(""); setForm({ ...form, name: event.target.value }) }} /></label>
            <label>Növ<Select value={form.kind} onValueChange={(kind) => { setRendered(""); setForm({ ...form, kind }) }} options={TEMPLATE_KINDS.map((item) => ({ value: item, label: item }))} /></label>
            <label>Versiya<input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label>
            <label>Hüquq yoxlaması<Select value={form.legal} onValueChange={(legal) => setForm({ ...form, legal })} options={TEMPLATE_LEGAL.map((item) => ({ value: item, label: item }))} /></label>
            <label className="span-2">Tərəf<input value={form.party} onChange={(event) => setForm({ ...form, party: event.target.value })} placeholder="Sifarişçi, bank, anbar" /></label>
          </div>
          <TemplateBodyField value={form.body} onChange={(body) => { setRendered(""); setForm({ ...form, body }) }} />
          <div className="tpl-fill">
            <div className="tpl-body-top"><span>Yığım</span><em>boş sahə mətndə işarə ilə qalır</em></div>
            <div className="tpl-fields">
              <label>Tərəf<input value={fields.teref} onChange={(event) => { setRendered(""); setFields({ ...fields, teref: event.target.value }) }} /></label>
              <label>Məbləğ<input value={fields.mebleg} onChange={(event) => { setRendered(""); setFields({ ...fields, mebleg: event.target.value }) }} /></label>
              <label>Tarix<DateField value={fields.tarix} onChange={(tarix) => { setRendered(""); setFields({ ...fields, tarix }) }} ariaLabel="Tarix" /></label>
              <label>Layihə<input value={fields.layihe} onChange={(event) => { setRendered(""); setFields({ ...fields, layihe: event.target.value }) }} /></label>
              <label>Müddət<input value={fields.muddet} onChange={(event) => { setRendered(""); setFields({ ...fields, muddet: event.target.value }) }} /></label>
              <label>Dövr<input value={fields.dovr} onChange={(event) => { setRendered(""); setFields({ ...fields, dovr: event.target.value }) }} /></label>
            </div>
          </div>
          {note && <p className="tpl-note">{note}</p>}
          <article className="tpl-paper">
            <header>
              <span>Yığılmış mətn</span>
              <span>v.{meta.version || form.version || "—"} · {legalLabel(meta.legal || form.legal)}</span>
            </header>
            <div>{paper.trim() ? highlightBody(paper) : "Mətn boşdur."}</div>
            <footer>
              <span>Hüquqi rəy əvəzi deyil.</span>
              <span>
                <button type="button" className="btn ghost small" onClick={() => download("doc")} disabled={!paper.trim()}>Word</button>
                <button type="button" className="btn ghost small" onClick={() => download("pdf")} disabled={!paper.trim()}>PDF</button>
              </span>
            </footer>
          </article>
        </section>
      </div>
    </div>
  )
}

export function AdminPage() {
  useTitle("İdarə")
  const { cabinet, coop, tender } = useWorkspace()
  const [packs, setPacks] = useState<Pack[]>([])
  const [draft, setDraft] = useState<Record<string, { amount: string; userLimit: string; smetaLimit: string }>>({})
  const [note, setNote] = useState("")

  useEffect(() => {
    api<Pack[]>("/api/platform/packages").then((rows) => {
      setPacks(rows)
      setDraft(Object.fromEntries(rows.map((row) => [row.id, {
        amount: row.amount == null ? "" : String(row.amount),
        userLimit: row.userLimit == null ? "" : String(row.userLimit),
        smetaLimit: row.smetaLimit == null ? "" : String(row.smetaLimit),
      }])))
    }).catch((reason) => setNote(reason instanceof ApiError ? reason.message : "Paketlər oxunmadı"))
  }, [])

  async function save(id: string) {
    const row = draft[id]
    if (!row) return
    try {
      await api(`/api/platform/packages/${id}`, { method: "PATCH", body: JSON.stringify(row) })
      setNote("Paket məbləği və hədləri yazıldı. Kartla tutulma yoxdur.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Paket yazılmadı")
    }
  }

  return (
    <>
      <PageHead kicker="Platforma" title="İdarə paneli" text="Abunə məbləği, istifadəçi və layihə həddi buradan dəyişir. Şirkətin smeta və anbar rəqəmi bu paneldə açılmır." />
      <section className="panel pad">
        <div className="step-row"><span>Açıq kabinet</span><strong>{cabinet.code ? 1 : 0}</strong></div>
        <div className="step-row"><span>Əməkdaşlıq sorğusu</span><strong>{coop.length}</strong></div>
        <div className="step-row"><span>Növbədəki tender paketi</span><strong>{tender.confirmed ? 1 : 0}</strong></div>
        {packs.map((pack) => (
          <div className="form-row wide" key={pack.id}>
            <strong>{pack.name}</strong>
            <label>Məbləğ, AZN<input value={draft[pack.id]?.amount ?? ""} onChange={(event) => setDraft({ ...draft, [pack.id]: { ...draft[pack.id], amount: event.target.value } })} placeholder="boşdursa limitsiz qiymət yoxdur" /></label>
            <label>İstifadəçi həddi<input value={draft[pack.id]?.userLimit ?? ""} onChange={(event) => setDraft({ ...draft, [pack.id]: { ...draft[pack.id], userLimit: event.target.value } })} placeholder="boşdursa limitsiz" /></label>
            <label>Layihə həddi<input value={draft[pack.id]?.smetaLimit ?? ""} onChange={(event) => setDraft({ ...draft, [pack.id]: { ...draft[pack.id], smetaLimit: event.target.value } })} placeholder="boşdursa limitsiz" /></label>
            <button type="button" className="btn" onClick={() => void save(pack.id)}>Yaz</button>
          </div>
        ))}
        {note && <p className="lede">{note}</p>}
      </section>
    </>
  )
}
