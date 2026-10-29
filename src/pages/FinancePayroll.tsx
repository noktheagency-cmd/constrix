import { DataTable } from '../components/DataTable'
import { Disclosure, Button, Metric, Panel, SectionHeader, StatGrid, TableContainer, Toolbar } from "../components/primitives"
import { useState } from "react"
import { payrollView } from "../domain/financeView"
import { dateAZ, hit, money, moneyShort } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Columns, Confirm, Empty, PageHead, RowMenu, Tabs, useTitle } from "../ui"

export default function FinancePayroll() {
  const { t } = usePrefs()
  useTitle(t("page.payroll.title"))
  const state = useStore()
  const [tab, setTab] = useState("stat")
  const [drop, setDrop] = useState("")
  const sheet = payrollView(state)
  const staff = sheet.staff.filter((item) => hit(state.query, item.name, item.role, item.site))
  const paid = sheet.paid.filter((item) => hit(state.query, item.id, item.vendor, item.project))
  const runs = state.payrolls.filter((item) => hit(state.query, item.id, item.status, ...item.lines.map((line) => line.name)))

  return (
    <>
      <PageHead kicker={t("page.payroll.kicker")} title={t("page.payroll.title")} text={t("page.payroll.text")}>
        <Button type="button" onClick={() => state.runPayroll()}><Icon name="plus" /> Cədvəl</Button>
      </PageHead>
      <StatGrid>
        <Metric>
          <span>Ştat norması</span>
          <strong>{moneyShort(sheet.staffTotal)}</strong>
          <em>Aylıq</em>
        </Metric>
        <Metric>
          <span>Sahədən ödənilib</span>
          <strong>{moneyShort(sheet.paidTotal)}</strong>
          <em>Təsdiqli xərc</em>
        </Metric>
        <Metric>
          <span>Açıq cədvəl</span>
          <strong>{moneyShort(sheet.openTotal)}</strong>
          <em>{sheet.openRuns.length ? "Ödəniş gözləyir" : "Yoxdur"}</em>
        </Metric>
      </StatGrid>
      <Disclosure title="Norma, ödəniş və açıq cədvəl"><Panel className="pad">
        <SectionHeader><h2>Norma, ödəniş və açıq cədvəl</h2></SectionHeader>
        <Columns rows={[
          { label: "Ştat", value: sheet.staffTotal, tone: "" },
          { label: "Ödənilib", value: sheet.paidTotal, tone: "pine" },
          { label: "Açıq", value: sheet.openTotal, tone: "copper" },
        ]} />
      </Panel></Disclosure>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "stat", label: "Ştat" },
            { id: "odenis", label: "Ödəniş" },
            { id: "cedvel", label: "Cədvəl" },
          ]}
        />
      </Toolbar>
      {tab === "stat" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>İşçi</th>
                <th>Vəzifə</th>
                <th>Yer</th>
                <th className="num">Aylıq norma</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b></td>
                  <td>{item.role}</td>
                  <td>{item.site}</td>
                  <td className="num">{money(item.monthly)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {staff.length === 0 && <Empty title="Ştat yoxdur" text="Axtarışa uyğun işçi tapılmadı." />}
        </TableContainer>
      )}
      {tab === "odenis" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Xərc</th>
                <th>Layihə</th>
                <th>Tarix</th>
                <th className="num">Məbləğ</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="name-cell">
                      <b>{item.id}</b>
                      <span className="muted">{item.vendor}</span>
                    </div>
                  </td>
                  <td>{item.project}</td>
                  <td>{dateAZ(item.date)}</td>
                  <td className="num">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {paid.length === 0 && <Empty title="Ödəniş yoxdur" text="Əmək haqqı xərci tapılmadı." />}
        </TableContainer>
      )}
      {tab === "cedvel" && (
        <div className="stack">
          {runs.map((run) => (
            <Panel key={run.id} className="pad">
              <SectionHeader>
                <h2>{run.id}</h2>
                <span className="deal-side">
                  <Badge status={run.status} />
                  {run.status === "acik" && (
                    <RowMenu items={[
                      { id: "pay", label: "Ödə", onClick: () => state.payPayroll(run.id) },
                      { id: "delete", label: "Sil", onClick: () => setDrop(run.id) },
                    ]} />
                  )}
                </span>
              </SectionHeader>
              <p className="muted">{dateAZ(run.date)} · {money(run.total)}</p>
              <TableContainer>
                <DataTable>
                  <thead>
                    <tr>
                      <th>İşçi</th>
                      <th className="num">Saat</th>
                      <th className="num">Məbləğ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.lines.map((line) => (
                      <tr key={line.personId}>
                        <td>{line.name}</td>
                        <td className="num">{line.hours}</td>
                        <td className="num">{money(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableContainer>
            </Panel>
          ))}
          {runs.length === 0 && <Empty title="Cədvəl yoxdur" text="Tabeli bağlanmış gündəlikdən cədvəl açılır. Ödənişdən sonra pula düşür." />}
        </div>
      )}
      {drop && <Confirm title="Cədvəl silinsin?" text={`${drop} silinəcək və tabel yenidən cədvələ düşə bilər.`} onClose={() => setDrop("")} onYes={() => { state.removePayroll(drop); setDrop("") }} />}
    </>
  )
}
