import { DataTable } from '../components/DataTable'
import { TableContainer } from "../components/primitives"
import { hit } from "../format"
import { ROLES } from "../domain/access"
import type { Role } from "../domain/types"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Empty, PageHead, useTitle } from "../ui"

export default function Audit() {
  const { t } = usePrefs()
  useTitle(t("page.audit.title"))
  const { query, audit } = useStore()
  const rows = audit.filter((item) => hit(query, item.action, item.detail, item.actor, item.id))
  return (
    <>
      <PageHead kicker={t("page.audit.kicker")} title={t("page.audit.title")} text={t("page.audit.text")} />
      <TableContainer>
        <DataTable>
          <thead>
            <tr>
              <th>Vaxt</th>
              <th>Kim</th>
              <th>Əməliyyat</th>
              <th>Detal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td className="mono">{item.at}</td>
                <td>
                  <b>{item.actor}</b>
                  <div className="muted">{item.role in ROLES ? ROLES[item.role as Role] : item.role}</div>
                </td>
                <td>{item.action}</td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {rows.length === 0 && <Empty title="Qeyd yoxdur" text="Axtarışa uyğun əməliyyat tapılmadı." />}
      </TableContainer>
    </>
  )
}
