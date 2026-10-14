import { useState } from "react"
import { payablesAging, receivables } from "../domain/financeView"
import { hit, money, moneyShort } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Columns, Empty, PageHead, Tabs, useTitle } from "../ui"

export default function FinancePartners() {
  const { t } = usePrefs()
  useTitle(t("page.partners.title"))
  const state = useStore()
  const [tab, setTab] = useState("debitor")
  const rows = (tab === "debitor" ? receivables(state) : payablesAging(state)).filter((item) => hit(state.query, item.name))
  const total = rows.reduce((sum, item) => sum + item.balance, 0)
  const aged = rows.reduce((sum, item) => sum + item.days30 + item.days60 + item.older, 0)
  const buckets = [
    { label: "Cari", value: rows.reduce((sum, item) => sum + item.current, 0), tone: "pine" },
    { label: "1–30", value: rows.reduce((sum, item) => sum + item.days30, 0), tone: "copper" },
    { label: "31–60", value: rows.reduce((sum, item) => sum + item.days60, 0), tone: "rose" },
    { label: "60+", value: rows.reduce((sum, item) => sum + item.older, 0), tone: "rose" },
  ]

  return (
    <>
      <PageHead kicker={t("page.partners.kicker")} title={t("page.partners.title")} text={t("page.partners.text")} />
      <section className="statstrip">
        <article>
          <span>{tab === "debitor" ? "Bizə borc" : "Bizim borc"}</span>
          <strong>{moneyShort(total)}</strong>
          <em>{rows.length} tərəf</em>
        </article>
        <article>
          <span>Vaxtı keçən</span>
          <strong>{moneyShort(aged)}</strong>
          <em className={aged ? "warn" : ""}>{aged ? "Zəng siyahısı" : "Hamısı cari"}</em>
        </article>
      </section>
      <section className="panel pad">
        <div className="panel-head"><h2>{tab === "debitor" ? "Debitor köhnəlməsi" : "Kreditor köhnəlməsi"}</h2></div>
        <Columns rows={buckets} />
      </section>
      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "debitor", label: "Debitor" },
            { id: "kreditor", label: "Kreditor" },
          ]}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tab === "debitor" ? "Sifarişçi" : "Təchizatçı"}</th>
              <th className="num">Cari</th>
              <th className="num">1–30</th>
              <th className="num">31–60</th>
              <th className="num">60+</th>
              <th className="num">Qalıq</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.name}>
                <td><b>{item.name}</b></td>
                <td className="num">{money(item.current)}</td>
                <td className="num">{money(item.days30)}</td>
                <td className="num">{money(item.days60)}</td>
                <td className="num">{money(item.older)}</td>
                <td className="num">{money(item.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Tərəf yoxdur" text="Açıq borc tapılmadı." />}
      </div>
    </>
  )
}
