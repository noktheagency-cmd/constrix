import { Checkbox } from "../components/Checkbox"
import { Button, Disclosure, Input, Metric, Panel, SearchInput, SectionHeader, StatGrid, TableContainer, Textarea, Toolbar } from "../components/primitives"
import { usePageTransition } from "../components/PageTransition"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { dateAZ, money as moneyAZ, moneyShort, num } from "../format"
import { Icon } from "../icons"
import { Confirm, Empty, Field, Meter, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"
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
import {
  chooseQuote,
  deliverOrder,
  openRfq,
  orderFromRfq,
  quoteCompareRows,
  receiveOrder,
  seedQuotes,
  type MarketCartLine,
  type MarketOrder,
  type MarketRfq,
} from "../domain/marketRfq"
import { useStore } from "../store"

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
          <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saxlanır" : "Saxla"}</Button>
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
              <label>Hüquqi ad<Input value={cabinet.name} onChange={(event) => setCabinet("name", event.target.value)} /></label>
              <label>VÖEN<Input value={cabinet.voen} onChange={(event) => setCabinet("voen", event.target.value)} inputMode="numeric" /></label>
              <label className="wide">Hüquqi ünvan<Input value={cabinet.legalAddress} onChange={(event) => setCabinet("legalAddress", event.target.value)} /></label>
              <label className="wide">Faktiki ünvan<Input value={cabinet.actualAddress} onChange={(event) => setCabinet("actualAddress", event.target.value)} /></label>
            </div>
          </section>
          <section className="cabinet-sheet">
            <h2>Əlaqə</h2>
            <div className="cabinet-fields">
              <label>Direktor<Input value={cabinet.director} onChange={(event) => setCabinet("director", event.target.value)} /></label>
              <label>Telefon<Input value={cabinet.phone} onChange={(event) => setCabinet("phone", event.target.value)} inputMode="tel" /></label>
              <label className="wide">E-poçt<Input value={cabinet.email} onChange={(event) => setCabinet("email", event.target.value)} inputMode="email" /></label>
            </div>
          </section>
          <section className="cabinet-sheet">
            <h2>Fəaliyyət</h2>
            <div className="cabinet-fields">
              <label>İstiqamət<Input value={cabinet.activity} onChange={(event) => setCabinet("activity", event.target.value)} /></label>
              <label>İşçi sayı<Input value={cabinet.headcount} onChange={(event) => setCabinet("headcount", event.target.value)} inputMode="numeric" /></label>
              <label className="wide">Lisenziya və icazə<Textarea value={cabinet.permits} onChange={(event) => setCabinet("permits", event.target.value)} placeholder="sənədin adı" rows={2} /></label>
              <label className="wide">Texnika<Textarea value={cabinet.fleet} onChange={(event) => setCabinet("fleet", event.target.value)} rows={2} /></label>
              <label className="wide">Əvvəlki işlər<Textarea value={cabinet.pastWork} onChange={(event) => setCabinet("pastWork", event.target.value)} rows={3} /></label>
            </div>
          </section>
          <section className="cabinet-sheet">
            <h2>Uçot</h2>
            <div className="cabinet-fields">
              <label>Dövriyyə, AZN<Input value={cabinet.turnover} onChange={(event) => setCabinet("turnover", event.target.value)} /></label>
              <label className="wide">Bank hesabı<Textarea value={cabinet.bankAccount} onChange={(event) => setCabinet("bankAccount", event.target.value)} rows={2} /></label>
            </div>
          </section>
          <div className="cabinet-save">
            <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saxlanır" : "Kabineti saxla"}</Button>
          </div>
        </div>

        <aside className="cabinet-seats">
          <div className="cabinet-sheet">
            <h2>Səlahiyyət</h2>
            <p className="cabinet-seat-lead">{seats.length} nəfər · {openRoles} vəzifə doludur</p>
            <div className="seat-add">
              <label>Əməkdaş<Input value={seat.name} onChange={(event) => setSeat({ ...seat, name: event.target.value })} /></label>
              <label>Vəzifə<Select value={seat.role} onValueChange={(role) => setSeat({ ...seat, role })} options={SEAT_ROLES.map((item) => ({ value: item, label: item }))} /></label>
              <Button type="button" disabled={!seat.name.trim() || seatBusy} onClick={() => void addSeat()}>{seatBusy ? "Yazılır" : "Təyin et"}</Button>
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
  const [detail, setDetail] = useState(false)
  const [view, setView] = useState("info")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const pageRef = useRef<HTMLDivElement>(null)
  usePageTransition(pageRef, detail ? "detail" : "list", true)
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
  const shownBoard = board.filter((item) => {
            const expired = (hoursUntil(item.deadline) ?? -1) < 0
            if(status === "ready" && !item.confirmed) return false
            if(status === "expired" && !expired) return false
            if(status === "open" && (expired || item.confirmed)) return false
            return !query.trim() || [item.number,item.subject,item.buyer].join(" ").toLocaleLowerCase("az").includes(query.trim().toLocaleLowerCase("az"))
          })
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
  ].filter(Boolean).filter((item) => item !== stage.word)

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
    setDetail(true)
    setView("info")
    if (key === active) return
    setDesk(null)
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
    <div className="etender-workspace" ref={pageRef}>
      {detail && <Button className="ghost tender-back" onClick={() => setDetail(false)}><Icon name="chevronLeft" />Elanlara qayıt</Button>}
      <PageHead title="e-Tender" text={detail ? "Tender paketinin hazırlanması və yoxlanması." : "Elanları seçin və tender paketini hazırlayın."}>
        {detail && <>
        <Button
          type="button"
          className="ghost"
          onClick={() => {
            const lines = [
              `CONSTRIX tender paketi · ${live.number || number || "—"}`,
              `Predmet: ${live.subject || tender.subject || "—"}`,
              `Alıcı: ${live.buyer || tender.buyer || "—"}`,
              `Son tarix: ${live.deadline || tender.deadline || "—"}`,
              "",
              "Sənəd siyahısı (portal bağlı — yerli hazırlıq):",
              ...CHECKS.map((item, index) => {
                const row = live.checks.find((check) => check.name === item)
                const mark = row?.fit === "uygun" ? "[x]" : "[ ]"
                return `${mark} ${index + 1}. ${item}${row ? ` · ${FIT_LABEL[row.fit]}` : ""}`
              }),
              "",
              "Təsdiq zənciri:",
              ...live.approvals.map((item) => `- ${item.role}: ${item.status}`),
              "",
              `Şirkət: ${companyLine || "—"}`,
              "Qeyd: Etender portal sessiyası bağlıdır; bu fayl yerli yoxlama siyahısıdır.",
            ]
            const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `tender-paket-${(live.number || number || "draft").replace(/\W+/g, "_")}.txt`
            link.click()
            URL.revokeObjectURL(url)
          }}
        >
          Paket siyahısı
        </Button>
        <Button type="button" className="ghost" onClick={() => void refresh()}>Müddəti yoxla</Button>
        <label className="btn ghost small boq-upload">
          {reading ? "Oxunur" : "Sənədi oxu"}
          <input type="file" accept=".pdf,.docx,.txt" disabled={reading} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void readPaper(file) }} />
        </label>
        <Button type="button" onClick={() => void save({ opened: true })}>Bazaya yaz</Button>
        </>}
      </PageHead>
      {error && <p className="form-error">{error}</p>}
      {note && <p className="lede">{note}</p>}

      {!detail && <>
        <Toolbar className="tender-list-toolbar"><SearchInput aria-label="Tender axtar" value={query} placeholder="Elan, alıcı və ya nömrə axtar" onChange={(event) => setQuery(event.target.value)} /><Select ariaLabel="Tender vəziyyəti" value={status} onValueChange={setStatus} options={[{value:"all",label:"Bütün elanlar"},{value:"open",label:"Açıq elanlar"},{value:"ready",label:"Hazır paket"},{value:"expired",label:"Müddət keçib"}]} /></Toolbar>
        <TableContainer className="tender-library"><table><thead><tr><th>Elan</th><th>Alıcı</th><th>Son tarix</th><th className="num">Ehtimal qiymət</th><th>Vəziyyət</th><th>Aç</th></tr></thead><tbody>
          {shownBoard.map((item) => { const state = stageOf(item); return <tr key={item.key} tabIndex={0} onClick={() => choose(item.key)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();choose(item.key)}}}>
            <td><span className="tender-number">{item.number}</span><strong>{item.subject}</strong></td><td>{item.buyer}</td><td>{item.deadline ? clock(item.deadline) : "—"}<span className="tender-due">{dueWord(item.deadline)}</span></td><td className="num">{moneyShort(Number(item.price) || 0)}</td><td><span className={pillClass(state.tone)}>{state.word}</span></td><td><Icon name="chevron" /></td>
          </tr>})}
        </tbody></table></TableContainer>
        {shownBoard.length === 0 && <Empty title="Elan tapılmadı" text="Axtarışı və ya vəziyyət filtrini dəyişin." />}
        <p className="tender-list-note">{shownBoard.length} elan · Elanın sətrinə klikləyərək məlumatları və sənəd paketini açın.</p>
      </>}
      {detail && <>
        <Panel className="tender-detail-summary"><div><span>{live.number}{live.place ? " · " + live.place : ""}</span><h2>{live.subject || "Predmet yazılmayıb"}</h2><p>{live.buyer || "Alıcı yazılmayıb"}</p></div><div><span className={pillClass(stage.tone)}>{stage.word}</span><strong>{moneyShort(Number(live.price) || 0)}</strong><span>{live.deadline ? clock(live.deadline) : "Son tarix yazılmayıb"}</span></div></Panel>
        {alertBits.length > 0 && <p className="tender-alert" role="status">{alertBits.join(" · ")}</p>}
        <Tabs value={view} onChange={setView} options={[{id:"info",label:"Məlumatlar"},{id:"docs",label:"Sənədlər"},{id:"checks",label:"Yoxlama və təsdiq"},{id:"assistant",label:"Köməkçi"}]} />

        {view === "docs" && (<Panel className="pad">
          <SectionHeader>
            <h2>Sənəd qovluğu</h2>
            <span className="muted">{missingPapers ? `${missingPapers} çatışır` : "Əsas sənədlər yazılıb"}</span>
          </SectionHeader>
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
                {value ? <strong>{value}</strong> : hit ? <Button type="button" className="small" onClick={() => edit({ [key]: hit.name })}>Qovluğa yaz</Button> : <strong>Çatışmır</strong>}
              </div>
            )
          })}
          <div className="step-row"><span>Şirkət kartı</span><strong>{companyLine || "Kabinet boşdur"}</strong></div>
          <div className="step-row"><span>BOQ</span><strong><Link to="/boq">{boq.lines.length ? `${boq.lines.length} sətir` : boq.sheets.filter(Boolean).join(", ") || "Aç"}</Link></strong></div>
        <Disclosure title="Sənəd adlarını düzəlt"><div className="form-row wide">          <label>Texniki tapşırıq<Input value={live.task} onChange={(event) => edit({ task: event.target.value })} /></label>
          <label>Müqavilə layihəsi<Input value={live.contractDraft} onChange={(event) => edit({ contractDraft: event.target.value })} /></label>
          <label>İxtisas sənədi<Input value={live.qualification} onChange={(event) => edit({ qualification: event.target.value })} /></label>
          <label>Oxşar iş sübutu<Input value={live.similar} onChange={(event) => edit({ similar: event.target.value })} /></label>
</div></Disclosure></Panel>)}

        {view === "checks" && (<Panel className="pad">
          <SectionHeader>
            <h2>Təsdiq zənciri</h2>
            <span className="muted">{signed}/{live.approvals.length || 4}</span>
          </SectionHeader>
          <Meter value={live.approvals.length ? (signed / live.approvals.length) * 100 : 0} tone="pine" />
          {live.approvals.map((item) => (
            <div className="check-row" key={item.role}>
              <span>{item.role}</span>
              <Select compact ariaLabel={item.role + " təsdiqi"} value={item.status} onValueChange={(status) => edit({ confirmed: false, approvals: live.approvals.map((row) => row.role === item.role ? { ...row, status: status as Approval } : row) })} options={TENDER_APPROVAL} />
            </div>
          ))}
          <button type="button" className="etender-pack" onClick={() => void confirm()}>
            <Icon name="check" />
            <span>Təsdiqlə və paket hazırla</span>
          </button>
          {live.confirmed && <p className="lede">Paket təsdiqlənib. Göndəriş portal sessiyası bağlanana qədər növbədə qalır.</p>}
        </Panel>)}

      {view === "checks" && (<Panel className="pad">
        <SectionHeader>
          <h2>Sənəd yoxlaması</h2>
          <span className="muted">{live.checks.length ? `${fitCount}/${live.checks.length} uyğundur` : "Siyahı boşdur"}</span>
        </SectionHeader>
        {live.checks.length === 0 && <Button type="button" onClick={() => edit({ opened: true, confirmed: false, checks: CHECKS.map((name) => ({ name, fit: "catismir" as Fit })), approvals: APPROVALS.map((role) => ({ role, status: "gozleyir" as Approval })) })}>Yoxlama siyahısını aç</Button>}
        <div className="etender-checks">
          {orderedChecks.map((item) => (
            <div className="check-row" key={item.name}>
              <span>{item.name}</span>
              <Select compact ariaLabel={item.name + " nəticəsi"} value={item.fit} onValueChange={(fit) => edit({ checks: live.checks.map((row) => row.name === item.name ? { ...row, fit: fit as Fit } : row) })} options={TENDER_FIT} />
            </div>
          ))}
        </div>
      </Panel>)}

      {view === "assistant" && (<Panel className="pad">
        <SectionHeader>
          <h2>Tender köməkçisi</h2>
          <span className="muted">etender.gov.az bağlıdır. Oxuma yüklənmiş sənəddən gedir.</span>
        </SectionHeader>
        <label className="wide">Tender mətni
          <Textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={4} placeholder="PDF-dən mətn çıxmasa, şərti bura yapışdırın" />
        </label>
        <div className="form-actions">
          <Button type="button" disabled={reading || paste.trim().length < 20} onClick={() => void sendBrief(paste)}>Mətni oxu</Button>
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
      </Panel>)}

      {view === "info" && (<Panel className="pad">
        <SectionHeader>
          <h2>Elan məlumatları</h2>
          <span className="muted">{live.number}</span>
        </SectionHeader>
        <div className="form-row wide">
          <label>etender.gov.az linki<Input value={live.link} onChange={(event) => edit({ link: event.target.value, opened: false, confirmed: false })} placeholder="https://etender.gov.az/main/competition/detail/..." /></label>
          <label>Elan nömrəsi<Input value={live.number} onChange={(event) => setNumber(event.target.value)} /></label>
          <label>Alıcı<Input value={live.buyer} onChange={(event) => edit({ buyer: event.target.value })} /></label>
          <label>Predmet<Input value={live.subject} onChange={(event) => edit({ subject: event.target.value })} /></label>
          <label>Təsnifat kodu<Input value={live.classCode} onChange={(event) => edit({ classCode: event.target.value })} /></label>
          <label>Təsnifat mətni<Input value={live.classText} onChange={(event) => edit({ classText: event.target.value })} /></label>
          <label>Son tarix<DateTimeField value={live.deadline} onChange={(deadline) => edit({ deadline })} ariaLabel="Son tarix" /></label>
          <label>Ehtimal qiymət, AZN<Input value={live.price} onChange={(event) => edit({ price: event.target.value })} inputMode="decimal" /></label>
        </div>
        <Disclosure title="Təminat və müddət parametrləri"><dl className="tender-bonds"><div><dt>İştirak təminatı</dt><dd>{money(math.bid)} AZN</dd></div><div><dt>İcra təminatı · {math.performRate}%</dt><dd>{money(math.perform)} AZN</dd></div><div><dt>Avans təminatı</dt><dd>{money(math.advance)} AZN</dd></div></dl><div className="form-row wide">
          <label>İştirak təminatı<Select value={live.bidMode} onValueChange={(bidMode) => edit({ bidMode: bidMode as "fixed" | "percent" })} options={[{ value: "fixed", label: "Sabit məbləğ" }, { value: "percent", label: "Faiz" }]} /></label>
          <label>{live.bidMode === "fixed" ? "İştirak, AZN" : "İştirak, %"}<Input value={live.bidValue} onChange={(event) => edit({ bidValue: event.target.value })} /></label>
          <label>Mikro və ya kiçik<Select value={live.sme ? "beli" : "xeyr"} onValueChange={(value) => edit({ sme: value === "beli" })} options={[{ value: "xeyr", label: "Xeyr, icra 10%" }, { value: "beli", label: "Bəli, icra 5%" }]} /></label>
          <label>İcra faizinə güzəşt<Input value={live.discount} onChange={(event) => edit({ discount: event.target.value })} placeholder="məs. 4" /></label>
          <label>Avans təminatı, %<Input value={live.advance} onChange={(event) => edit({ advance: event.target.value })} /></label>
          <label>İştirak təminatı, gün<Input value={live.bondDays} onChange={(event) => edit({ bondDays: event.target.value })} /></label>
          <label>İcra təminatı, gün<Input value={live.performDays} onChange={(event) => edit({ performDays: event.target.value })} /></label>
        </div>
</Disclosure>
      {live.lots.length > 0 && <Disclosure title="Elanın iş həcmləri"><dl className="tender-bonds">{live.lots.map((lot) => <div key={lot.name}><dt>{lot.name}</dt><dd>{lot.qty}</dd></div>)}</dl></Disclosure>}</Panel>)}
      </>}
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
    <Panel className="pad">
      <SectionHeader>
        <h2>{title}</h2>
        <strong>{money(sum)} AZN</strong>
      </SectionHeader>
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
        <label>Ad<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Məbləğ, AZN<Input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
        <Button type="button" onClick={onAdd}>Əlavə et</Button>
      </div>
    </Panel>
  )
}

export function BoqPage() {
  useTitle("BOQ")
  useTitle("BOQ")
  const { boq } = useWorkspace()
  const [view, setView] = useState("lines")
  const [addOpen, setAddOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
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
  const eligible = shown.filter((line) => !line.stale)
  const confirmedCount = eligible.filter((line) => line.confirmed !== false).length
  function confirmVisible(checked: boolean) {
    const ids = new Set(eligible.map((line) => line.id))
    patch((state) => ({ ...state, boq: { ...state.boq, lines: state.boq.lines.map((line) => ids.has(line.id) ? { ...line, confirmed: checked } : line) } }))
  }
  const shownTotal = shown.reduce((sum, line) => sum + lineTotal(line), 0)
  const skipped = boq.lines.filter((line) => line.confirmed === false || line.stale).length
  const machines = boq.gear ?? []
  const crew = boq.staff.reduce((sum, row) => sum + (Number(row.count) || 0), 0)
  const sheetBars = boq.sheets.map((name) => ({
    name,
    total: boq.lines.filter((line) => line.sheet === name).reduce((sum, line) => sum + lineTotal(line), 0),
  }))
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
    setSheetOpen(false)
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
    setAddOpen(false)
    setDraft({ sheet: lineSheet, name: "", unit: draft.unit, qty: "", material: "", labor: "", laborOnly: false })
  }

  return (
    <div className="boq-page boq-workspace">
      <PageHead
        title="İşlərin həcmi"
        text="İş sətirlərini və xərcləri bir yerdə idarə edin."
      >
        <label className="btn ghost small boq-upload">
          Həcm yüklə
          <input type="file" accept={FILE_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadVolume(file) }} />
        </label>
        <Button type="button" className="small" onClick={() => void saveBoq()}>Bazaya yaz</Button>
      </PageHead>
      {boqNote && <p className={noteWarn ? "boq-banner warn" : "boq-banner"}>{boqNote}</p>}
      <Tabs value={view} onChange={setView} options={[{id:"lines",label:"Həcm cədvəli"},{id:"costs",label:"Xərclər"},{id:"resources",label:"Resurslar"},{id:"settings",label:"Parametrlər"}]} />
      {view === "settings" && (      <Panel className="pad">
        <SectionHeader>
          <h2>On üç xərc</h2>
          <span className="muted">{METHODS.find((item) => item[0] === boq.method)?.[1]} · {boq.region}</span>
        </SectionHeader>
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
          <Button type="button" className="ghost" onClick={applyLabor}>İşçilik tarifi</Button>
          <Button type="button" className="ghost" onClick={applyRegion}>Rayon qiyməti</Button>
        </div>
        <div className="boq-rules-grid">{math.parts.map((part) => (
          <div className="step-row" key={part.key}>
            <Checkbox label={part.name} checked={part.on} onChange={() => patch((state) => ({...state,boq:{...state.boq,rules:state.boq.rules.map((rule)=>rule.key===part.key?{...rule,on:!rule.on}:rule)}}))} />
            <strong>{money(part.on ? part.amount : 0)} AZN</strong>
          </div>
        ))}
        </div><Disclosure title="Rayonlar üzrə qiymət müqayisəsi">        <TableContainer className="flat">
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
        </TableContainer></Disclosure>
      </Panel>)}
      {view === "lines" && <div className="boq-split">
        <Panel className="pad">
          <SectionHeader>
            <h2>
              Həcm cədvəli
              {!boq.id && <span className="badge gold">Nümunə</span>}
            </h2>
            <Button className="small" onClick={() => setAddOpen(true)}><Icon name="plus" />Yeni sətir</Button>
          </SectionHeader>
          <div className="boq-tools">
            <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
              <Icon name="search" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İş və ya mənbə" aria-label="Smetada axtar" />
            </form>
            <Select ariaLabel="Fənn" value={active || "hamisi"} onValueChange={(id) => {setSheet(id);if(id!=="hamisi")setDraft((row)=>({...row,sheet:id}))}} options={[{value:"hamisi",label:"Bütün fənnlər"},...boq.sheets.map((name)=>({value:name,label:name}))]} />
            <Button className="ghost small" onClick={() => setSheetOpen(true)}>Yeni fənn</Button><Button className="ghost small" onClick={() => void bindPrices()}>Qiyməti bağla</Button>
          </div>
          <p className="boq-confirm-hint">{confirmedCount}/{eligible.length} aktual sətir təsdiqlənib. Köhnə qiymət hesaba daxil edilmir.</p>
          {shown.length === 0 && (
            <Empty
              title={active ? `${active} boşdur` : "Uyğun sətir yoxdur"}
              text={active ? "Yeni sətir düyməsindən bu fənnə iş əlavə edin." : "Axtarışı təmizləyin və ya başqa fənn seçin."}
            />
          )}
          {shown.length > 0 && (
            <TableContainer className="flat">
              <table className="boq-table">
                <thead>
                  <tr>
                    <th><Checkbox aria-label="Görünən aktual sətirləri təsdiqlə" checked={eligible.length > 0 && confirmedCount === eligible.length} indeterminate={confirmedCount > 0 && confirmedCount < eligible.length} disabled={!eligible.length} onChange={(event) => confirmVisible(event.target.checked)} /></th>
                    <th>İş</th>
                    <th>Vahid</th>
                    <th className="num">Miqdar</th>
                    <th className="num">Material</th>
                    <th className="num">İşçilik</th>
                    <th className="num">Cəmi</th>
                    <th><span className="sr">Sil</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((line) => {
                    const mark = lineMark(line)
                    return (
                      <tr key={line.id} className={line.stale ? "stale" : undefined}>
                        <td>
                              <Checkbox
                                checked={line.confirmed !== false && !line.stale}
                                disabled={line.stale}
                                aria-label={`${line.name} təsdiqi`}
                                onChange={(event) => patch((state) => ({ ...state, boq: { ...state.boq, lines: state.boq.lines.map((item) => item.id === line.id ? { ...item, confirmed: event.target.checked } : item) } }))}
                              /></td>
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
                            <button type="button" className="icon-btn boq-del" aria-label={`${line.name} sətrini sil`} onClick={() => patch((state) => ({ ...state, boq: { ...state.boq, lines: state.boq.lines.filter((item) => item.id !== line.id) } }))}><Icon name="bin" /></button>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>{active || "Hamısı"} · {shown.length} sətir</td>
                    <td className="num">{money(shownTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </TableContainer>
          )}
        </Panel>
        <aside className="panel pad boq-offer">
          <h2>Yekun təklif</h2>
          <strong className="boq-gross">{money(math.gross)}</strong>
          <span className="muted">AZN · {boq.lines.length - skipped} sətir hesaba düşür</span>
          <div className="form-row wide">
            <label>Mənfəət, %<Input value={boq.profit} onChange={(event) => patch((state) => ({ ...state, boq: { ...state.boq, profit: event.target.value } }))} /></label>
            <label>Vergi rejimi
              <Select value={boq.vat} onValueChange={(vat) => patch((state) => ({ ...state, boq: { ...state.boq, vat } }))} options={[{ value: "18", label: "Adi, ƏDV 18%" }, { value: "0", label: "AFEZ zonası, 0%" }]} />
            </label>
          </div>
          <dl className="boq-summary-lines">{shares.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl><Button onClick={() => void makeOffer()}>Təklifə çevir</Button>
          <Disclosure title="Fənn üzrə məbləğlər"><dl className="boq-summary-lines">{sheetBars.map((row) => <div key={row.name}><dt>{row.name}</dt><dd>{money(row.total)}</dd></div>)}</dl></Disclosure>
        </aside>
      </div>}
      {view === "costs" && <div className="boq-costs">
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
        <Panel className="pad">
          <SectionHeader>
            <h2>Əlavə xərc</h2>
            <strong>{money(math.extra)} AZN</strong>
          </SectionHeader>
          <p className="lede">Boş xana cəmə düşmür.</p>
          {(boq.extras.length ? boq.extras : EXTRA_COSTS.map((name) => ({ id: name, name, amount: "" }))).map((row) => (
            <label className="boq-extra" key={row.id}>
              {row.name}
              <Input
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
        </Panel>
      </div>}
      {view === "resources" && <><div className="boq-people">
        <Panel className="pad">
          <SectionHeader>
            <h2>Məsuliyyət</h2>
            <span className="muted">{boq.duties.length} iş</span>
          </SectionHeader>
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
            <label>İş<Input value={duty.work} onChange={(event) => setDuty({ ...duty, work: event.target.value })} /></label>
            <label>Material
              <Select value={duty.party} onValueChange={(party) => setDuty({ ...duty, party: party as Party })} options={(Object.keys(PARTY_LABEL) as Party[]).map((key) => ({ value: key, label: PARTY_LABEL[key] }))} />
            </label>
            <Button type="button" onClick={() => { if (!duty.work.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, duties: [...state.boq.duties, { ...duty, id: uid() }] } })); setDuty({ work: "", party: "podratci" }) }}>Əlavə et</Button>
          </div>
        </Panel>
        <Panel className="pad">
          <SectionHeader>
            <h2>Heyət</h2>
            <strong>{crew} nəfər</strong>
          </SectionHeader>
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
            <label>Vəzifə<Input value={staff.role} onChange={(event) => setStaff({ ...staff, role: event.target.value })} /></label>
            <label>Say<Input value={staff.count} onChange={(event) => setStaff({ ...staff, count: event.target.value })} /></label>
            <Button type="button" onClick={() => { if (!staff.role.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, staff: [...state.boq.staff, { ...staff, id: uid() }] } })); setStaff({ role: "", count: "" }) }}>Əlavə et</Button>
          </div>
        </Panel>
        <Panel className="pad">
          <SectionHeader>
            <h2>Texnika, növbə və yanacaq</h2>
            <strong>{money(machines.reduce((sum, row) => sum + gearCost(row).total, 0))} AZN</strong>
          </SectionHeader>
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
            <label>Say<Input value={gear.count} onChange={(event) => setGear({ ...gear, count: event.target.value })} /></label>
            <label>Ölçü
              <Select value={gear.basis} onValueChange={(basis) => setGear({ ...gear, basis: basis as GearBasis })} options={[{ value: "saat", label: "Saat" }, { value: "novbe", label: "Növbə" }, { value: "gun", label: "Gün" }, { value: "ay", label: "Ay" }, { value: "hecm", label: "Həcm" }]} />
            </label>
            <label>İcarə, AZN<Input value={gear.rate} onChange={(event) => setGear({ ...gear, rate: event.target.value })} /></label>
            <label>Müddət<Input value={gear.span} onChange={(event) => setGear({ ...gear, span: event.target.value })} /></label>
            <label>Yanacaq<Input value={gear.fuel} onChange={(event) => setGear({ ...gear, fuel: event.target.value })} /></label>
            <label>Operator<Input value={gear.operator} onChange={(event) => setGear({ ...gear, operator: event.target.value })} /></label>
            <label>Minimum<Input value={gear.minSpan} onChange={(event) => setGear({ ...gear, minSpan: event.target.value })} /></label>
            <label>Sığorta, AZN<Input value={gear.insurance} onChange={(event) => setGear({ ...gear, insurance: event.target.value })} /></label>
            <Button type="button" onClick={() => { if (!gear.name.trim()) return; patch((state) => ({ ...state, boq: { ...state.boq, gear: [...(state.boq.gear ?? []), { ...gear, id: uid() }] } })); setGear({ name: "", count: "", insurance: "", basis: gear.basis, rate: "", span: "", fuel: "", operator: "", minSpan: "" }) }}>Əlavə et</Button>
          </div>
        </Panel>
      </div>
      <Panel className="pad">
        <SectionHeader>
          <h2>İdarəetmə</h2>
        </SectionHeader>
        <label className="manage-note">Layihə necə idarə olunacaq
          <Textarea value={boq.management ?? ""} onChange={(event) => patch((state) => ({ ...state, boq: { ...state.boq, management: event.target.value } }))} placeholder="Forma, heyət və texnika tender mətninə buradan düşəcək" />
        </label>
        {!(boq.management ?? "").trim() && <p className="lede">İdarəetmə mətni yazılmayıb.</p>}
      </Panel></>}
      {addOpen && <Modal className="boq-line-modal" title="Yeni iş sətri" onClose={() => setAddOpen(false)}>          <div className="form-row wide">
            <label>Fənn
              <Select value={lineSheet} onValueChange={(value) => { setDraft({ ...draft, sheet: value }); setSheet(value) }} options={boq.sheets.map((item) => ({ value: item, label: item }))} />
            </label>
            <label>İş<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Vahid<Input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
            <label>Miqdar<Input value={draft.qty} onChange={(event) => setDraft({ ...draft, qty: event.target.value })} /></label>
            <label>Material, AZN<Input value={draft.material} onChange={(event) => setDraft({ ...draft, material: event.target.value })} disabled={draft.laborOnly} /></label>
            <label>İşçilik, AZN<Input value={draft.labor} onChange={(event) => setDraft({ ...draft, labor: event.target.value })} /></label>
            <Checkbox label="Yalnız işçilik — material sifarişçidən" checked={draft.laborOnly} onChange={(event) => setDraft({ ...draft, laborOnly: event.target.checked, material: event.target.checked ? "" : draft.material })} />
            <Button type="button" onClick={addLine}>Sətir əlavə et</Button>
          </div>
</Modal>}
      {sheetOpen && <Modal className="boq-sheet-modal" title="Yeni fənn" onClose={() => setSheetOpen(false)}>          <form className="boq-sheet-add" onSubmit={(event) => { event.preventDefault(); openSheet() }}>
            <label>
              Yeni fənn
              <Input value={sheetName} placeholder="Məsələn, Dam" onChange={(event) => setSheetName(event.target.value)} />
            </label>
            <Button type="submit" className="ghost small">Vərəq aç</Button>
            <p>Adı yazın və düyməni basın. Yeni boş vərəq açılır, cədvəl ona keçir. Əvvəlki sətirlər silinmir, Hamısı bölməsində qalır.</p>
          </form>
</Modal>}
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
  const [detail, setDetail] = useState(false)
  const [view, setView] = useState("info")
  const pageRef = useRef<HTMLDivElement>(null)
  usePageTransition(pageRef, detail ? "detail" : "list", true)
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
    setDetail(true)
    setView("info")
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
    <div className="qar guarantee-workspace" ref={pageRef}>
      {detail && <Button className="ghost guarantee-back" onClick={() => setDetail(false)}>Qarantiyalara qayıt</Button>}
      <PageHead title="Bank qarantiyası" text="Layihələrin zəmanət və sənədlərini idarə edin." />
      {!detail ? <>
        <Panel className="guarantee-overview" aria-label="Qarantiya xülasəsi">
          <div className="guarantee-stat"><span className="guarantee-stat-icon"><Icon name="briefcase" /></span><div><span>Layihələr</span><strong>{BOND_CASES.length}</strong><small>Bütün qarantiya paketləri</small></div></div>
          <div className="guarantee-stat"><span className="guarantee-stat-icon active"><Icon name="shield" /></span><div><span>Açıq qarantiyalar</span><strong>{openCases.length}</strong><small>{BOND_CASES.length - openCases.length} paket bağlanıb</small></div></div>
          <div className="guarantee-stat guarantee-stat-total"><span className="guarantee-stat-icon"><Icon name="bank" /></span><div><span>Təminat məbləği</span><strong>{money(exposure)} <em>AZN</em></strong><small>Açıq qarantiyalar üzrə cəmi</small></div></div>
        </Panel>
        <Toolbar className="guarantee-toolbar">
          <SearchInput value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Layihə axtar" />
          <Select ariaLabel="Layihə statusu" value={filter} onValueChange={setFilter} options={[{value:"hamisi",label:"Hamısı"},{value:"gozleme",label:"Gözləyir"},{value:"paket",label:"Paket hazırdır"},{value:"tesdiq",label:"Təsdiq"},{value:"legv",label:"Ləğv"}]} />
        </Toolbar>
        <TableContainer className="guarantee-table">
          <table><thead><tr><th>Layihə</th><th>Növ</th><th>Bank</th><th>Təminat, AZN</th><th>Bitmə tarixi</th><th>Status</th><th><span className="sr-only">Aç</span></th></tr></thead><tbody>
            {projectRows.map((item) => <tr key={item.id} tabIndex={0} onClick={() => openCase(item)} onKeyDown={(event) => { if(event.key === "Enter" || event.key === " ") {event.preventDefault(); openCase(item)} }}>
              <td><strong>{item.project}</strong><small>{item.id} · {item.buyer}</small></td><td>{KIND_LABEL[item.kind]}</td><td>{BOND_BANKS.find((row) => row.name === item.bank)?.short || item.bank}</td><td className="num">{money(bondMath(item).applied)}</td><td>{dateAZ(item.until)}</td><td><span className={`guarantee-status status-${item.status}`}>{BOND_STATUS[item.status].word}</span></td><td><Icon name="chevron" /></td>
            </tr>)}
          </tbody></table>
          {!projectRows.length && <Empty title="Uyğun layihə yoxdur" text="Axtarış və status filtrini dəyişin." />}
        </TableContainer>
        {filter === "hamisi" && !projectQueryText && liveRows.length > 0 && <Disclosure title={`Bazadakı digər paketlər · ${liveRows.length}`}><TableContainer><table><thead><tr><th>Layihə</th><th>Növ</th><th>Bank</th><th>Məbləğ, AZN</th></tr></thead><tbody>{liveRows.map((item) => <tr key={item.id}><td>{item.title || "Adsız paket"}</td><td>{KIND_LABEL[item.kind] || item.kind}</td><td>{item.partner?.name || "Bank yoxdur"}</td><td>{money(Number(dec(item.amount)) || 0)}</td></tr>)}</tbody></table></TableContainer></Disclosure>}
      </> : <>
        <Panel className="guarantee-summary">
          <div><span>{active.id} · {KIND_LABEL[active.kind]}</span><h2>{active.project}</h2><p>{active.buyer}</p></div>
          <div><span className={`guarantee-status status-${active.status}`}>{BOND_STATUS[active.status].word}</span><strong>{money(math.applied)} AZN</strong><span>{dateAZ(active.until)} · {daysLeft(active.until)}</span></div>
        </Panel>
        <Tabs value={view} onChange={setView} options={[{id:"info",label:"Ümumi məlumat"},{id:"papers",label:"Sənədlər"},{id:"calculation",label:"Hesablama"},{id:"banks",label:"Bank seçimi"}]} />
        {view === "info" && <Panel className="pad guarantee-info"><h2>Qarantiya məlumatları</h2><p className="lede">{active.note}</p><dl className="document-summary-fields"><div><dt>Şirkət</dt><dd>{cabinet.name.trim() || "AFEZ İnşaat"}</dd></div><div><dt>VÖEN</dt><dd>{cabinet.voen.trim() || "1700123451"}</dd></div><div><dt>Bank</dt><dd>{bank?.name || active.bank}</dd></div><div><dt>Qüvvədə olma müddəti</dt><dd>{days} gün</dd></div><div><dt>Açılma tarixi</dt><dd>{dateAZ(active.opened)}</dd></div><div><dt>Sənədlər</dt><dd>{readyPapers}/{active.papers.length} hazırdır</dd></div></dl><Button onClick={() => setView("papers")}>Sənədlərə bax</Button></Panel>}
        {view === "papers" && <Panel className="pad guarantee-papers"><SectionHeader><h2>Müraciət sənədləri</h2><span>{readyPapers}/{active.papers.length} hazırdır</span></SectionHeader>
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
              <Checkbox label="Şirkət paketi yoxladı" checked={guarantee.reviewed} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, reviewed: event.target.checked, packed: false } }))} />
              <button type="button" className="btn" onClick={() => void pack()} disabled={!bank || !guarantee.reviewed}>Sənəd mübadiləsinə hazırla</button>
              <button type="button" className="btn" onClick={pull} disabled={!tender.opened}>Yazılmış şərti gətir</button>
            </div>
            <p className="lede">{packNote || (guarantee.packed ? "Paket sənəd mübadiləsi üçün hazırdır. Bank API-si bağlı olsa da proses dayanmır." : "Paket bank seçiləndən və yoxlamadan sonra açılır.")}</p>

        </Panel>}
        {view === "calculation" && <Panel className="pad guarantee-calculation"><h2>Təminatın hesablanması</h2>
            <div className="form-row wide">
              <label>Növ<Select value={guarantee.kind} onValueChange={(kind) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, kind, packed: false } }))} options={[{ value: "istirak", label: "İştirak" }, { value: "icra", label: "İcra" }, { value: "avans", label: "Avans" }]} /></label>
              <label>Hesab<Select value={guarantee.mode} onValueChange={(mode) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, mode: mode as "percent" | "fixed", packed: false } }))} options={[{ value: "percent", label: "Faiz" }, { value: "fixed", label: "Sabit məbləğ" }]} /></label>
              <label>Baza, AZN<Input value={guarantee.amount} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, amount: event.target.value, packed: false } }))} /></label>
              <label>Şərtdəki faiz<Input value={guarantee.rate} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, rate: event.target.value, packed: false } }))} disabled={guarantee.mode === "fixed"} /></label>
              <label>Bank güzəşti, %<Input value={guarantee.offer} onChange={(event) => patch((state) => ({ ...state, guarantee: { ...state.guarantee, offer: event.target.value, packed: false } }))} placeholder="boşdursa şərt qalır" disabled={guarantee.mode === "fixed"} /></label>
            </div>
            {tender.opened && <p className="lede">Tender şərti: iştirak {money(suggested.bid)} AZN, icra {money(suggested.perform)} AZN, avans {money(suggested.advance)} AZN.</p>}
            <div className="step-row"><span>Şərt üzrə</span><strong>{money(math.asked)} AZN</strong></div>
            <div className="step-row"><span>Tətbiq olunan</span><strong>{money(math.applied)} AZN{guarantee.mode === "percent" ? ` · ${math.rate}%` : ""}</strong></div>
            <div className="step-row"><span>Komissiya</span><strong>{bank?.commission.trim() ? `${bank.commission}% · ${money(fee)} AZN` : "Yazılmayıb"}</strong></div>

        </Panel>}
        {view === "banks" && <>
          <Toolbar className="guarantee-toolbar"><SearchInput value={bankQuery} onChange={(event) => setBankQuery(event.target.value)} placeholder="Bank axtar" /><Link className="btn ghost" to="/partnyorlar">Bank reyestri</Link></Toolbar>
          <TableContainer className="guarantee-bank-table"><table><thead><tr><th>Seçim</th><th>Bank</th><th>Komissiya</th><th>Müddət</th><th>Status</th></tr></thead><tbody>{bankRows.map((item) => <tr key={item.id}><td><input type="radio" name="guarantee-bank" aria-label={item.name} checked={item.id === guarantee.bankId} onChange={() => patch((state) => ({...state, guarantee:{...state.guarantee,bankId:item.id,packed:false}}))} /></td><td><strong>{item.name}</strong></td><td>{item.commission.trim() ? `${item.commission}%` : "—"}</td><td>{item.term}</td><td>{bankTone(item).word}</td></tr>)}</tbody></table>{!bankRows.length && <p className="lede">Uyğun bank yoxdur.</p>}</TableContainer>
          {bank && (
            <section className="panel pad guarantee-bank-detail">
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
                <button type="button" className="btn" disabled={!bank.discount.trim() || guarantee.mode === "fixed"} onClick={() => patch((state) => ({ ...state, guarantee: { ...state.guarantee, offer: bank.discount, packed: false } }))}>Güzəşti tətbiq et</button>
              </div>
            </section>
          )}
        </>}
      </>}
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
  const [query, setQuery] = useState("")
  const [group, setGroup] = useState("all")
  const [selected, setSelected] = useState("")
  const [draft, setDraft] = useState<Fit>("el")
  const [notice, setNotice] = useState("")

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
  const open = rows.find((row) => row.name === selected)
  const needle = query.trim().toLocaleLowerCase("az")
  const shown = rows.filter((row) => {
    if (group !== "all" && row.group !== group) return false
    if (needle && ![row.name, row.title, row.paper, row.group].join(" ").toLocaleLowerCase("az").includes(needle)) return false
    if (filter === "el") return row.fit === "el"
    if (filter === "problem") return row.fit === "deyil" || row.fit === "catismir"
    if (filter === "gozleyir") return row.fit === "gozleyir"
    if (filter === "uygun") return row.fit === "uygun"
    return true
  })
  function openRow(name: string, fit: Fit) { setSelected(name); setDraft(fit) }

  return <div className="spec-page spec-workspace">
    <PageHead title="Spesifikasiya" text="Tələbləri yoxlayın və nəticələri qeyd edin." />
    <Panel className="spec-summary">
      <div className="spec-summary-progress"><strong>Yoxlanılıb <b>{decided}/{rows.length}</b></strong><Meter value={rows.length ? decided / rows.length * 100 : 0} tone="pine" /></div>
      <div><b className="spec-ok">{ok}</b><span>Uyğundur</span></div><div><b className="spec-problem">{problems}</b><span>Problem</span></div><div><b className="spec-wait">{waiting}</b><span>Gözləyir</span></div>
    </Panel>
    <div className="spec-status-key" aria-label="Nəticə rəngləri">{FIT_OPTIONS.map((item) => <span key={item.value} className={"badge spec-fit fit-" + item.value}>{item.value === "el" ? "Yoxlanılmayıb" : item.label}</span>)}</div>
    <Toolbar className="spec-toolbar">
      <SearchInput aria-label="Spesifikasiya axtar" value={query} placeholder="Bölmə və ya sənəd axtar" onChange={(event) => setQuery(event.target.value)} />
      <Select ariaLabel="Bölmə filtri" value={group} onValueChange={setGroup} options={[{ value: "all", label: "Bütün bölmələr" }, ...[...SPEC_GROUPS, "Digər"].map((name) => ({ value: name, label: name }))]} />
      <Select ariaLabel="Nəticə filtri" value={filter} onValueChange={setFilter} options={[{value:"hamisi",label:"Bütün nəticələr"},{value:"el",label:"Yoxlanılmayıb"},{value:"problem",label:"Problem"},{value:"gozleyir",label:"Gözləyir"},{value:"uygun",label:"Uyğundur"}]} />
    </Toolbar>
    {notice && <p className="spec-notice" role="status">{notice}</p>}
    {shown.length === 0 ? <Empty title="Uyğun bölmə tapılmadı" text="Axtarışı və ya filtrləri dəyişin." /> : <TableContainer className="spec-library"><table>
      <thead><tr><th>Kod</th><th>Bölmə</th><th>Sənəd</th><th>Nəticə</th><th>Aç</th></tr></thead>
      <tbody>{shown.map((row) => <tr key={row.name} tabIndex={0} onClick={() => openRow(row.name, row.fit)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();openRow(row.name,row.fit)}}}>
        <td className="mono">{row.code || "—"}</td><td><strong>{row.title}</strong><span className="spec-row-group">{row.group}</span></td><td>{row.paper}</td><td><span className={"badge spec-fit fit-" + row.fit}>{row.fit === "el" ? "Yoxlanılmayıb" : FIT_LABEL[row.fit]}</span></td><td><Icon name="chevron" /></td>
      </tr>)}</tbody>
    </table></TableContainer>}
    <p className="spec-list-count">{shown.length} / {rows.length} bölmə</p>
    <Disclosure title="Yoxlama qaydası" className="spec-help"><p>Bölməni seçin, göstərilən sənədi tələblə tutuşdurun və nəticəni saxlayın. Kodlar şablona aiddir; yoxlama siyahısı bütün layihələr üçün eynidir.</p><div className="spec-help-results">{(Object.keys(FIT_HINT) as Fit[]).map((key) => <div key={key}><span className={"badge " + fitTone(key)}>{FIT_LABEL[key]}</span><p>{FIT_HINT[key]}</p></div>)}</div></Disclosure>
    {open && <Modal title={open.title} onClose={() => setSelected("")} className="spec-result-modal">
      <p className="spec-modal-meta">{open.code ? open.code + " · " : ""}{open.group}</p>
      <div className="spec-question"><span>Yoxlama sualı</span><p>{open.question}</p></div>
      <div className="spec-paper"><Icon name="files" /><div><span>Baxılacaq sənəd</span><strong>{open.paper}</strong></div></div>
      <Field label="Nəticə"><Select ariaLabel={open.title + " nəticəsi"} value={draft} onValueChange={(value) => setDraft(value as Fit)} options={FIT_OPTIONS.map((item) => item.value === "el" ? { ...item, label: "Yoxlanılmayıb" } : item)} /></Field>
      <p className="spec-result-hint">{FIT_HINT[draft]}</p>
      {open.name === "Sınaq və sertifikat" && <Link className="btn ghost small" to="/anbar?tab=pasport">Material pasportuna keç</Link>}
      <div className="form-actions"><Button className="ghost" onClick={() => setSelected("")}>Ləğv et</Button><Button disabled={draft === open.fit} onClick={() => {writeFit(open.name,draft);setNotice(open.title + ": " + FIT_LABEL[draft]);setSelected("")}}>Nəticəni saxla</Button></div>
    </Modal>}
  </div>
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
      <Panel className="pad">
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
          <label>Təqdim günü<Input value={bondDay} onChange={(event) => patch((state) => ({ ...state, schedule: { ...state.schedule, bondDay: event.target.value } }))} placeholder="gün nömrəsi" /></label>
        </div>
        <div className="step-row"><span>İcra qarantiyası təqdim olunmalıdır</span><strong>{bondDay.trim() ? `${bondDay} gün` : "Gün yazılmayıb"}</strong></div>
        <div className="form-row wide">
          <label>İş<Input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Başlanğıc gün<Input value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>Bitmə gün<Input value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          <Button type="button" onClick={() => { if (!name.trim()) return; patch((state) => ({ ...state, schedule: { ...state.schedule, rows: [...state.schedule.rows, { id: uid(), name, start, end }] } })); setName(""); setStart(""); setEnd("") }}>Əlavə et</Button>
        </div>
        <div className="step-row"><span>Hava ehtiyatı</span><strong>{reserve} gün</strong></div>
        <TableContainer  style={{ marginTop: 14 }}>
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
        </TableContainer>
      </Panel>
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
  const { purchaseOrders } = useStore()
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState(emptyOffer)
  const [find, setFind] = useState("")
  const [category, setCategory] = useState("hamisi")
  const [vat, setVat] = useState("hamisi")
  const [compose, setCompose] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; name: string } | null>(null)
  const [desk, setDesk] = useState<"katalog" | "rfq" | "sifaris">("katalog")
  const [cart, setCart] = useState<MarketCartLine[]>([])
  const [rfqs, setRfqs] = useState<MarketRfq[]>([])
  const [orders, setOrders] = useState<MarketOrder[]>([])
  const [rfqForm, setRfqForm] = useState({ address: "Bakı sahəsi", needBy: "2026-11-01" })
  const [rfqError, setRfqError] = useState("")
  const [activeRfq, setActiveRfq] = useState<string | null>(null)

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

  useEffect(() => {
    api<{id:string;title:string;status:string;note:string;createdAt:string; supplier:{name:string}|null;lines:{id:string;name:string;unit:string;qty:string}[];bids:{id:string;unitPrice:string|null;qty:string|null;delivery:string|null;leadDays:number|null;quality:string;status:string;organization:{name:string}}[]}[]>("/api/platform/market/rfqs")
      .then((rows) => setRfqs(rows.map((row) => ({
        id:row.id,number:row.title,status:row.bids.some((bid) => bid.status === "secildi") ? "secilib" : row.bids.length ? "teklifler" : "gonderilib",
        address:row.note || "Ünvan göstərilməyib",needBy:"",createdAt:row.createdAt.slice(0,10),
        lines:row.lines.map((line) => ({productId:line.id,name:line.name,unit:line.unit,qty:Number(line.qty),supplier:row.supplier?.name || ""})),
        quotes:row.bids.filter((bid) => bid.unitPrice !== null).map((bid) => ({id:bid.id,supplier:bid.organization.name,unitPrice:Number(bid.unitPrice),deliveryDays:bid.leadDays || 0,vat:"unknown",qty:bid.qty == null ? undefined : Number(bid.qty),delivery:Number(bid.delivery || 0),note:bid.quality})),
        chosenQuoteId:row.bids.find((bid) => bid.status === "secildi")?.id,
      }))))
      .catch((reason) => setRfqError(reason instanceof ApiError ? reason.message : "RFQ məlumatları oxunmadı"))
  }, [])

  useEffect(() => {
    setOrders((current) => {
      const ids = new Set(purchaseOrders.map((item) => item.id))
      return [...current.filter((item) => !ids.has(item.id)), ...purchaseOrders.map((item): MarketOrder => ({
        id:item.id,number:item.id,rfqId:item.requestId || "",supplier:item.supplier,
        status:item.status === "qebul" ? "baglanib" : item.status === "yoldadir" ? "hazirlanir" : "tesdiq",
        lines:[{productId:item.materialId || item.id,name:item.item,unit:item.unit,qty:item.qty,supplier:item.supplier}],
        unitPrice:item.qty ? item.amount / item.qty : 0,deliveredQty:item.status === "qebul" ? item.qty : item.receivedQty || 0,receivedQty:item.receivedQty || 0,disputeQty:0,createdAt:item.eta,
      }))]
    })
  }, [purchaseOrders])

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

  function addToCart(item: (typeof market)[number]) {
    setCart((prev) => {
      const found = prev.find((row) => row.productId === item.id)
      if (found) return prev.map((row) => (row.productId === item.id ? { ...row, qty: row.qty + 1 } : row))
      return [...prev, { productId: item.id, name: item.name, unit: item.unit || "ədəd", supplier: item.source, qty: 1 }]
    })
    setDesk("rfq")
  }

  function submitRfq() {
    const created = openRfq(cart, rfqForm.address, rfqForm.needBy, rfqs)
    if (typeof created === "string") {
      setRfqError(created)
      return
    }
    const withQuotes = { ...created, status: "teklifler" as const, quotes: seedQuotes(created) }
    setRfqs((prev) => [withQuotes, ...prev])
    setActiveRfq(withQuotes.id)
    setCart([])
    setRfqError("")
  }

  const currentRfq = rfqs.find((item) => item.id === activeRfq) || rfqs[0]

  return (
    <div className="market-page">
      <PageHead kicker="Təchizat" title="Material bazarı" text="Kataloq → RFQ → təklif müqayisəsi → sifariş → qəbul. Məhsul ödənişi tərəflər arasındadır; platforma komissiya tarifi AÇIQ-dır, burada hesablanmır.">
        {desk === "katalog" && <Button type="button" onClick={openNew}><Icon name="plus" /> Yeni</Button>}
      </PageHead>
      <Toolbar>
        <Tabs
          value={desk}
          onChange={(next) => setDesk(next as typeof desk)}
          options={[
            { id: "katalog", label: "Kataloq" },
            { id: "rfq", label: `RFQ${cart.length || rfqs.length ? ` · ${cart.length || rfqs.length}` : ""}` },
            { id: "sifaris", label: `Sifariş${orders.length ? ` · ${orders.length}` : ""}` },
          ]}
        />
      </Toolbar>
      {desk === "rfq" && (
        <Panel className="pad">
          <h2>Qiymət sorğuları</h2>
          {rfqError && <p className="form-error" role="alert">{rfqError}</p>}
          <p className="muted">İctimai sabit qiymət və ani checkout yoxdur — yalnız qiymət sorğusu.</p>
          {cart.length === 0 && !rfqs.length && <Empty title="Səbət boşdur" text="Kataloqdan «RFQ-yə əlavə et» seçin." />}
          {cart.map((line) => (
            <p key={line.productId}>
              <b>{line.name}</b> · {num(line.qty, 0)} {line.unit}
              <Button type="button" className="ghost small" onClick={() => setCart((prev) => prev.filter((row) => row.productId !== line.productId))}>Sil</Button>
            </p>
          ))}
          {cart.length > 0 && (
            <>
              <Field label="Ünvan"><Input value={rfqForm.address} onChange={(event) => setRfqForm({ ...rfqForm, address: event.target.value })} /></Field>
              <Field label="Tələb tarixi"><DateField value={rfqForm.needBy} onChange={(value) => setRfqForm({ ...rfqForm, needBy: value })} /></Field>
              {rfqError && <p className="form-error">{rfqError}</p>}
              <Button type="button" onClick={submitRfq}>RFQ göndər</Button>
            </>
          )}
          {rfqs.length > 0 && (
            <>
              <h3>Açıq RFQ</h3>
              <Select
                value={currentRfq?.id || ""}
                onValueChange={setActiveRfq}
                options={rfqs.map((item) => ({ value: item.id, label: `${item.number} · ${{layihe:"Qaralama",gonderilib:"Göndərilib",teklifler:"Təkliflər var",secilib:"Təklif seçilib",baglanib:"Bağlanıb",legv:"Ləğv"}[item.status]}` }))}
              />
              {currentRfq && (
                <>
                  <p className="muted">{currentRfq.address}{currentRfq.needBy ? ` · ${currentRfq.needBy}` : ""} · {currentRfq.lines.length} sətir</p>
                  <TableContainer className="flat"><table><thead><tr><th>Məhsul</th><th>Miqdar</th><th>Vahid</th></tr></thead><tbody>{currentRfq.lines.map((line) => <tr key={line.productId}><td>{line.name}</td><td>{num(line.qty, 0)}</td><td>{line.unit}</td></tr>)}</tbody></table></TableContainer>
                  {!currentRfq.quotes.length && <p className="muted">Təchizatçı təklifləri gözlənilir.</p>}
                  {quoteCompareRows(currentRfq).map((quote) => (
                    <p key={quote.id}>
                      <b>{quote.supplier}</b> · {moneyAZ(quote.total)} · {quote.deliveryDays} gün · {quote.qty ?? currentRfq.lines.reduce((sum, line) => sum + line.qty, 0)} {currentRfq.lines[0]?.unit} · {quote.vat === "unknown" ? "ƏDV göstərilməyib" : `ƏDV ${quote.vat}`}
                      {quote.chosen ? " · seçilib" : (
                        <Button
                          type="button"
                          className="ghost small"
                          onClick={() => {
                            const next = chooseQuote(currentRfq, quote.id)
                            if (typeof next === "string") { setRfqError(next); return }
                            setRfqs((prev) => prev.map((item) => (item.id === next.id ? next : item)))
                          }}
                        >
                          Seç
                        </Button>
                      )}
                    </p>
                  ))}
                  {currentRfq.status === "secilib" && (
                    <Button
                      type="button"

                      onClick={() => {
                        const order = orderFromRfq(currentRfq, orders)
                        if (typeof order === "string") { setRfqError(order); return }
                        setOrders((prev) => [order, ...prev])
                        setRfqs((prev) => prev.map((item) => (item.id === currentRfq.id ? { ...item, status: "baglanib" } : item)))
                        setDesk("sifaris")
                      }}
                    >
                      Sifariş yarat
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </Panel>
      )}
      {desk === "sifaris" && (
        <Panel className="pad">
          <h2>Sifariş və qəbul</h2>
          {orders.length === 0 && <Empty title="Sifariş yoxdur" text="RFQ-dən təklif seçib sifariş açın." />}
          {orders.map((order) => {
            const total = order.lines.reduce((sum, line) => sum + line.qty, 0)
            return (
              <Panel as="div" key={order.id} className="pad">
                <p><b>{order.number}</b> · {order.supplier} · <span className={`market-order-status market-order-${order.status}`}>{{yaradilib:"Yeni",tesdiq:"Təsdiqlənib",hazirlanir:"Çatdırılma gözlənilir",catdirilib:"Çatdırılıb",qebul:"Qəbulda",baglanib:"Qəbul tamamlanıb"}[order.status]}</span></p>
                <p>{order.lines.map((line) => `${line.name} · ${num(line.qty, 0)} ${line.unit}`).join(", ")}</p>
                <p className="muted">Çatdırılıb {num(order.deliveredQty, 0)} / {num(total, 0)} · qəbul {num(order.receivedQty, 0)} · mübahisə {num(order.disputeQty, 0)}</p>
                <div className="form-actions">
                  {order.status !== "baglanib" && order.deliveredQty < total && (
                    <Button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        const next = deliverOrder(order, Math.max(1, total - order.deliveredQty))
                        if (typeof next === "string") return
                        setOrders((prev) => prev.map((item) => (item.id === order.id ? next : item)))
                      }}
                    >
                      Çatdırılma yaz
                    </Button>
                  )}
                  {order.deliveredQty > order.receivedQty + order.disputeQty && (
                    <Button
                      type="button"

                      onClick={() => {
                        const left = order.deliveredQty - order.receivedQty - order.disputeQty
                        const accept = Math.max(0, left - (left > 5 ? 5 : 0))
                        const dispute = left - accept
                        const next = receiveOrder(order, accept, dispute)
                        if (typeof next === "string") return
                        setOrders((prev) => prev.map((item) => (item.id === order.id ? next : item)))
                      }}
                    >
                      Qəbul et
                    </Button>
                  )}
                </div>
              </Panel>
            )
          })}
        </Panel>
      )}
      {desk === "katalog" && (
      <>
      <StatGrid>
        <Metric>
          <span>Məhsul</span>
          <strong>{market.length}</strong>
          <em>Kataloq sətri</em>
        </Metric>
        <Metric>
          <span>Təchizatçı</span>
          <strong>{suppliers}</strong>
          <em>Şirkət sayı</em>
        </Metric>
        <Metric>
          <span>Canlı qiymət</span>
          <strong>{live}</strong>
          <em>Qüvvədə olan</em>
        </Metric>
        <Metric>
          <span>Diqqət</span>
          <strong>{attention}</strong>
          <em className={attention ? "warn" : undefined}>{attention ? "Bitib və ya 30 günə bitir" : "Yaxın bitmə yoxdur"}</em>
        </Metric>
      </StatGrid>
      <Toolbar className="market-toolbar">
        <SearchInput value={find} onChange={(event) => setFind(event.target.value)} placeholder="Məhsul, təchizatçı, region" aria-label="Bazarda axtar" />
        <div className="market-filters">
          <Select
            value={category}
            onValueChange={setCategory}
            ariaLabel="Kateqoriya"
            options={[{ value: "hamisi", label: "Bütün kateqoriyalar" }, ...categories.map((item) => ({ value: item, label: item }))]}
          />
          <Select ariaLabel="ƏDV filtri" value={vat} onValueChange={setVat} options={[{value:"hamisi",label:"ƏDV: hamısı"},{value:"xaric",label:"ƏDV xaric"},{value:"daxil",label:"ƏDV daxil"}]} />
        </div>
      </Toolbar>
      {!ready && <p className="lede">Kataloq oxunur.</p>}
      {ready && market.length === 0 && <Empty title="Kataloq boşdur" text="Yeni düyməsi ilə məhsul yazın. Sətir cədvələ düşəcək." />}
      {ready && market.length > 0 && shown.length === 0 && <Empty title="Bu süzgəcə düşən məhsul yoxdur" text="Axtarışı, kateqoriyanı və ya ƏDV süzgəcini dəyişin." />}
      {shown.length > 0 && (
        <>
          <p className="market-count">{shown.length} məhsul{shown.length !== market.length ? ` · ${market.length} içindən` : ""}</p>
          <TableContainer className="pricebook">
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
                            { id: "rfq", label: "RFQ-yə əlavə et", onClick: () => addToCart(item) },
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
          </TableContainer>
        </>
      )}
      </>
      )}
      {compose && (
        <Modal wide className="market-modal" title={editing ? "Sətri düzəlt" : "Yeni sətir"} onClose={() => { setCompose(false); setEditing(null) }}>
          <div className="market-fields">
            <label className="span-2">Məhsul<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="məsələn, Portland sement CEM II" /></label>
            <label>Kateqoriya<Select value={form.category} onValueChange={(next) => setForm({ ...form, category: next })} options={formCategories.map((item) => ({ value: item, label: item }))} /></label>
            <label>Vahid<Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="ton, m³, ədəd" /></label>
            <label>Alış qiyməti<Input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} inputMode="decimal" placeholder="0,00" /></label>
            <label>ƏDV<Select value={form.vat} onValueChange={(next) => setForm({ ...form, vat: next })} options={[{ value: "xaric", label: "Xaric" }, { value: "daxil", label: "Daxil" }]} /></label>
            <label>Təchizatçı<Input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label>
            <label>Region<Input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></label>
            <label>Çatdırılma<Input value={form.delivery} onChange={(event) => setForm({ ...form, delivery: event.target.value })} placeholder="anbar və ya ünvan" /></label>
            <label>Tarix<Input type="date" value={form.updated} onChange={(event) => setForm({ ...form, updated: event.target.value })} /></label>
            <label>Qüvvədədir<Input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label>
          </div>
          <div className="form-actions">
            <Button type="button" className="ghost" onClick={() => { setCompose(false); setEditing(null) }}>Ləğv et</Button>
            <Button type="button" disabled={!form.name.trim()} onClick={save}>{editing ? "Saxla" : "Əlavə et"}</Button>
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
            <Button type="button" className="ghost" onClick={() => setViewId(null)}>Bağla</Button>
            <Button type="button" className="ghost" onClick={() => { addToCart(viewed); setViewId(null) }}>RFQ-yə əlavə et</Button>
            <Button type="button" onClick={() => { setViewId(null); openEdit(viewed) }}>Düzəlt</Button>
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
      <Panel className="pad">
        <div className="form-row wide">
          <label>En, mm<Input value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })} /></label>
          <label>Hündürlük, mm<Input value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} /></label>
          <label>Say<Input value={form.count} onChange={(event) => setForm({ ...form, count: event.target.value })} /></label>
          <label>Alış, AZN/kq<Input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label>ƏDV<Select value={form.vat} onValueChange={(vat) => setForm({ ...form, vat })} options={[{ value: "xaric", label: "Xaric" }, { value: "daxil", label: "Daxil" }]} /></label>
          <label>İtki, %<Input value={form.waste} onChange={(event) => setForm({ ...form, waste: event.target.value })} /></label>
        </div>
        <div className="step-row"><span>Şüşə sahəsi</span><strong>{glass ? `${glass.toFixed(2)} m²` : "Ölçü yoxdur"}</strong></div>
        <div className="step-row"><span>İtki ilə sahə</span><strong>{glass ? `${glassWithWaste.toFixed(2)} m²${wasteOn ? ` · itki ${form.waste}%` : " · itki yazılmayıb"}` : "Ölçü yoxdur"}</strong></div>
        <div className="step-row"><span>Profil kilosu</span><strong>İstehsalçı təsdiqi yoxdur</strong></div>
        <div className="step-row"><span>Alış qiyməti</span><strong>{form.price || "—"} AZN/kq · ƏDV {form.vat}</strong></div>
      </Panel>
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

  const [view, setView] = useState("overview")
  return (
    <div className="finance-simple cashflow-workspace">
      <PageHead title="Pul axını" text="Mənbələri, smeta xərclərini və planlaşdırılan qalığı izləyin." />
      <StatGrid><Metric><span>Mənbələr</span><strong>{moneyShort(inflow)}</strong><em>Daxilolma, avans, öz vəsait və kredit</em></Metric><Metric><span>Çıxış</span><strong>{moneyShort(outflow)}</strong><em>Smeta və təsdiqli zəmanət</em></Metric><Metric><span>Qalıq</span><strong className={inflow-outflow < 0 ? "out" : "in"}>{moneyShort(inflow-outflow)}</strong><em>Mənbələrdən çıxış çıxıldıqdan sonra</em></Metric></StatGrid>
      <Tabs value={view} onChange={setView} options={[{id:"overview",label:"İcmal"},{id:"sources",label:"Mənbələr"},{id:"plan",label:"30 / 60 / 90 gün"}]} />
      {view === "overview" && <div className="cashflow-columns">
        <Panel className="pad"><SectionHeader><h2>Mənbələrin bölgüsü</h2><Button className="ghost small" onClick={() => setView("sources")}>Redaktə et</Button></SectionHeader><dl className="finance-breakdown">{[["Daxilolma",sources.inflow],["Avans",sources.advance],["Öz vəsait",sources.equity],["Kredit",sources.loan]].map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{money(Number(value)||0)} AZN</dd></div>)}</dl></Panel>
        <Panel className="pad"><SectionHeader><h2>Xərclərin bölgüsü</h2><Link to="/boq">BOQ</Link></SectionHeader><dl className="finance-breakdown">{rows.filter(([name]) => ["Ölçülmüş iş","Dolayı xərc","Üstəlik","Əlavə xərc","Təsdiqli zəmanət"].includes(name)).map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{money(value)} AZN</dd></div>)}</dl><Disclosure title="Mənfəət və vergi"><dl className="finance-breakdown">{rows.filter(([name]) => name === "Mənfəət" || name === "Vergi").map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{money(value)} AZN</dd></div>)}</dl><p className="muted">Bu göstəricilər çıxış cəminə daxil deyil.</p></Disclosure></Panel>
      </div>}
      {view === "sources" && <Panel className="pad"><h2 className="block-title">Maliyyə mənbələri</h2><p className="lede">Məbləğ dəyişdikcə yuxarıdakı yekunlar yenilənir.</p><div className="finance-form-grid">{[{key:"inflow" as const,label:"Daxilolma"},{key:"advance" as const,label:"Avans"},{key:"equity" as const,label:"Öz vəsait"},{key:"loan" as const,label:"Kredit"}].map((item) => <label key={item.key}>{item.label}, AZN<Input inputMode="decimal" value={sources[item.key]} onChange={(event) => setCash(item.key,event.target.value)} placeholder="0" /></label>)}</div></Panel>}
      {view === "plan" && <Panel className="pad"><h2 className="block-title">Planlaşdırılan məbləğlər</h2><p className="lede">Dövr üzrə plan ayrıca saxlanılır və mənbələr cəminə əlavə edilmir.</p><div className="finance-form-grid">{[{key:"days30" as const,label:"30 gün"},{key:"days60" as const,label:"60 gün"},{key:"days90" as const,label:"90 gün"}].map((item) => <label key={item.key}>{item.label}, AZN<Input inputMode="decimal" value={sources[item.key]} onChange={(event) => setCash(item.key,event.target.value)} placeholder="Yazılmayıb" /></label>)}</div></Panel>}
    </div>
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
  const [compose, setCompose] = useState(false)

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
      setCompose(false)
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

  return <div className="finance-simple cooperation-workspace">
    <PageHead title="Əməkdaşlıq" text="Sorğuları və nəticələri bir yerdə izləyin."><Button onClick={() => {setError("");setCompose(true)}}><Icon name="plus" />Yeni sorğu</Button></PageHead>
    <Panel className="employment-summary">{[{icon:"files" as const,label:"Bütün sorğular",value:rows.length},{icon:"clock" as const,label:"Təhlildə",value:open},{icon:"check" as const,label:"Razılaşıb",value:agreed},{icon:"close" as const,label:"Dayanıb",value:held}].map((item) => <div key={item.label}><Icon name={item.icon} /><div><strong>{item.value}</strong><span>{item.label}</span></div></div>)}</Panel>
    <Toolbar className="finance-list-toolbar"><SearchInput value={find} onChange={(event) => setFind(event.target.value)} placeholder="Şirkət, məsul və ya nəticə axtar" /><Select ariaLabel="Əməkdaşlıq statusu" value={filter} onValueChange={setFilter} options={[{value:"hamisi",label:"Bütün statuslar"},{value:"tehlil",label:"Təhlil olunur"},{value:"netice",label:"Nəticə yazılıb"},{value:"razi",label:"Razılaşıb"},{value:"dayanib",label:"Dayanıb"}]} /></Toolbar>
    {error && !compose && !selected && <p className="form-error" role="alert">{error}</p>}{message && <p className="lede" role="status">{message}</p>}
    <TableContainer className="finance-records-table"><table><thead><tr><th>Şirkət</th><th>Modul</th><th>Məsul</th><th>Status</th><th>Tarix</th><th><span className="sr-only">Sorğunu aç</span></th></tr></thead><tbody>{shown.map((row) => <tr key={row.id} tabIndex={0} onClick={() => {setError("");setFinding({...finding,id:row.id})}} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setFinding({...finding,id:row.id})}}}><td><strong>{row.company}</strong><small>{row.note || "Sorğu mətni yazılmayıb"}</small></td><td>{row.module || "—"}</td><td>{row.owner || "—"}</td><td><span className={`badge ${coopTone(row.status)}`}>{row.status || "Təhlil olunur"}</span></td><td>{coopWhen(row.createdAt) || "—"}</td><td><Icon name="chevron" /></td></tr>)}</tbody></table>{!shown.length && <Empty title={ready ? "Sorğu tapılmadı" : "Sorğular oxunur"} text="Axtarışı dəyişin və ya yeni sorğu əlavə edin." />}</TableContainer>
    {compose && <Modal title="Yeni əməkdaşlıq sorğusu" className="finance-record-modal" onClose={() => {if(!busy)setCompose(false)}}><form onSubmit={(event) => {event.preventDefault();void accept()}}><div className="finance-form-grid"><label className="full">Şirkət<Input required value={form.company} onChange={(event) => setForm({...form,company:event.target.value})} /></label><label>Modul<Select value={form.module} onValueChange={(module) => setForm({...form,module})} options={COOP_MODULES.map((item) => ({value:item,label:item}))} /></label><label>Məsul<Input value={form.owner} onChange={(event) => setForm({...form,owner:event.target.value})} /></label><label className="full">Sorğu<Textarea value={form.note} onChange={(event) => setForm({...form,note:event.target.value})} rows={4} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button className="ghost" disabled={busy} onClick={() => setCompose(false)}>Ləğv et</Button><Button type="submit" disabled={busy || !form.company.trim()}>{busy ? "Saxlanılır…" : "Sorğunu saxla"}</Button></div></form></Modal>}
    {selected && <Modal title={selected.company} className="coop-detail-modal" onClose={() => {if(!busy)setFinding({...finding,id:""})}}><div className="coop-detail-meta"><span className={`badge ${coopTone(selected.status)}`}>{selected.status}</span><span>{selected.module || "Modul yazılmayıb"}</span><span>{selected.owner || "Məsul yazılmayıb"}</span></div><p className="coop-request-text">{selected.note || "Sorğu mətni yazılmayıb"}</p>{selected.result && <p className="coop-result-text">{selected.result}</p>}<h3>Tapıntılar · {selected.findings.length}</h3><div className="coop-findings">{selected.findings.map((item) => <article key={item.id}><strong>{item.topic}</strong><p>{item.finding}</p><small>{coopWhen(item.createdAt)}</small></article>)}{!selected.findings.length && <p className="muted">Hələ tapıntı əlavə edilməyib.</p>}</div><Disclosure title="Tapıntı əlavə et"><form onSubmit={(event) => {event.preventDefault();void writeFinding()}}><div className="finance-form-grid"><label>Mövzu<Input value={finding.topic} onChange={(event) => setFinding({...finding,topic:event.target.value})} /></label><label>Status<Select value={finding.status} onValueChange={(status) => setFinding({...finding,status})} options={COOP_STATUSES.map((item) => ({value:item,label:item}))} /></label><label className="full">Nəticə<Textarea required value={finding.text} onChange={(event) => setFinding({...finding,text:event.target.value})} rows={3} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy || !finding.text.trim()}>{busy ? "Saxlanılır…" : "Tapıntını saxla"}</Button></div></form></Disclosure></Modal>}
  </div>
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
  const [view, setView] = useState("packages")
  const [selectedId, setSelectedId] = useState("")
  const [busy, setBusy] = useState(false)

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
    if(busy) return
    setBusy(true)
    try {
      await api("/api/platform/subscription", { method: "POST", body: JSON.stringify({ packageId: id, months }) })
      await load()
      setSelectedId("")
      setNote("Paket seçildi və müddət başladı. Ödəniş sənədi qeyd olunmayana qədər bağlı modul açılmır. Kartla pul tutulmur.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Paket seçilmədi")
    } finally {setBusy(false)}
  }

  async function pay() {
    if(busy) return
    const pack = state?.package
    if (!pack) {
      setNote("Əvvəlcə paket seçilməlidir.")
      return
    }
    setBusy(true)
    try {
      await api("/api/platform/subscription/payment", {
        method: "POST",
        body: JSON.stringify({ months, amount: Number(pack.amount) || 0, invoice: invoice || "Əl ilə ödəniş sənədi" }),
      })
      await load()
      setNote("Ödəniş sənəd kimi qeyd olundu. Müddət başladı.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Ödəniş qeyd olunmadı")
    } finally {setBusy(false)}
  }

  const selected = packs.find((item) => item.id === selectedId)
  const expired = state?.daysLeft != null && state.daysLeft < 0
  const statusText = expired || state?.status === "bitib" ? "Müddəti bitib" : state?.status === "aktiv" ? "Aktiv" : "Ödəniş gözləyir"
  const monthOptions = [{value:"1",label:"1 ay"},{value:"3",label:"3 ay"},{value:"6",label:"6 ay"},{value:"12",label:"12 ay"}]
  return <div className="finance-simple subscription-workspace">
    <PageHead title="Abunə" text="Paket və istifadə müddətini idarə edin." />
    <Panel className="subscription-current"><div className="subscription-plan"><span className="subscription-symbol"><Icon name="layers" /></span><div><span>Cari paket</span><h2>{state?.package?.name || "Paket seçilməyib"}</h2><span className={`badge ${expired ? "rose" : state?.status === "aktiv" ? "pine" : "gold"}`}>{statusText}</span></div></div><div><span>Bitmə tarixi</span><strong>{state?.endsOn ? dateAZ(state.endsOn.slice(0,10)) : "—"}</strong></div><div><span>Qalan müddət</span><strong>{state?.daysLeft == null ? "—" : `${Math.max(0,state.daysLeft)} gün`}</strong></div></Panel>
    {state?.warn && <p className="form-error">Abunə {state.daysLeft} günə bitir.</p>}
    {state && state.locked.length > 0 && <Disclosure title={`Bağlı modullar · ${state.locked.length}`}><p className="muted">{state.locked.join(", ")}</p></Disclosure>}
    {note && !selected && <p className="lede" role="status">{note}</p>}
    <Tabs value={view} onChange={setView} options={[{id:"packages",label:"Paketlər"},{id:"payment",label:"Ödəniş sənədi"}]} />
    {view === "packages" ? <TableContainer className="finance-records-table subscription-packages"><table><thead><tr><th>Paket</th><th>Məbləğ</th><th>İstifadəçi</th><th>Layihə</th><th><span className="sr-only">Paketə bax</span></th></tr></thead><tbody>{packs.map((pack) => <tr key={pack.id} tabIndex={0} onClick={() => {setNote("");setSelectedId(pack.id)}} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setSelectedId(pack.id)}}}><td><strong>{pack.name}</strong>{state?.package?.id === pack.id && <small><span className="badge pine">Cari paket</span></small>}</td><td>{pack.amount == null ? "Məbləğ göstərilməyib" : `${money(Number(pack.amount)||0)} AZN`}</td><td>{pack.userLimit ?? "Limitsiz"}</td><td>{pack.smetaLimit ?? "Limitsiz"}</td><td><Button className="ghost small" onClick={(event) => {event.stopPropagation();setNote("");setSelectedId(pack.id)}}>Ətraflı</Button></td></tr>)}</tbody></table>{!packs.length && <Empty title="Paketlər oxunur" text="Mövcud paketlər burada göstəriləcək." />}</TableContainer> : <Panel className="pad subscription-payment"><h2>Ödəniş sənədi</h2><p className="lede">Ödəniş sənəd kimi qeydə alınır. Kartdan pul tutulmur.</p><form onSubmit={(event) => {event.preventDefault();void pay()}}><div className="finance-form-grid"><label>Cari paket<Input readOnly value={state?.package?.name || "Paket seçilməyib"} /></label><label>Müddət<Select ariaLabel="Ödəniş müddəti" value={months} onValueChange={setMonths} options={monthOptions} /></label><label className="full">Sənəd və ya qəbz nömrəsi<Input value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="Qaimə və ya qəbz nömrəsi" /></label></div><div className="form-actions"><Button type="submit" disabled={busy || !state?.package}>{busy ? "Saxlanılır…" : "Ödənişi qeyd et"}</Button></div></form></Panel>}
    {selected && <Modal title={selected.name} className="subscription-package-modal" onClose={() => {if(!busy)setSelectedId("")}}><div className="subscription-package-price"><strong>{selected.amount == null ? "Məbləğ göstərilməyib" : `${money(Number(selected.amount)||0)} AZN`}</strong><span>Paket məbləği</span></div><h3>Paketə daxildir</h3><p className="subscription-features">{selected.features}</p><dl className="finance-breakdown"><div><dt>İstifadəçi limiti</dt><dd>{selected.userLimit ?? "Limitsiz"}</dd></div><div><dt>Layihə limiti</dt><dd>{selected.smetaLimit ?? "Limitsiz"}</dd></div></dl><label className="finance-status-edit">Abunəlik müddəti<Select value={months} onValueChange={setMonths} options={monthOptions} /></label><p className="tax-form-hint">Paket seçimi ödəniş sənədi qeyd olunana qədər gözləmə vəziyyətində qalır.</p>{note && <p className="form-error" role="alert">{note}</p>}<div className="form-actions"><Button className="ghost" disabled={busy} onClick={() => setSelectedId("")}>Bağla</Button><Button disabled={busy} onClick={() => void choose(selected.id)}>{busy ? "Saxlanılır…" : "Seçimi təsdiqlə"}</Button></div></Modal>}
  </div>
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

export function PassportPage({ embedded = false, materialFilter = "" }: { embedded?: boolean; materialFilter?: string }) {
  useTitle(embedded ? "Anbar" : "Pasport")
  const { passports } = useWorkspace()
  const { materials } = useStore()
  const [form, setForm] = useState(() => ({ ...emptyPassport, material: materialFilter }))
  const [materialId, setMaterialId] = useState(() => materials.find((item) => item.name === materialFilter)?.id || "")
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [find, setFind] = useState(materialFilter)
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
      {!embedded && (
        <PageHead kicker="Keyfiyyət" title="Material pasportu" text="Hər kart bazada saxlanan material sənədidir. Boş sahə «yazılmayıb» kimi durur, ona görə formadakı boş xanalar məlumat sayılmır." />
      )}
      {embedded && (
        <p className="lede">Material pasportu və sertifikatlar anbar kartındadır. Boş sahə «yazılmayıb» sayılır.</p>
      )}
      <StatGrid>
        <Metric>
          <span>Pasport</span>
          <strong>{passports.length}</strong>
          <em>Bazadakı kart</em>
        </Metric>
        <Metric>
          <span>Tam kart</span>
          <strong>{complete}</strong>
          <em>8 sahənin hamısı yazılıb</em>
        </Metric>
        <Metric>
          <span>Çatışmayan</span>
          <strong>{passports.length - complete}</strong>
          <em className={passports.length - complete ? "warn" : undefined}>Sertifikat və ya sınaq boşdur</em>
        </Metric>
        <Metric>
          <span>30 günə bitən</span>
          <strong>{expiring}</strong>
          <em className={expiring ? "warn" : undefined}>Müddəti yaxınlaşan</em>
        </Metric>
      </StatGrid>
      <Toolbar>
        <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="search" />
          <Input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Material, partiya, sertifikat" aria-label="Pasportda axtar" />
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
      </Toolbar>
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
      <Panel className="pad passport-form">
        <h2>Yeni pasport</h2>
        <p className="lede">Bu forma hələ məlumat deyil. Saxlayanda kart yuxarıdakı siyahıya düşür.</p>
        <div className="form-row wide">
          {materials.length > 0 && (
            <label>Anbar kartı
              <Select
                value={materialId}
                onValueChange={(id) => {
                  setMaterialId(id)
                  const row = materials.find((item) => item.id === id)
                  if (row) setForm((current) => ({ ...current, material: row.name }))
                }}
                options={[{ value: "", label: "Kataloqdan seç" }, ...materials.map((item) => ({ value: item.id, label: item.name }))]}
              />
            </label>
          )}
          <label>Material<Input value={form.material} onChange={(event) => { setMaterialId(""); setForm({ ...form, material: event.target.value }) }} placeholder="məsələn, Armatur A500 Ø16" /></label>
          <label>İstehsalçı<Input value={form.maker} onChange={(event) => setForm({ ...form, maker: event.target.value })} /></label>
          <label>Standart<Input value={form.standard} onChange={(event) => setForm({ ...form, standard: event.target.value })} /></label>
          <label>Sertifikat nömrəsi<Input value={form.certificate} onChange={(event) => setForm({ ...form, certificate: event.target.value })} /></label>
          <label>Verən<Input value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.target.value })} /></label>
          <label>Qüvvədədir<Input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label>
          <label>Partiya<Input value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} /></label>
          <label>Mənşə<Input value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} /></label>
          <label>Sınaq protokolu<Input value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value })} /></label>
          <label>Bölmə<Select value={form.section} onValueChange={(section) => setForm({ ...form, section })} options={SPEC_SECTIONS.map((item) => ({ value: item, label: item }))} /></label>
          <label>Nəticə<Select value={form.fit} onValueChange={(fit) => setForm({ ...form, fit: fit as Fit })} options={(Object.keys(FIT_LABEL) as Fit[]).map((key) => ({ value: key, label: FIT_LABEL[key] }))} /></label>
          <Button type="button" disabled={busy || !form.material.trim()} onClick={() => void add()}>{busy ? "Saxlanır" : "Bazaya yaz"}</Button>
        </div>
      </Panel>
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
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState("all")
  const [compose, setCompose] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {loadPartners().catch((reason) => setNote(reason instanceof ApiError ? reason.message : "Reyestr oxunmadı"))}, [])
  const shown = partners.map(filledPartner).filter((row) => (kind === "all" || row.kind === kind) && `${row.name} ${row.note} ${row.kind}`.toLocaleLowerCase("az").includes(query.trim().toLocaleLowerCase("az")))
  function openPartner(row?: Partner) {setForm(row ? {...emptyPartner,...filledPartner(row)} : emptyPartner);setEditing(row?.id || null);setError("");setCompose(true)}
  async function savePartner() {
    if(busy || !form.name.trim()) return
    setBusy(true)
    try {
      await api(editing ? `/api/platform/finance/partners/${editing}` : "/api/platform/finance/partners", {method:editing ? "PATCH" : "POST",body:JSON.stringify({...form,kind:PARTNER_CODE[form.kind] || "bank"})})
      await loadPartners();setCompose(false);setNote("Tərəfdaş kartı saxlanıldı.")
    } catch(reason) {setError(reason instanceof ApiError ? reason.message : "Kart saxlanmadı")} finally {setBusy(false)}
  }
  return <div className="finance-simple registry-workspace">
    <PageHead title="Tərəfdaşlar" text="Bank, sığorta və digər maliyyə tərəfdaşlarının vahid reyestri."><Button onClick={() => openPartner()}><Icon name="plus" />Yeni tərəfdaş</Button></PageHead>
    <p className="finance-list-count">{partners.length} tərəfdaş · {partners.filter((row) => row.kind === "Bank").length} bank · {partners.filter((row) => row.kind === "Sığorta").length} sığortaçı</p>
    <Toolbar className="finance-list-toolbar"><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tərəfdaş axtar" /><Select ariaLabel="Tərəfdaş növü" value={kind} onValueChange={setKind} options={[{value:"all",label:"Bütün növlər"},...PARTNER_KINDS.map((item) => ({value:item,label:item}))]} /></Toolbar>
    {note && <p className="lede" role="status">{note}</p>}
    <TableContainer className="finance-records-table"><table><thead><tr><th>Tərəfdaş</th><th>Növ</th><th>Komissiya</th><th>Güzəşt</th><th>Status</th><th><span className="sr-only">Kartı aç</span></th></tr></thead><tbody>{shown.map((row) => {const tone=bankTone(row);return <tr key={row.id} tabIndex={0} onClick={() => openPartner(row)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();openPartner(row)}}}><td><strong>{row.name}</strong><small>{row.note || "Qeyd yoxdur"}</small></td><td><span className="badge stone">{row.kind}</span></td><td>{row.commission ? `${row.commission}%` : "—"}</td><td>{row.discount ? `${row.discount}%` : "—"}</td><td><span className={`badge bank ${tone.color}`}>{tone.word}</span></td><td><Icon name="chevron" /></td></tr>})}</tbody></table>{!shown.length && <Empty title="Tərəfdaş tapılmadı" text="Axtarışı dəyişin və ya yeni tərəfdaş əlavə edin." />}</TableContainer>
    {compose && <Modal title={editing ? form.name : "Yeni tərəfdaş"} className="finance-record-modal" onClose={() => {if(!busy)setCompose(false)}}><form onSubmit={(event) => {event.preventDefault();void savePartner()}}><div className="finance-form-grid">
      <label>Növ<Select value={form.kind} onValueChange={(kind) => setForm({...form,kind})} options={PARTNER_KINDS.map((item) => ({value:item,label:item}))} disabled={!!editing} /></label><label>Ad<Input required value={form.name} onChange={(event) => setForm({...form,name:event.target.value})} /></label><label className="full">Qeyd<Textarea value={form.note} onChange={(event) => setForm({...form,note:event.target.value})} rows={3} /></label>
    </div><Disclosure title="Təsdiq və bank şərtləri"><div className="finance-form-grid"><label>Komissiya, %<Input value={form.commission} onChange={(event) => setForm({...form,commission:event.target.value})} /></label><label>Güzəşt, %<Input value={form.discount} onChange={(event) => setForm({...form,discount:event.target.value})} /></label><label>Status<Select value={form.light} onValueChange={(light) => setForm({...form,light:light as Partner["light"]})} options={[{value:"gozleme",label:"Gözləmə"},{value:"tesdiq",label:"Təsdiq"},{value:"legv",label:"Ləğv"}]} /></label><label>Sənəd tarixi<Input type="date" value={form.proofDate} onChange={(event) => setForm({...form,proofDate:event.target.value})} /></label><label className="full">Təsdiq sənədi<Input value={form.proof} onChange={(event) => setForm({...form,proof:event.target.value})} /></label><label className="full">Loqo ünvanı<Input value={form.logo} onChange={(event) => setForm({...form,logo:event.target.value})} /></label></div><p className="muted">Təsdiq statusu üçün sənəd və tarix tələb olunur. Bank kanalı sənəd mübadiləsi ilə işləyir.</p></Disclosure>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button className="ghost" disabled={busy} onClick={() => setCompose(false)}>Bağla</Button><Button type="submit" disabled={busy}>{busy ? "Saxlanılır…" : "Kartı saxla"}</Button></div></form></Modal>}
  </div>
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
        <Textarea
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
  const [detail, setDetail] = useState(false)
  const [studioTab, setStudioTab] = useState("edit")
  const [busy, setBusy] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  usePageTransition(pageRef, detail ? "detail" : "list", true)

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
    setDetail(true)
    setStudioTab("edit")
    setNote("")
    setEditingId(row.id)
    setOwned(Boolean(row.organizationId))
    setMeta({version:row.version || "1.0",legal:legalLabel(row.legal)})
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
    setDetail(true)
    setStudioTab("edit")
    setNote("")
    setEditingId("")
    setOwned(false)
    setRendered("")
    setForm(emptyTemplate)
    setMeta({version:emptyTemplate.version,legal:emptyTemplate.legal})
  }

  useEffect(() => {
    api<TemplateRow[]>("/api/platform/templates")
      .then(setRows)
      .catch((reason) => setNote(reason instanceof ApiError ? reason.message : "Şablonlar oxunmadı"))
  }, [])


  const liveFields: Record<string, string> = {
    sirket: cabinet.name,
    voen: cabinet.voen,
    unvan: cabinet.legalAddress,
    ...fields,
  }
  const liveText = fillLocal(form.body, liveFields)
  const paper = rendered || liveText

  async function save() {
    if (busy || !form.name.trim()) return
    setBusy(true)
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
    } finally {setBusy(false)}
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

  return <div className="finance-simple templates-workspace" ref={pageRef}>
    {detail && <Button className="ghost template-back" onClick={() => setDetail(false)}>Şablonlara qayıt</Button>}
    <PageHead title={detail ? form.name || "Yeni şablon" : "Hüquqi şablonlar"} text={detail ? "Mətni redaktə edin, məlumatları doldurun və sənədi hazırlayın." : "Müqavilə, akt, zəmanət və sifariş mətnlərini idarə edin."}>{detail ? <Button disabled={busy || !form.name.trim()} onClick={() => void save()}>{busy ? "Saxlanılır…" : owned ? "Dəyişiklikləri saxla" : editingId ? "Nüsxə saxla" : "Şablonu saxla"}</Button> : <Button onClick={startNew}><Icon name="plus" />Yeni şablon</Button>}</PageHead>
    {note && <p className="lede" role="status">{note}</p>}
    {!detail ? <>
      <Panel className="employment-summary">{[{icon:"files" as const,label:"Bütün şablonlar",value:library.length},{icon:"check" as const,label:"Baxılıb",value:reviewed},{icon:"clock" as const,label:"Gözləyir",value:waiting},{icon:"close" as const,label:"Geri qaytarılıb",value:returned}].map((item) => <div key={item.label}><Icon name={item.icon} /><div><strong>{item.value}</strong><span>{item.label}</span></div></div>)}</Panel>
      <Toolbar className="finance-list-toolbar"><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad, tərəf və ya mətn axtar" /><Select ariaLabel="Şablon növü" value={kindFilter} onValueChange={setKindFilter} options={[{value:"hamisi",label:"Bütün növlər"},...TEMPLATE_KINDS.map((item) => ({value:item,label:item}))]} /></Toolbar>
      <TableContainer className="finance-records-table template-library-table"><table><thead><tr><th>Şablon</th><th>Növ</th><th>Versiya</th><th>Hüquq yoxlaması</th><th>Tarix</th><th><span className="sr-only">Şablonu aç</span></th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} tabIndex={0} onClick={() => openRow(row)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();openRow(row)}}}><td><strong>{row.name}</strong><small>{templateExcerpt(row.body)}</small></td><td><span className={`badge ${kindTone(row.kind)}`}>{kindLabel(row.kind)}</span></td><td>v.{row.version || "—"}</td><td><span className={`badge ${legalTone(row.legal)}`}>{legalLabel(row.legal)}</span></td><td>{row.updatedOn ? dateAZ(row.updatedOn.slice(0,10)) : "—"}</td><td><Icon name="chevron" /></td></tr>)}</tbody></table>{!filtered.length && <Empty title="Şablon tapılmadı" text="Axtarışı və ya növ filtrini dəyişin." />}</TableContainer>
    </> : <>
      <div className="template-context"><span className={`badge ${kindTone(form.kind)}`}>{form.kind}</span><span className={`badge ${legalTone(form.legal)}`}>{form.legal}</span><span>{owned ? "Şirkət şablonu" : editingId ? "Ümumi kitabxana · dəyişikliklər nüsxə kimi saxlanır" : "Yeni şablon"}</span></div>
      <Tabs value={studioTab} onChange={setStudioTab} options={[{id:"edit",label:"Mətn"},{id:"fill",label:"Sənədi doldur"},{id:"preview",label:"Önizləmə"}]} />
      <Panel className="pad template-editor" hidden={studioTab !== "edit"}>
          <div className="tpl-fields">
            <label>Şablon adı<Input value={form.name} onChange={(event) => { setRendered(""); setForm({ ...form, name: event.target.value }) }} /></label>
            <label>Növ<Select value={form.kind} onValueChange={(kind) => { setRendered(""); setForm({ ...form, kind }) }} options={TEMPLATE_KINDS.map((item) => ({ value: item, label: item }))} /></label>
            <label>Versiya<Input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label>
            <label>Hüquq yoxlaması<Select value={form.legal} onValueChange={(legal) => setForm({ ...form, legal })} options={TEMPLATE_LEGAL.map((item) => ({ value: item, label: item }))} /></label>
            <label className="span-2">Tərəf<Input value={form.party} onChange={(event) => setForm({ ...form, party: event.target.value })} placeholder="Sifarişçi, bank, anbar" /></label>
          </div>
          <TemplateBodyField value={form.body} onChange={(body) => { setRendered(""); setForm({ ...form, body }) }} />

      </Panel>
      <Panel className="pad template-fill" hidden={studioTab !== "fill"}>
        <Disclosure title="Şirkət məlumatları"><dl className="finance-breakdown"><div><dt>Şirkət</dt><dd>{cabinet.name || "—"}</dd></div><div><dt>VÖEN</dt><dd>{cabinet.voen || "—"}</dd></div><div><dt>Ünvan</dt><dd>{cabinet.legalAddress || "—"}</dd></div></dl></Disclosure>
          <div className="tpl-fill">
            <div className="tpl-body-top"><span>Yığım</span><em>boş sahə mətndə işarə ilə qalır</em></div>
            <div className="tpl-fields">
              <label>Tərəf<Input value={fields.teref} onChange={(event) => { setRendered(""); setFields({ ...fields, teref: event.target.value }) }} /></label>
              <label>Məbləğ<Input value={fields.mebleg} onChange={(event) => { setRendered(""); setFields({ ...fields, mebleg: event.target.value }) }} /></label>
              <label>Tarix<DateField value={fields.tarix} onChange={(tarix) => { setRendered(""); setFields({ ...fields, tarix }) }} ariaLabel="Tarix" /></label>
              <label>Layihə<Input value={fields.layihe} onChange={(event) => { setRendered(""); setFields({ ...fields, layihe: event.target.value }) }} /></label>
              <label>Müddət<Input value={fields.muddet} onChange={(event) => { setRendered(""); setFields({ ...fields, muddet: event.target.value }) }} /></label>
              <label>Dövr<Input value={fields.dovr} onChange={(event) => { setRendered(""); setFields({ ...fields, dovr: event.target.value }) }} /></label>
            </div>
          </div>

        <div className="form-actions"><Button onClick={() => {void renderText();setStudioTab("preview")}}>Mətni hazırla</Button></div>
      </Panel>
      <div hidden={studioTab !== "preview"}>
          <article className="tpl-paper">
            <header>
              <span>Yığılmış mətn</span>
              <span>v.{meta.version || form.version || "—"} · {legalLabel(meta.legal || form.legal)}</span>
            </header>
            <div>{paper.trim() ? highlightBody(paper) : "Mətn boşdur."}</div>
            <footer>
              <span>Hüquqi rəy əvəzi deyil.</span>
              <span>
                <Button type="button" className="ghost small" onClick={() => download("doc")} disabled={!paper.trim()}>Word</Button>
                <Button type="button" className="ghost small" onClick={() => download("pdf")} disabled={!paper.trim()}>PDF</Button>
              </span>
            </footer>
          </article>
      </div>
    </>}
  </div>
}

export function AdminPage() {
  useTitle("İdarə")
  const { cabinet, coop, tender } = useWorkspace()
  const [packs, setPacks] = useState<Pack[]>([])
  const [draft, setDraft] = useState<Record<string, { amount: string; userLimit: string; smetaLimit: string }>>({})
  const [note, setNote] = useState("")
  const [view, setView] = useState("packages")
  const [editing, setEditing] = useState("")
  const [busy, setBusy] = useState(false)

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
    if (!row || busy) return
    setBusy(true)
    try {
      const updated = await api<Pack>(`/api/platform/packages/${id}`, { method: "PATCH", body: JSON.stringify(row) })
      setPacks((current) => current.map((pack) => pack.id === id ? updated : pack))
      setEditing("")
      setNote("Paket məbləği və hədləri yazıldı. Kartla tutulma yoxdur.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Paket yazılmadı")
    } finally {setBusy(false)}
  }

  const selected = packs.find((pack) => pack.id === editing)
  function openPackage(pack:Pack) {setDraft((current) => ({...current,[pack.id]:{amount:pack.amount == null ? "" : String(pack.amount),userLimit:pack.userLimit == null ? "" : String(pack.userLimit),smetaLimit:pack.smetaLimit == null ? "" : String(pack.smetaLimit)}}));setNote("");setEditing(pack.id)}
  return <div className="finance-simple admin-workspace">
    <PageHead title="Platforma idarəsi" text="Abunə paketlərinin qiymət və limitlərini idarə edin." />
    <Tabs value={view} onChange={setView} options={[{id:"packages",label:"Paketlər"},{id:"general",label:"Ümumi məlumat"}]} />
    {note && !selected && <p className="lede" role="status">{note}</p>}
    {view === "packages" ? <TableContainer className="finance-records-table"><table><thead><tr><th>Paket</th><th>Məbləğ, AZN</th><th>İstifadəçi limiti</th><th>Layihə limiti</th><th><span className="sr-only">Redaktə et</span></th></tr></thead><tbody>{packs.map((pack) => <tr key={pack.id} tabIndex={0} onClick={() => openPackage(pack)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();openPackage(pack)}}}><td><strong>{pack.name}</strong><small>{pack.features}</small></td><td>{pack.amount == null ? "Göstərilməyib" : money(Number(pack.amount)||0)}</td><td>{pack.userLimit ?? "Limitsiz"}</td><td>{pack.smetaLimit ?? "Limitsiz"}</td><td><Button className="ghost small" onClick={(event) => {event.stopPropagation();openPackage(pack)}}><Icon name="edit" />Redaktə et</Button></td></tr>)}</tbody></table>{!packs.length && <Empty title="Paket yoxdur" text="Paket məlumatları burada görünəcək." />}</TableContainer> : <>
      <Panel className="employment-summary admin-summary">{[{icon:"office" as const,label:"Açıq kabinet",value:cabinet.code ? 1 : 0},{icon:"users" as const,label:"Əməkdaşlıq sorğusu",value:coop.length},{icon:"files" as const,label:"Növbədəki tender paketi",value:tender.confirmed ? 1 : 0}].map((item) => <div key={item.label}><Icon name={item.icon} /><div><strong>{item.value}</strong><span>{item.label}</span></div></div>)}</Panel><Panel className="pad"><h2 className="block-title">Kabinet</h2><dl className="finance-breakdown"><div><dt>Şirkət</dt><dd>{cabinet.name || "—"}</dd></div><div><dt>Kod</dt><dd>{cabinet.code || "—"}</dd></div></dl></Panel>
    </>}
    {selected && <Modal title={`${selected.name} paketi`} className="finance-record-modal" onClose={() => {if(!busy)setEditing("")}}><form onSubmit={(event) => {event.preventDefault();void save(selected.id)}}><div className="finance-form-grid"><label className="full">Məbləğ, AZN<Input inputMode="decimal" value={draft[selected.id]?.amount || ""} onChange={(event) => setDraft({...draft,[selected.id]:{...draft[selected.id],amount:event.target.value}})} placeholder="Məbləğ göstərilməyib" /></label><label>İstifadəçi limiti<Input type="number" min="1" value={draft[selected.id]?.userLimit || ""} onChange={(event) => setDraft({...draft,[selected.id]:{...draft[selected.id],userLimit:event.target.value}})} placeholder="Limitsiz" /></label><label>Layihə limiti<Input type="number" min="1" value={draft[selected.id]?.smetaLimit || ""} onChange={(event) => setDraft({...draft,[selected.id]:{...draft[selected.id],smetaLimit:event.target.value}})} placeholder="Limitsiz" /></label></div><p className="tax-form-hint">Limit boş saxlanıldıqda məhdudiyyət tətbiq edilmir.</p>{note && <p className="form-error" role="alert">{note}</p>}<div className="form-actions"><Button className="ghost" disabled={busy} onClick={() => setEditing("")}>Ləğv et</Button><Button type="submit" disabled={busy}>{busy ? "Saxlanılır…" : "Dəyişiklikləri saxla"}</Button></div></form></Modal>}
  </div>
}
