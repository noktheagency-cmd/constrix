import { DataTable } from '../components/DataTable'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { usePrefs } from "../i18n";
import { chooseOrg, loadAccountOrgs, useOrgs } from "../orgs";
import { Empty, Field, Modal, PageHead, Select, Tabs, useTitle } from "../ui";
import { MarketDocuments, MarketDownload } from "../components/MarketDocuments";
import "./market.css";

type Option = { id: string; name: string };
type Line = {
  id: string;
  itemId: string;
  name: string;
  unit: string;
  qty: string;
  spec: string;
  unitNet?: string;
  vatRate?: string;
};
type Receipt = {
  id: string;
  acceptedAt: string;
  awaitingTariff: boolean;
  proof: string;
  lines: {
    lineId: string;
    accepted: string;
    disputed: string;
    net?: string;
    gross?: string;
  }[];
};
type Case = {
  id: string;
  kind: string;
  buyerId: string;
  supplierId: string;
  status: string;
  region: string;
  category: string;
  updatedAt: string;
  data: {
    title: string;
    address: string;
    requiredDate: string;
    files: string[];
    lines: Line[];
    payment?: string;
    validUntil?: string;
    deliveries?: {
      id: string;
      proof: string;
      lines: { lineId: string; qty: string }[];
    }[];
    receipts?: Receipt[];
    disputes?: {
      id: string;
      lineId: string;
      qty: string;
      status: string;
      recommendation?: string;
    }[];
    returns?: { id: string; lineId: string; qty: string; status: string }[];
    erpLinked?: boolean;
  };
};
type Item = {
  id: string;
  name: string;
  category: string;
  unit: string;
  brand: string;
  model: string;
  suppliers: {
    id: string;
    name: string;
    region: string;
    availability: string;
    quantity: string | null;
    leadDays: number | null;
  }[];
};
type Company = {
  organizationId: string;
  name: string;
  region: string;
  voen: string;
  status: string;
  reason: string;
  documents: string[];
};
type Workspace = {
  organizationId: string;
  accountId: string;
  seat: string;
  admin: boolean;
  company: Company | null;
  projects: Option[];
  locations: Option[];
  members: { accountId: string; seat: string; account: { name: string } }[];
  companies: { organizationId: string; name: string; region: string }[];
  items: { id: string; name: string; status: string; reason: string }[];
  grants: {
    id: string;
    accountId: string;
    projectId: string;
    locationId: string;
    limit: string;
    active: boolean;
  }[];
};
type Detail = {
  case: Case;
  bids: {
    id: string;
    supplierId: string;
    revision: number;
    data: {
      lines: Line[];
      validUntil: string;
      payment: string;
      deliveryCost: string;
    };
  }[];
  messages: {
    id: string;
    organizationId: string;
    recipientId: string;
    text: string;
    attachments: string[];
    createdAt: string;
  }[];
};
type Draft = Record<string, string>;
type FormSpec = {
  title: string;
  fields: {
    key: string;
    label: string;
    type?: string;
    options?: { value: string; label: string }[];
    optional?: boolean;
    initial?: string;
  }[];
  documents?: "commercial" | "certificate";
  lines?: Line[];
  columns?: { key: string; label: string; initial?: string }[];
  submit: (values: Draft, docs: string[], rows: Draft[]) => Promise<unknown>;
};
const labels: Record<string, string> = {
  pending: "Yoxlanılır",
  approved: "Təsdiqlənib",
  changes: "Düzəliş tələb olunur",
  suspended: "Dayandırılıb",
  rejected: "Rədd edilib",
  sent: "Təklif gözləyir",
  bids: "Təkliflər var",
  selected: "Seçilib",
  created: "Yeni sifariş",
  confirmed: "Təsdiqlənib",
  delivered: "Çatdırılıb",
  part_received: "Qismən qəbul",
  closed: "Tam qəbul",
  requested: "Təsdiq gözləyir",
  open: "Açıq",
  resolved: "Həll edilib",
  paid: "Ödənilib",
  due: "Ödəniş gözləyir",
  overdue: "Gecikib",
  warning: "Xəbərdarlıq",
  restricted: "Məhdudlaşdırılıb",
};
const Status = ({ value }: { value: string }) => (
  <span className={`market-status status-${value}`}>
    {labels[value] || value}
  </span>
);
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" }).format(
    new Date(),
  );
const post = (path: string, body: object) =>
  api(`/api/market/${path}`, { method: "POST", body: JSON.stringify(body) });
const options = (rows: Option[]) => [
  { value: "", label: "Seçilməyib" },
  ...rows.map((r) => ({ value: r.id, label: r.name })),
];
const numberField = (key: string, label: string, initial = "0") => ({
  key,
  label,
  type: "number",
  initial,
});
function ActionForm({
  spec,
  onClose,
  onDone,
}: {
  spec: FormSpec;
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Draft>(() =>
      Object.fromEntries(spec.fields.map((f) => [f.key, f.initial || ""])),
    ),
    [docs, setDocs] = useState<string[]>([]),
    [rows, setRows] = useState<Draft[]>(
      () =>
        spec.lines?.map((line) =>
          Object.fromEntries(
            (spec.columns || []).map((c) => [
              c.key,
              c.initial === undefined ? line.qty : c.initial,
            ]),
          ),
        ) || [],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await spec.submit({ ...values, key: key.current }, docs, rows);
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saxlanmadı");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={spec.title}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form className="market-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="market-fields">
            {spec.fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.options ? (
                  <Select
                    value={values[f.key]}
                    onValueChange={(v) =>
                      setValues((old) => ({ ...old, [f.key]: v }))
                    }
                    options={f.options}
                  />
                ) : (
                  <input
                    required={!f.optional}
                    type={f.type || "text"}
                    step={f.type === "number" ? "any" : undefined}
                    min={f.type === "number" ? "0" : undefined}
                    value={values[f.key]}
                    onChange={(e) =>
                      setValues((old) => ({ ...old, [f.key]: e.target.value }))
                    }
                  />
                )}
              </Field>
            ))}
          </div>
          {spec.lines && (
            <div className="market-table-wrap">
              <DataTable>
                <thead>
                  <tr>
                    <th>Məhsul</th>
                    <th>Sifariş miqdarı</th>
                    {spec.columns?.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spec.lines.map((line, i) => (
                    <tr key={line.id}>
                      <td>
                        {line.name}
                        <small>{line.unit}</small>
                      </td>
                      <td>{line.qty}</td>
                      {spec.columns?.map((c) => (
                        <td key={c.key}>
                          <input
                            aria-label={`${line.name} ${c.label}`}
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={rows[i][c.key]}
                            onChange={(e) =>
                              setRows((old) =>
                                old.map((row, n) =>
                                  n === i
                                    ? { ...row, [c.key]: e.target.value }
                                    : row,
                                ),
                              )
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          )}
          {spec.documents && (
            <Field label="Sənədlər">
              <MarketDocuments
                kind={spec.documents}
                value={docs}
                onChange={setDocs}
              />
            </Field>
          )}
        </fieldset>
        {error && (
          <p className="market-error" role="alert">
            {error}
          </p>
        )}
        <div className="market-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={onClose}
          >
            Ləğv et
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saxlanılır…" : "Təsdiqlə və saxla"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="market-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function MarketPortal() {
  useTitle("Market");
  const { signedIn, signIn, signOut } = usePrefs(),
    orgs = useOrgs(),
    navigate = useNavigate(),
    { caseId } = useParams();
  const [tab, setTab] = useState("catalog"),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [catalog, setCatalog] = useState<Item[]>([]),
    [cases, setCases] = useState<Case[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [form, setForm] = useState<FormSpec | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [query, setQuery] = useState(""),
    [basket, setBasket] = useState<Record<string, string>>({}),
    [login, setLogin] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [finance, setFinance] = useState<{
      charges: Record<string, string>[];
      payments: Record<string, string>[];
      statement: { balance: string; month: string };
    } | null>(null),
    [moderation, setModeration] = useState<{
      companies: Company[];
      items: (Item & { ownerId: string; documents: string[] })[];
      payments: Record<string, string>[];
    } | null>(null),
    [settings, setSettings] = useState<{
      policy: {
        dueDays: number;
        warnDays: number;
        restrictDays: number;
        requiredProofCategories: string[];
      };
      tariffs: Record<string, string>[];
    } | null>(null),
    [month, setMonth] = useState(today().slice(0, 7));
  const refresh = () => setRevision((r) => r + 1);
  useEffect(() => {
    if (signedIn) void loadAccountOrgs();
  }, [signedIn]);
  useEffect(() => {
    let active = true;
    api<Item[]>("/api/market/catalog")
      .then((rows) => {
        if (active) setCatalog(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    setWorkspace(current=>current?.organizationId===orgs.activeId?current:null);
    if (!signedIn || !orgs.activeId) return;
    let active = true;
    api<Workspace>("/api/market/workspace")
      .then((w) => {
        if (active) setWorkspace(w);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [signedIn, orgs.activeId, revision]);
  useEffect(() => {
    setError("");
    setCases([]);
    setDetail(null);
    setFinance(null);
    setModeration(null);
    setSettings(null);
    if (!workspace) {setLoading(false);return;}
    let active = true;
    setLoading(true);
    const request = caseId
      ? api<Detail>(`/api/market/cases/${encodeURIComponent(caseId)}`).then(
          (v) => {
            if (active) setDetail(v);
          },
        )
      : ["rfq", "order"].includes(tab)
        ? api<Case[]>(`/api/market/cases?kind=${tab}`).then((v) => {
            if (active) setCases(v);
          })
        : tab === "finance"
          ? api<typeof finance>(`/api/market/finance?month=${month}`).then(
              (v) => {
                if (active) setFinance(v);
              },
            )
          : tab === "moderation"
            ? Promise.all([
                api<typeof moderation>("/api/market/moderation"),
                api<typeof settings>("/api/market/settings"),
              ]).then(([m, s]) => {
                if (active) {
                  setModeration(m);
                  setSettings(s);
                }
              })
            : Promise.resolve();
    request
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace, caseId, tab, month]);
  function open(spec: FormSpec) {
    if (!signedIn) {
      setLogin(true);
      return;
    }
    if (!workspace) {
      setError("Əvvəl şirkət seçin.");
      return;
    }
    setForm(spec);
  }
  const simple = (
    title: string,
    path: string,
    fields: FormSpec["fields"] = [],
    extra: object = {},
    documents?: FormSpec["documents"],
  ) =>
    open({
      title,
      fields,
      documents,
      submit: (v, docs) =>
        post(path, {
          ...extra,
          ...v,
          ...(path === "acceptance-grants"
            ? { active: v.active === "true" }
            : {}),
          ...(documents
            ? {
                proof: docs[0],
                files: docs,
                documents: docs,
                attachments: docs,
              }
            : {}),
        }).then(result=>{if(path.endsWith('/select')&&result&&typeof result==='object'&&'id' in result)navigate(`/market/cases/${String(result.id)}`);return result}),
    });
  const companyName = (id: string) =>
    workspace?.companies.find((c) => c.organizationId === id)?.name || id;
  const commercial =
      workspace && ["direktor", "satinalma"].includes(workspace.seat),
    canFinance = workspace && ["direktor", "muhasib"].includes(workspace.seat);
  function newRfq() {
    const chosen = catalog.filter((i) => basket[i.id]);
    if (!chosen.length) {
      setError("Sorğu üçün kataloqdan məhsul seçin.");
      return;
    }
    open({
      title: "Qiymət sorğusu göndər",
      fields: [
        { key: "title", label: "Sorğunun adı" },
        { key: "category", label: "Kateqoriya", initial: chosen[0].category },
        { key: "region", label: "Region" },
        { key: "address", label: "Çatdırılma ünvanı" },
        {
          key: "requiredDate",
          label: "Tələb olunan tarix",
          type: "date",
          initial: today(),
        },
        {
          key: "visibility",
          label: "Sorğunun görünüşü",
          initial: "open",
          options: [
            { value: "open", label: "Uyğun təchizatçılar" },
            { value: "private", label: "Yalnız seçilən təchizatçı" },
          ],
        },
        {
          key: "invited",
          label: "Təchizatçı (qapalı sorğu üçün)",
          optional: true,
          options: [
            { value: "", label: "Seçilməyib" },
            ...(workspace?.companies
              .filter((c) => c.organizationId !== workspace.organizationId)
              .map((c) => ({ value: c.organizationId, label: c.name })) || []),
          ],
        },
      ],
      documents: "commercial",
      submit: (v, docs) =>
        post("rfqs", {
          ...v,
          files: docs,
          invited: v.invited ? [v.invited] : [],
          lines: chosen.map((i) => ({
            itemId: i.id,
            qty: basket[i.id],
            spec: "",
          })),
        }).then((r) => {
          setBasket({});
          setTab("rfq");
          return r;
        }),
    });
  }
  function lineAction(
    title: string,
    action: string,
    columns: FormSpec["columns"],
    fields: FormSpec["fields"] = [],
    proof = false,
  ) {
    if (!detail) return;
    const lines = detail.case.data.lines;
    open({
      title,
      fields,
      lines,
      columns,
      documents: proof ? "commercial" : undefined,
      submit: (v, docs, rows) =>
        post(`orders/${detail.case.id}/${action}`, {
          ...v,
          proof: docs[0] || "",
          lines: rows
            .map((row, i) => ({ lineId: lines[i].id, ...row }))
            .filter((row) =>
              Object.entries(row).some(
                ([k, val]) => k !== "lineId" && Number(val) > 0,
              ),
            ),
        }),
    });
  }
  async function loginSubmit(e: FormEvent) {
    e.preventDefault();
    const result = await signIn(email, password);
    if (result) setError(result);
    else {
      setPassword("");
      setLogin(false);
      refresh();
    }
  }
  return (
    <div className="market-portal">
      <header className="market-top">
        <Link
          to="/market"
          onClick={() => {
            setTab("catalog");
            setError("");
          }}
          className="market-brand"
        >
          CONSTRIX <span>Market</span>
        </Link>
        <div className="market-actions">
          {signedIn ? (
            <>
              <Select
                ariaLabel="Aktiv şirkət"
                value={orgs.activeId}
                options={orgs.orgs.map((o) => ({ value: o.id, label: o.name }))}
                onValueChange={(id) => {
                  void chooseOrg(id)
                    .then(() => {
                      navigate("/market");
                      refresh();
                    })
                    .catch((e) => setError(e.message));
                }}
              />
              <Link className="btn ghost" to="/">
                ERP-yə keç
              </Link>
              <button type="button" className="btn ghost" onClick={()=>{signOut();setTab('catalog');setBasket({});navigate('/market')}}>Çıxış</button>
            </>
          ) : (
            <button className="btn primary" onClick={() => setLogin(true)}>
              Daxil ol
            </button>
          )}
        </div>
      </header>
      <main className="market-main">
        <PageHead
          title={detail ? detail.case.data.title : "Tikinti üçün açıq bazar"}
          text="Məhsul tapın, qiymət sorğusu göndərin və sifarişi qəbuladək izləyin."
        >
          <button className="btn ghost" onClick={refresh}>
            Yenilə
          </button>
          {commercial && (
            <button className="btn primary" onClick={newRfq}>
              Qiymət sorğusu · {Object.keys(basket).length}
            </button>
          )}
        </PageHead>
        {error && (
          <p role="alert" className="market-error">
            {error}
          </p>
        )}
        {!caseId && (
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { id: "catalog", label: "Kataloq" },
              ...(signedIn
                ? [
                    { id: "rfq", label: "Qiymət sorğuları" },
                    { id: "order", label: "Sifarişlər" },
                    ...(canFinance
                      ? [{ id: "finance", label: "Hesablaşma" }]
                      : []),
                    { id: "company", label: "Şirkət və məhsullar" },
                    ...(workspace?.admin
                      ? [{ id: "moderation", label: "Moderasiya və tariflər" }]
                      : []),
                  ]
                : []),
            ]}
          />
        )}
        {loading || (Boolean(caseId)&&signedIn&&!detail&&!error) ? (
          <p role="status">Məlumatlar yüklənir…</p>
        ) : caseId && detail ? (
          <>
            <Link to="/market" className="market-back">
              ← Siyahıya qayıt
            </Link>
            <div className="market-summary">
              <Status value={detail.case.status} />
              <span>
                {detail.case.region} · {detail.case.category}
              </span>
              <span>
                {detail.case.data.address} · {detail.case.data.requiredDate}
              </span>
            </div>
            <Section title="Məhsullar">
              <div className="market-table-wrap">
                <DataTable>
                  <thead>
                    <tr>
                      <th>Məhsul</th>
                      <th>Miqdar</th>
                      <th>Vahid qiymət</th>
                      <th>ƏDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.case.data.lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.name}
                          <small>{l.spec}</small>
                        </td>
                        <td>
                          {l.qty} {l.unit}
                        </td>
                        <td>{l.unitNet ?? "Qiymət sorğusu"}</td>
                        <td>
                          {l.vatRate === undefined ? "—" : `${l.vatRate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
              {detail.case.data.files.map((id) => (
                <MarketDownload key={id} id={id} />
              ))}
            </Section>
            {detail.case.kind === "rfq" ? (
              <Section title="Təkliflər">
                {commercial &&
                  detail.case.buyerId !== workspace?.organizationId && ['sent','bids'].includes(detail.case.status) && (
                    <button
                      className="btn primary"
                      onClick={() =>
                        open({
                          title: "Təklif göndər",
                          fields: [
                            {
                              key: "validUntil",
                              label: "Etibarlılıq tarixi",
                              type: "date",
                              initial: today(),
                            },
                            { key: "payment", label: "Ödəniş şərti" },
                            numberField("deliveryCost", "Çatdırılma məbləği"),
                            numberField("leadDays", "Təminat müddəti, gün"),
                          ],
                          lines: detail.case.data.lines,
                          columns: [
                            { key: "qty", label: "Təklif miqdarı" },
                            {
                              key: "unitNet",
                              label: "Vahid qiymət",
                              initial: "0",
                            },
                            { key: "vatRate", label: "ƏDV, %", initial: "0" },
                          ],
                          documents: "commercial",
                          submit: (v, docs, rows) =>
                            post(`rfqs/${caseId}/bids`, {
                              ...v,
                              files: docs,
                              lines: rows
                                .map((r, i) => ({
                                  lineId: detail.case.data.lines[i].id,
                                  ...r,
                                  qty: r.qty,
                                }))
                                .filter((r) => Number(r.qty) > 0),
                            }),
                        })
                      }
                    >
                      Təklif göndər
                    </button>
                  )}
                {detail.bids.length === 0 ? (
                  <p>Hələ təklif yoxdur.</p>
                ) : (
                  detail.bids.map((b) => (
                    <article className="market-offer" key={b.id}>
                      <div>
                        <strong>{companyName(b.supplierId)}</strong>
                        <small>
                          Versiya {b.revision} · {b.data.validUntil} ·{" "}
                          {b.data.payment}
                        </small>
                      </div>
                      <ul>
                        {b.data.lines.map((l) => (
                          <li key={l.id}>
                            {l.name} · {l.qty} {l.unit} × {l.unitNet} AZN · ƏDV{" "}
                            {l.vatRate}%
                          </li>
                        ))}
                      </ul>
                      {detail.case.buyerId === workspace?.organizationId &&
                        commercial && ['sent','bids'].includes(detail.case.status) && (
                          <button
                            className="btn primary"
                            onClick={() =>
                              simple(
                                "Təklifdən sifariş yarat",
                                `rfqs/${caseId}/bids/${b.id}/select`,
                              )
                            }
                          >
                            Sifariş yarat
                          </button>
                        )}
                    </article>
                  ))
                )}
              </Section>
            ) : (
              <>
                <Section title="Sifarişin icrası">
                  <div className="market-actions">
                    {commercial &&
                      detail.case.supplierId === workspace?.organizationId &&
                      detail.case.status === "created" && (
                        <button
                          className="btn primary"
                          onClick={() =>
                            simple(
                              "Sifarişi təsdiqlə",
                              `orders/${caseId}/confirm`,
                            )
                          }
                        >
                          Sifarişi təsdiqlə
                        </button>
                      )}
                    {commercial &&
                      detail.case.supplierId === workspace?.organizationId &&
                      ["confirmed", "delivered", "part_received"].includes(
                        detail.case.status,
                      ) && (
                        <button
                          className="btn primary"
                          onClick={() =>
                            lineAction(
                              "Çatdırılmanı qeyd et",
                              "deliveries",
                              [
                                {
                                  key: "qty",
                                  label: "Çatdırılan miqdar",
                                  initial: "0",
                                },
                              ],
                              [],
                              true,
                            )
                          }
                        >
                          Çatdırılma əlavə et
                        </button>
                      )}
                    {detail.case.buyerId === workspace?.organizationId &&
                      ["delivered", "part_received"].includes(
                        detail.case.status,
                      ) && (
                        <button
                          className="btn primary"
                          onClick={() =>
                            lineAction(
                              "Qəbul və mübahisəni qeyd et",
                              "receipts",
                              [
                                {
                                  key: "accepted",
                                  label: "Qəbul",
                                  initial: "0",
                                },
                                {
                                  key: "disputed",
                                  label: "Mübahisə",
                                  initial: "0",
                                },
                              ],
                              [
                                {
                                  key: "projectId",
                                  label: "Layihə",
                                  optional: true,
                                  options: options(workspace?.projects || []),
                                },
                                {
                                  key: "locationId",
                                  label: "Anbar",
                                  optional: true,
                                  options: options(workspace?.locations || []),
                                },
                              ],
                              true,
                            )
                          }
                        >
                          Malı qəbul et
                        </button>
                      )}
                    {commercial &&
                      detail.case.buyerId === workspace?.organizationId &&
                      !detail.case.data.erpLinked && (
                        <button
                          className="btn ghost"
                          onClick={() =>
                            simple(
                              "ERP layihə və anbarına bağla",
                              `orders/${caseId}/erp`,
                              [
                                {
                                  key: "projectId",
                                  label: "Layihə",
                                  options: options(workspace?.projects || []),
                                },
                                {
                                  key: "locationId",
                                  label: "Anbar",
                                  options: options(workspace?.locations || []),
                                },
                              ],
                            )
                          }
                        >
                          ERP-yə bağla
                        </button>
                      )}
                  </div>
                  {detail.case.data.deliveries?.map((d) => (
                    <p key={d.id}>
                      Çatdırılma ·{" "}
                      {d.lines
                        .map(
                          (l) =>
                            `${detail.case.data.lines.find((s) => s.id === l.lineId)?.name}: ${l.qty}`,
                        )
                        .join(", ")}{" "}
                      <MarketDownload id={d.proof} />
                    </p>
                  ))}
                </Section>
                <Section title="Qəbullar və qaytarmalar">
                  {!detail.case.data.receipts?.length && (
                    <p>Qəbul qeydə alınmayıb.</p>
                  )}
                  {detail.case.data.receipts?.map((r) => (
                    <article className="market-offer" key={r.id}>
                      <strong>{r.acceptedAt}</strong>
                      {r.awaitingTariff && (
                        <p className="market-warning">
                          Tarif təyin edilməyib. Hesablaşma gözləyir.
                        </p>
                      )}
                      {r.proof && <MarketDownload id={r.proof} />}
                      <ul>
                        {r.lines.map((l) => (
                          <li key={l.lineId}>
                            {
                              detail.case.data.lines.find(
                                (s) => s.id === l.lineId,
                              )?.name
                            }{" "}
                            · qəbul {l.accepted} · mübahisə {l.disputed}
                            {commercial &&
                              detail.case.buyerId ===
                                workspace?.organizationId &&
                              Number(l.accepted) > 0 && (
                                <button
                                  className="btn ghost"
                                  onClick={() =>
                                    simple(
                                      "Qaytarma tələbi",
                                      `orders/${caseId}/returns`,
                                      [
                                        numberField("qty", "Qaytarılan miqdar"),
                                        { key: "note", label: "Səbəb" },
                                      ],
                                      { receiptId: r.id, lineId: l.lineId },
                                    )
                                  }
                                >
                                  Qaytarma
                                </button>
                              )}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                  {detail.case.data.returns?.map((r) => (
                    <p key={r.id}>
                      Qaytarma · {r.qty} · <Status value={r.status} />
                      {commercial &&
                        detail.case.supplierId === workspace?.organizationId &&
                        r.status === "requested" && (
                          <button
                            className="btn ghost"
                            onClick={() =>
                              simple(
                                "Qaytarılan malın qəbulunu təsdiqlə",
                                `orders/${caseId}/returns/${r.id}/confirm`,
                                [],
                                {},
                                "commercial",
                              )
                            }
                          >
                            Qaytarmanı təsdiqlə
                          </button>
                        )}
                    </p>
                  ))}
                </Section>
                <Section title="Mübahisələr">
                  {!detail.case.data.disputes?.length && (
                    <p>Mübahisə yoxdur.</p>
                  )}
                  {detail.case.data.disputes?.map((d) => (
                    <article className="market-offer" key={d.id}>
                      <strong>
                        {
                          detail.case.data.lines.find((l) => l.id === d.lineId)
                            ?.name
                        }{" "}
                        · {d.qty}
                      </strong>
                      <Status value={d.status} />
                      {d.recommendation && <p>{d.recommendation}</p>}
                      {detail.case.buyerId === workspace?.organizationId &&
                        d.status === "open" && (
                          <button
                            className="btn ghost"
                            onClick={() =>
                              simple(
                                "Mübahisəni həll et",
                                `orders/${caseId}/disputes/${d.id}/resolve`,
                                [
                                  numberField("acceptedQty", "Qəbul edilən"),
                                  numberField("rejectedQty", "Rədd edilən"),
                                  { key: "note", label: "Razılaşmanın qeydi" },
                                ],
                                {},
                                "commercial",
                              )
                            }
                          >
                            Həll et
                          </button>
                        )}
                    </article>
                  ))}
                </Section>
              </>
            )}
            {commercial && (
              <Section title="Yazışma">
                <div className="market-actions">
                  <button
                    className="btn ghost"
                    onClick={() =>
                      simple(
                        "Mesaj göndər",
                        `cases/${caseId}/messages`,
                        [
                          { key: "text", label: "Mesaj" },
                          ...(detail.case.kind === "rfq" &&
                          detail.case.buyerId === workspace?.organizationId
                            ? [
                                {
                                  key: "recipientId",
                                  label: "Təchizatçı",
                                  options: workspace.companies
                                    .filter(
                                      (c) =>
                                        c.organizationId !==
                                        workspace.organizationId,
                                    )
                                    .map((c) => ({
                                      value: c.organizationId,
                                      label: c.name,
                                    })),
                                },
                              ]
                            : []),
                        ],
                        {},
                        "commercial",
                      )
                    }
                  >
                    Mesaj yaz
                  </button>
                </div>
                {detail.messages.map((m) => (
                  <article className="market-message" key={m.id}>
                    <strong>{companyName(m.organizationId)}</strong>
                    <small>
                      {new Date(m.createdAt).toLocaleString("az-AZ")}
                    </small>
                    <p>{m.text}</p>
                    {m.attachments.map((id) => (
                      <MarketDownload key={id} id={id} />
                    ))}
                  </article>
                ))}
              </Section>
            )}
          </>
        ) : tab === "catalog" ? (
          <>
            <div className="market-toolbar">
              <input
                aria-label="Məhsul axtar"
                placeholder="Məhsul, marka və ya kateqoriya axtar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span>{catalog.length} məhsul</span>
            </div>
            <div className="market-catalog">
              {catalog
                .filter((i) =>
                  `${i.name} ${i.brand} ${i.category}`
                    .toLocaleLowerCase("az")
                    .includes(query.toLocaleLowerCase("az")),
                )
                .map((i) => (
                  <article key={i.id} className="market-product">
                    <div>
                      <small>{i.category}</small>
                      <h2>{i.name}</h2>
                      <p>
                        {[i.brand, i.model, i.unit].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div>
                      {i.suppliers.map((s) => (
                        <p key={s.id}>
                          <strong>{s.name}</strong> · {s.region}
                          <small>
                            {s.availability}
                            {s.quantity
                              ? ` · təxmini ${s.quantity} ${i.unit}`
                              : ""}
                            {s.leadDays != null ? ` · ${s.leadDays} gün` : ""}
                          </small>
                        </p>
                      ))}
                      {!i.suppliers.length && <p>Aktiv təchizatçı yoxdur.</p>}
                    </div>
                    {commercial && (
                      <Field label="Sorğu miqdarı">
                        <input
                          aria-label={`${i.name} sorğu miqdarı`}
                          type="number"
                          min="0"
                          step="0.001"
                          value={basket[i.id] || ""}
                          onChange={(e) =>
                            setBasket((old) => {
                              const next = { ...old };
                              if (Number(e.target.value) > 0)
                                next[i.id] = e.target.value;
                              else delete next[i.id];
                              return next;
                            })
                          }
                        />
                      </Field>
                    )}
                  </article>
                ))}
            </div>
            {!catalog.length && (
              <Empty
                title="Kataloq hələ boşdur"
                text="Moderasiya edilmiş məhsullar burada görünəcək."
              />
            )}
          </>
        ) : ["rfq", "order"].includes(tab) ? (
          <div className="market-table-wrap">
            <DataTable>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Region</th>
                  <th>Məhsul</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/market/cases/${c.id}`}>{c.data.title}</Link>
                      <small>
                        {c.buyerId === workspace?.organizationId
                          ? "Alıcı"
                          : "Təchizatçı"}
                      </small>
                    </td>
                    <td>{c.region}</td>
                    <td>{c.data.lines.length} sətir</td>
                    <td>
                      <Status value={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {!cases.length && (
              <Empty
                title="Hələ sənəd yoxdur"
                text="Yeni sorğular və sifarişlər bu siyahıda görünəcək."
              />
            )}
          </div>
        ) : tab === "company" && workspace ? (
          <>
            <Section title="Şirkətin bazar profili">
              <div className="market-actions">
                <strong>
                  {workspace.company?.name || "Qeydiyyat tamamlanmayıb"}
                </strong>
                {workspace.company && (
                  <Status value={workspace.company.status} />
                )}
                <button
                  className="btn primary"
                  onClick={() =>
                    open({
                      title: "Şirkət qeydiyyatı",
                      fields: [
                        {
                          key: "name",
                          label: "Hüquqi ad",
                          initial: workspace.company?.name,
                        },
                        {
                          key: "voen",
                          label: "VÖEN · 10 rəqəm",
                          initial: workspace.company?.voen,
                        },
                        {
                          key: "region",
                          label: "Region",
                          initial: workspace.company?.region,
                        },
                      ],
                      documents: "commercial",
                      submit: (v, documents) =>
                        post("company", { ...v, documents }),
                    })
                  }
                >
                  Profili doldur
                </button>
              </div>
              {workspace.company?.reason && <p>{workspace.company.reason}</p>}
            </Section>
            <Section title="Məhsullarım">
              <button
                className="btn primary"
                onClick={() =>
                  open({
                    title: "Məhsul təklif et",
                    fields: [
                      { key: "name", label: "Məhsul adı" },
                      { key: "category", label: "Kateqoriya" },
                      { key: "unit", label: "Ölçü vahidi" },
                      { key: "brand", label: "Marka", optional: true },
                      { key: "model", label: "Model", optional: true },
                      {
                        key: "manufacturer",
                        label: "İstehsalçı",
                        optional: true,
                      },
                      { key: "origin", label: "Mənşə ölkəsi", optional: true },
                    ],
                    documents: "certificate",
                    submit: (v, documents) =>
                      post("items", { ...v, documents, attributes: {} }),
                  })
                }
              >
                Yeni məhsul
              </button>
              {workspace.items.map((i) => (
                <p key={i.id}>
                  {i.name} · <Status value={i.status} /> {i.reason}
                </p>
              ))}
              <h3>Kataloqda təchizatçı kimi görün</h3>
              <button
                className="btn ghost"
                onClick={() =>
                  open({
                    title: "Mövcudluq elanı",
                    fields: [
                      {
                        key: "itemId",
                        label: "Məhsul",
                        options: catalog.map((i) => ({
                          value: i.id,
                          label: i.name,
                        })),
                      },
                      { key: "region", label: "Region" },
                      { key: "availability", label: "Mövcudluq qeydi" },
                      numberField("quantity", "Təxmini miqdar"),
                      numberField("leadDays", "Təminat müddəti, gün"),
                    ],
                    submit: (v) => post(`items/${v.itemId}/listing`, v),
                  })
                }
              >
                Elan əlavə et / yenilə
              </button>
            </Section>
            {workspace.seat === "direktor" && (
              <Section title="Qəbul icazələri">
                <button
                  className="btn ghost"
                  onClick={() =>
                    simple("Qəbul icazəsi", "acceptance-grants", [
                      {
                        key: "accountId",
                        label: "Əməkdaş",
                        options: workspace.members.map((m) => ({
                          value: m.accountId,
                          label: `${m.account.name} · ${m.seat}`,
                        })),
                      },
                      {
                        key: "projectId",
                        label: "Layihə",
                        options: options(workspace.projects),
                        optional: true,
                      },
                      {
                        key: "locationId",
                        label: "Anbar",
                        options: options(workspace.locations),
                        optional: true,
                      },
                      numberField("limit", "Məbləğ limiti, AZN"),
                      {
                        key: "active",
                        label: "Vəziyyət",
                        initial: "true",
                        options: [
                          { value: "true", label: "Aktiv" },
                          { value: "false", label: "Bağlı" },
                        ],
                      },
                    ])
                  }
                >
                  İcazə təyin et
                </button>
                {workspace.grants.map((g) => (
                  <p key={g.id}>
                    {
                      workspace.members.find((m) => m.accountId === g.accountId)
                        ?.account.name
                    }{" "}
                    · {g.limit} AZN · {g.active ? "Aktiv" : "Bağlı"}
                  </p>
                ))}
              </Section>
            )}
          </>
        ) : tab === "finance" && finance ? (
          <>
            <Section title="Aylıq hesab">
              <input
                aria-label="Hesablaşma ayı"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              <p>
                {finance.statement.month} · qalıq {finance.statement.balance}{" "}
                AZN
              </p>
            </Section>
            <Section title="Komissiya borcları">
              <DataTable>
                <thead>
                  <tr>
                    <th>Qəbul tarixi</th>
                    <th>Son tarix</th>
                    <th>Komissiya</th>
                    <th>Ödənilib</th>
                    <th>Qalıq</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {finance.charges.map((c) => (
                    <tr key={c.id}>
                      <td>{c.acceptedAt}</td>
                      <td>{c.dueAt}</td>
                      <td>
                        {c.amount} AZN<small>Düzəliş: {c.credit}</small>
                      </td>
                      <td>{c.paid}</td>
                      <td>{c.balance}</td>
                      <td>
                        <Status value={c.stage} />
                      </td>
                      <td>
                        {Number(c.balance) > 0 && (
                          <button
                            className="btn ghost"
                            onClick={() =>
                              simple(
                                "Bank ödənişi üçün qəbz göndər",
                                `charges/${c.id}/payments`,
                                [numberField("amount", "Məbləğ")],
                                {},
                                "commercial",
                              )
                            }
                          >
                            Qəbz əlavə et
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Section>
            <Section title="Ödəniş yoxlamaları">
              {finance.payments.map((p) => (
                <p key={p.id}>
                  {p.amount} AZN · <Status value={p.status} />{" "}
                  <MarketDownload id={p.proof} />
                </p>
              ))}
            </Section>
          </>
        ) : tab === "moderation" && moderation && settings ? (
          <>
            <Section title="Şirkətlər">
              {moderation.companies.map((c) => (
                <article className="market-offer" key={c.organizationId}>
                  <strong>
                    {c.name} · {c.voen}
                  </strong>
                  {c.documents.map((id) => (
                    <MarketDownload key={id} id={id} />
                  ))}
                  <button
                    className="btn ghost"
                    onClick={() =>
                      simple(
                        "Şirkəti yoxla",
                        `moderation/company/${c.organizationId}`,
                        [
                          {
                            key: "status",
                            label: "Qərar",
                            initial: "approved",
                            options: [
                              "approved",
                              "changes",
                              "rejected",
                              "suspended",
                            ].map((value) => ({ value, label: labels[value] })),
                          },
                          { key: "reason", label: "Səbəb", optional: true },
                        ],
                      )
                    }
                  >
                    Yoxla
                  </button>
                </article>
              ))}
            </Section>
            <Section title="Məhsullar">
              {moderation.items.map((i) => (
                <article className="market-offer" key={i.id}>
                  <strong>
                    {i.name} · {i.unit}
                  </strong>
                  {i.documents.map((id) => (
                    <MarketDownload key={id} id={id} />
                  ))}
                  <button
                    className="btn ghost"
                    onClick={() =>
                      simple("Məhsulu yoxla", `moderation/item/${i.id}`, [
                        {
                          key: "status",
                          label: "Qərar",
                          initial: "approved",
                          options: ["approved", "changes", "rejected"].map(
                            (value) => ({ value, label: labels[value] }),
                          ),
                        },
                        { key: "reason", label: "Səbəb", optional: true },
                      ])
                    }
                  >
                    Yoxla
                  </button>
                </article>
              ))}
            </Section>
            <Section title="Bank ödənişləri">
              {moderation.payments.map((p) => (
                <article className="market-offer" key={p.id}>
                  {p.amount} AZN <MarketDownload id={p.proof} />
                  <button
                    className="btn ghost"
                    onClick={() =>
                      open({
                        title: "Bank qəbzini yoxla",
                        fields: [
                          {
                            key: "accepted",
                            label: "Qərar",
                            initial: "true",
                            options: [
                              {
                                value: "true",
                                label: "Ödəniş bankda təsdiqləndi",
                              },
                              { value: "false", label: "Rədd et" },
                            ],
                          },
                          { key: "note", label: "Yoxlama qeydi" },
                        ],
                        submit: (v) =>
                          post(`payments/${p.id}/review`, {
                            ...v,
                            accepted: v.accepted === "true",
                          }),
                      })
                    }
                  >
                    Yoxla
                  </button>
                </article>
              ))}
            </Section>
            <Section title="Tariflər">
              <button
                className="btn primary"
                onClick={() =>
                  simple("Komissiya tarifi", "tariffs", [
                    {
                      key: "side",
                      label: "Tərəf",
                      initial: "buyer",
                      options: [
                        { value: "buyer", label: "Alıcı" },
                        { value: "supplier", label: "Təchizatçı" },
                      ],
                    },
                    {
                      key: "scope",
                      label: "Prioritet",
                      initial: "default",
                      options: [
                        { value: "contract", label: "Müqavilə" },
                        { value: "company", label: "Şirkət" },
                        { value: "category", label: "Kateqoriya" },
                        { value: "default", label: "Standart" },
                      ],
                    },
                    {
                      key: "target",
                      label: "Obyekt ID / kateqoriya (standart üçün boş)",
                      optional: true,
                    },
                    {
                      key: "basis",
                      label: "Hesablama bazası",
                      initial: "net",
                      options: [
                        { value: "net", label: "ƏDV xaric" },
                        { value: "gross", label: "ƏDV daxil" },
                      ],
                    },
                    numberField("rate", "Faiz"),
                    {
                      key: "effectiveFrom",
                      label: "Qüvvəyə minmə",
                      type: "date",
                      initial: today(),
                    },
                    {
                      key: "effectiveTo",
                      label: "Son tarix",
                      type: "date",
                      optional: true,
                    },
                  ])
                }
              >
                Tarif təyin et
              </button>
              {settings.tariffs.map((t) => (
                <p key={t.id}>
                  {t.side} · {t.scope} · {t.target} · {t.rate}% ·{" "}
                  {t.effectiveFrom}–{t.effectiveTo || "∞"}
                </p>
              ))}
            </Section>
            <Section title="Borc və sənəd qaydaları">
              <p>Son ödəniş: {settings.policy.dueDays} gün · xəbərdarlıq: {settings.policy.warnDays} gün · yeni əməliyyat məhdudiyyəti: {settings.policy.restrictDays} gün.</p>
              <button className="btn ghost" onClick={()=>open({title:'Borc qaydaları',fields:[numberField('dueDays','Son ödəniş, gün',String(settings.policy.dueDays)),numberField('warnDays','Xəbərdarlıq, gün',String(settings.policy.warnDays)),numberField('restrictDays','Məhdudiyyət, gün',String(settings.policy.restrictDays)),{key:'categories',label:'Qəbul sənədi məcburi kateqoriyalar · vergüllə ayırın',optional:true,initial:settings.policy.requiredProofCategories.join(', ')}],submit:v=>post('policy',{...v,requiredProofCategories:v.categories.split(',').map(s=>s.trim()).filter(Boolean)})})}>Qaydaları dəyiş</button>
            </Section>
          </>
        ) : null}
      </main>
      {form && (
        <ActionForm
          spec={form}
          onClose={() => setForm(null)}
          onDone={refresh}
        />
      )}
      {login && (
        <Modal title="Market-ə daxil ol" onClose={() => setLogin(false)}>
          <form className="market-form" onSubmit={loginSubmit}>
            <Field label="E-poçt">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Şifrə">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button className="btn primary">Daxil ol</button>
            <Link to="/">Yeni hesab və şirkət yarat</Link>
          </form>
        </Modal>
      )}
    </div>
  );
}
