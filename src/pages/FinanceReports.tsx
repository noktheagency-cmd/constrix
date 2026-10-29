import { DataTable } from '../components/DataTable'
import { Disclosure, Metric, Panel, SectionHeader, StatGrid, TableContainer, Toolbar } from "../components/primitives"
import { useState } from "react"
import { agingRows, cashRows, profitRows, vatRows } from "../domain/financeReports"
import { money, monthAZ, monthWord } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Columns, Empty, FlowBars, PageHead, Tabs, useTitle } from "../ui"

export default function FinanceReports() {
  const { t } = usePrefs()
  useTitle(t("page.reportsFinance.title"))
  const state = useStore()
  const [tab, setTab] = useState("edv")
  const vat = vatRows(state)
  const profit = profitRows(state).filter((row) => !state.query || row.project.toLowerCase().includes(state.query.trim().toLowerCase()))
  const aging = agingRows(state)
  const cash = cashRows(state)
  const buckets = ["Cari", "1–30 gün", "31–60 gün", "60 gündən çox"]

  return (
    <>
      <PageHead kicker={t("page.reportsFinance.kicker")} title={t("page.reportsFinance.title")} text={t("page.reportsFinance.text")} />
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "edv", label: "ƏDV" },
            { id: "menfeet", label: "Layihə mənfəəti" },
            { id: "debitor", label: "Debitor" },
            { id: "pul", label: "Pul axını" },
          ]}
        />
      </Toolbar>

      {tab === "edv" && (
        <>
          <Disclosure title="ƏDV"><Panel className="pad">
            <SectionHeader><h2>ƏDV</h2></SectionHeader>
            <Columns rows={vat.map((row) => ({ label: monthWord(row.period), value: row.vat, tone: "copper" }))} />
          </Panel></Disclosure>
          <TableContainer  style={{ marginTop: 14 }}>
          <DataTable>
            <thead>
              <tr>
                <th>Dövr</th>
                <th className="num">Xalis</th>
                <th className="num">ƏDV</th>
                <th className="num">Yekun</th>
              </tr>
            </thead>
            <tbody>
              {vat.map((row) => (
                <tr key={row.period}>
                  <td>{monthAZ(row.period)}</td>
                  <td className="num">{money(row.net)}</td>
                  <td className="num">{money(row.vat)}</td>
                  <td className="num">{money(row.gross)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {vat.length === 0 && <Empty title="ƏDV bazası yoxdur" text="Təsdiqlənmiş Forma-2-lər burada toplanır." />}
        </TableContainer>
        </>
      )}

      {tab === "menfeet" && (
        <>
          <Disclosure title="Fərq"><Panel className="pad">
            <SectionHeader><h2>Fərq</h2></SectionHeader>
            <Columns rows={profit.map((row) => ({ label: row.project, value: Math.abs(row.margin), tone: row.margin < 0 ? "rose" : "pine" }))} />
          </Panel></Disclosure>
          <TableContainer  style={{ marginTop: 14 }}>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th className="num">Smeta</th>
                <th className="num">Yerinə yetirilib</th>
                <th className="num">Xərc</th>
                <th className="num">Fərq</th>
              </tr>
            </thead>
            <tbody>
              {profit.map((row) => (
                <tr key={row.projectId}>
                  <td>{row.project}</td>
                  <td className="num">{money(row.planned)}</td>
                  <td className="num">{money(row.earned)}</td>
                  <td className="num">{money(row.spent)}</td>
                  <td className="num">{money(row.margin)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableContainer>
        </>
      )}

      {tab === "debitor" && (
        <div className="stack">
          <Disclosure title="Köhnəlmə"><Panel className="pad">
            <SectionHeader><h2>Köhnəlmə</h2></SectionHeader>
            <Columns rows={buckets.map((bucket) => ({ label: bucket, value: aging.filter((row) => row.bucket === bucket).reduce((total, row) => total + row.amount, 0), tone: bucket === "Cari" ? "pine" : "rose" }))} />
          </Panel></Disclosure>
          <StatGrid>
            {buckets.map((bucket) => {
              const sum = aging.filter((row) => row.bucket === bucket).reduce((total, row) => total + row.amount, 0)
              return (
                <Metric key={bucket}>
                  <span>{bucket}</span>
                  <strong>{money(sum)}</strong>
                </Metric>
              )
            })}
          </StatGrid>
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Faktura</th>
                  <th>Müştəri</th>
                  <th>Layihə</th>
                  <th>Kova</th>
                  <th className="num">Məbləğ</th>
                </tr>
              </thead>
              <tbody>
                {aging.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.client}</td>
                    <td>{row.project}</td>
                    <td>{row.bucket}</td>
                    <td className="num">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {aging.length === 0 && <Empty title="Açıq debitor yoxdur" text="Göndərilmiş və gecikən fakturalar burada görünür." />}
          </TableContainer>
        </div>
      )}

      {tab === "pul" && (
        <>
          <Disclosure title="Pul axını"><Panel className="pad">
            <SectionHeader><h2>Pul axını</h2></SectionHeader>
            <FlowBars rows={cash.map((row) => ({ label: monthWord(row.month), inn: row.inflow, out: row.outflow }))} />
          </Panel></Disclosure>
          <TableContainer  style={{ marginTop: 14 }}>
          <DataTable>
            <thead>
              <tr>
                <th>Ay</th>
                <th className="num">Daxilolma</th>
                <th className="num">Çıxış</th>
                <th className="num">Xalis</th>
              </tr>
            </thead>
            <tbody>
              {cash.map((row) => (
                <tr key={row.month}>
                  <td>{monthAZ(row.month)}</td>
                  <td className="num">{money(row.inflow)}</td>
                  <td className="num">{money(row.outflow)}</td>
                  <td className="num">{money(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {cash.length === 0 && <Empty title="Hərəkət yoxdur" text="Ödənilmiş faktura, mənzil ödənişi və xərc aylar üzrə yığılır." />}
        </TableContainer>
        </>
      )}
    </>
  )
}
