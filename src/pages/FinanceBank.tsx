import { DataTable } from '../components/DataTable'
import { Button, Disclosure, Input, Metric, Panel, SectionHeader, StatGrid, TableContainer } from "../components/primitives"
import { useEffect, useState } from "react"
import { ApiError, api, dec } from "../api"
import { cashAccounts, moneyMoves } from "../domain/financeView"
import { dateAZ, hit, money, moneyShort, monthWord } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Empty, FlowBars, PageHead, Select, useTitle } from "../ui"

export default function FinanceBank() {
  const { t } = usePrefs()
  useTitle(t("page.bank.title"))
  const state = useStore()
  const moves = moneyMoves(state)
  const banks = cashAccounts(moves).filter((item) => item.kind === "bank")
  const rows = moves.filter((item) => item.accountId !== "kassa" && hit(state.query, item.id, item.party, item.project, item.account, item.category))
  const byMonth = new Map<string, { inn: number; out: number }>()
  for (const item of rows) {
    const key = item.date.slice(0, 7)
    const row = byMonth.get(key) ?? { inn: 0, out: 0 }
    if (item.direction === "in") row.inn += item.amount
    else row.out += item.amount
    byMonth.set(key, row)
  }
  const flow = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, row]) => ({ label: monthWord(id), ...row }))

  return (
    <>
      <PageHead kicker={t("page.bank.kicker")} title={t("page.bank.title")} text={t("page.bank.text")} />
      <StatGrid>
        {banks.map((item) => (
          <Metric key={item.id}>
            <span>{item.name}</span>
            <strong>{moneyShort(item.balance)}</strong>
            <em>{item.inflow || item.outflow ? `Daxil ${moneyShort(item.inflow)}` : "Hərəkət yoxdur"}</em>
          </Metric>
        ))}
      </StatGrid>
      <Disclosure title="Bank hərəkəti"><Panel className="pad">
        <SectionHeader><h2>Bank hərəkəti</h2></SectionHeader>
        <FlowBars rows={flow} />
      </Panel></Disclosure>
      <TableContainer  style={{ marginTop: 14 }}>
        <DataTable>
          <thead>
            <tr>
              <th>Tarix</th>
              <th>Hesab</th>
              <th>Tərəf</th>
              <th>Açıqlama</th>
              <th className="num">Məbləğ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>{dateAZ(item.date)}</td>
                <td>{item.account}</td>
                <td>{item.party}</td>
                <td>{item.category} · {item.project}</td>
                <td className={item.direction === "in" ? "num in" : "num out"}>
                  {item.direction === "in" ? "" : "−"}
                  {money(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {rows.length === 0 && <Empty title="Çıxarış boşdur" text="Bank hesabına düşən hərəkət yoxdur." />}
      </TableContainer>
      <BankApplications />
    </>
  )
}

const FLOW = [
  { value: "qaralama", label: "Qaralama" },
  { value: "teqdim", label: "Təqdim" },
  { value: "elave", label: "Əlavə sənəd" },
  { value: "qiymet", label: "Qiymətləndirmə" },
  { value: "tesdiq", label: "Təsdiq" },
  { value: "imtina", label: "İmtina" },
]

type BankApp = { id: string; kind: string; status: string; amount: unknown; purpose: string; partner: { name: string } | null; events: { id: string; status: string; note: string }[] }
type BankPartner = { id: string; kind: string; name: string }

function BankApplications() {
  const [partners, setPartners] = useState<BankPartner[]>([])
  const [apps, setApps] = useState<BankApp[]>([])
  const [form, setForm] = useState({ partnerId: "", kind: "qarant", amount: "", purpose: "", consent: false, extra: "" })
  const [note, setNote] = useState("")

  function reload() {
    return Promise.all([
      api<BankPartner[]>("/api/platform/finance/partners"),
      api<BankApp[]>("/api/platform/finance/applications"),
    ]).then(([all, applications]) => {
      setPartners(all.filter((item) => item.kind === "bank" || item.kind === "faktorinq"))
      setApps(applications.filter((item) => item.kind === "qarant" || item.kind === "kredit" || item.kind === "faktorinq"))
    })
  }

  useEffect(() => {
    reload().catch(() => undefined)
  }, [])

  async function apply() {
    if (!form.consent) {
      setNote("Sənəd paketi yalnız şirkətin razılığı ilə hazırlanır. Bankın sisteminə canlı göndəriş yoxdur.")
      return
    }
    try {
      await api("/api/platform/finance/applications", {
        method: "POST",
        body: JSON.stringify({
          consent: true,
          kind: form.kind,
          partnerId: form.partnerId,
          amount: form.amount,
          purpose: form.purpose || "Bank müraciəti",
          payload: { extra: form.extra },
        }),
      })
      await reload()
      setNote("Müraciət qaralama kimi saxlandı. Bankın sisteminə göndərilmir.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Müraciət yazılmadı")
    }
  }

  async function status(id: string, next: string) {
    try {
      await api(`/api/platform/finance/applications/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next, note: form.extra || "Əl ilə yazılan addım" }),
      })
      await reload()
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Status yazılmadı")
    }
  }

  return (
    <Panel className="pad" style={{ marginTop: 14 }}>
      <h2 className="block-title">Bank və sığorta müraciəti</h2>
      <p className="lede">Axın qaralama, təqdim, əlavə sənəd, qiymətləndirmə, təsdiq və ya imtinadan keçir. Tarixçə hər addımda qalır. Canlı bank bağlantısı yoxdur.</p>
      <div className="form-row wide">
        <label>Növ<Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind })} options={[{ value: "qarant", label: "Qarantiya" }, { value: "kredit", label: "Kredit" }, { value: "faktorinq", label: "Faktorinq" }]} /></label>
        <label>Tərəfdaş<Select value={form.partnerId} onValueChange={(partnerId) => setForm({ ...form, partnerId })} options={[{ value: "", label: "Seçilməyib" }, ...partners.map((item) => ({ value: item.id, label: item.name }))]} /></label>
        <label>Məbləğ<Input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label>Məqsəd<Input value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} /></label>
        <label>Əlavə sənəd<Input value={form.extra} onChange={(event) => setForm({ ...form, extra: event.target.value })} /></label>
        <label>Şirkət razılığı<input type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /></label>
        <Button type="button" onClick={() => void apply()}>Qaralamanı yaz</Button>
      </div>
      {apps.map((row) => (
        <div className="form-row" key={row.id}>
          <span>{row.kind} · {row.partner?.name || "tərəfdaş yoxdur"} · {row.purpose} · {dec(row.amount)} · {(row.events || []).map((event) => `${event.status}${event.note ? ` (${event.note})` : ""}`).join(" → ")}</span>
          <Select value={row.status} onValueChange={(next) => void status(row.id, next)} options={FLOW} />
        </div>
      ))}
      {note && <p className="lede">{note}</p>}
    </Panel>
  )
}
