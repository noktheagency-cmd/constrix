import { DataTable } from '../components/DataTable'
import { Disclosure, Panel, SectionHeader, TableContainer, Toolbar } from "../components/primitives"
import { useState } from "react"
import { balanceLines, cashAccounts, moneyMoves } from "../domain/financeView"
import { hit, money } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Columns, Empty, PageHead, Tabs, useTitle } from "../ui"

export default function FinanceAccounts() {
  const { t } = usePrefs()
  useTitle(t("page.accounts.title"))
  const state = useStore()
  const [tab, setTab] = useState("pul")
  const moves = moneyMoves(state)
  const cash = cashAccounts(moves).filter((item) => hit(state.query, item.name, item.kind))
  const lines = balanceLines(state, moves).filter((item) => hit(state.query, item.name, item.kind, item.note))

  return (
    <>
      <PageHead kicker={t("page.accounts.kicker")} title={t("page.accounts.title")} text={t("page.accounts.text")} />
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "pul", label: "Pul" },
            { id: "balans", label: "Balans" },
          ]}
        />
      </Toolbar>
      {tab === "pul" && (
        <>
          <Disclosure title="Qalıq"><Panel className="pad">
            <SectionHeader><h2>Qalıq</h2></SectionHeader>
            <Columns rows={cash.map((item) => ({ label: item.name, value: item.balance, tone: item.kind === "bank" ? "pine" : "copper" }))} />
          </Panel></Disclosure>
          <TableContainer  style={{ marginTop: 14 }}>
          <DataTable>
            <thead>
              <tr>
                <th>Hesab</th>
                <th>Növ</th>
                <th className="num">Açılış</th>
                <th className="num">Daxil</th>
                <th className="num">Çıxan</th>
                <th className="num">Qalıq</th>
              </tr>
            </thead>
            <tbody>
              {cash.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b></td>
                  <td>{item.kind === "bank" ? "Bank" : "Nağd"}</td>
                  <td className="num">{money(item.opening)}</td>
                  <td className="num in">{money(item.inflow)}</td>
                  <td className="num out">{money(item.outflow)}</td>
                  <td className="num">{money(item.balance)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {cash.length === 0 && <Empty title="Hesab yoxdur" text="Axtarışa uyğun pul hesabı tapılmadı." />}
        </TableContainer>
        </>
      )}
      {tab === "balans" && (
        <>
          <Disclosure title="Balans"><Panel className="pad">
            <SectionHeader><h2>Balans</h2></SectionHeader>
            <Columns rows={lines.map((item) => ({ label: item.name, value: item.amount, tone: item.id === "kreditor" ? "rose" : "copper" }))} />
          </Panel></Disclosure>
          <TableContainer  style={{ marginTop: 14 }}>
          <DataTable>
            <thead>
              <tr>
                <th>Hesab</th>
                <th>Haradan</th>
                <th>Qeyd</th>
                <th className="num">Məbləğ</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b></td>
                  <td>{item.kind}</td>
                  <td className="muted">{item.note}</td>
                  <td className="num">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {lines.length === 0 && <Empty title="Sətir yoxdur" text="Axtarışa uyğun balans sətri tapılmadı." />}
        </TableContainer>
        </>
      )}
    </>
  )
}
