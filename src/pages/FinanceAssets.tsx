import { assetRows } from "../domain/financeView"
import { hit, money, moneyShort } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Columns, Empty, PageHead, useTitle } from "../ui"

export default function FinanceAssets() {
  const { t } = usePrefs()
  useTitle(t("page.fixed.title"))
  const state = useStore()
  const rows = assetRows(state).filter((item) => hit(state.query, item.name, item.type, item.site, item.id))
  const nbv = rows.filter((item) => item.capitalized).reduce((sum, item) => sum + item.nbv, 0)
  const hired = rows.filter((item) => !item.capitalized).length

  return (
    <>
      <PageHead kicker={t("page.fixed.kicker")} title={t("page.fixed.title")} text={t("page.fixed.text", { value: moneyShort(nbv), hired })} />
      <section className="panel pad">
        <div className="panel-head"><h2>Qalıq dəyər</h2></div>
        <Columns rows={rows.filter((item) => item.capitalized).map((item) => ({ label: item.name, value: item.nbv, tone: "copper" }))} />
      </section>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Vəsait</th>
              <th>Yer</th>
              <th>Mülkiyyət</th>
              <th className="num">İlkin dəyər</th>
              <th className="num">Köhnəlmə</th>
              <th className="num">Qalıq</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="name-cell">
                    <b>{item.name}</b>
                    <span className="muted">{item.type}</span>
                  </div>
                </td>
                <td>{item.site}</td>
                <td><Badge status={item.ownership} /></td>
                <td className="num">{item.capitalized ? money(item.cost) : "—"}</td>
                <td className="num">{item.capitalized ? money(item.depreciation) : "—"}</td>
                <td className="num">{item.capitalized ? money(item.nbv) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Vəsait yoxdur" text="Parkda texnika tapılmadı." />}
      </div>
    </>
  )
}
