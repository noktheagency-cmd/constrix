import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { Button, Input } from "../components/primitives";
type Req = {
  id: string;
  projectId: string;
  project: string;
  materialId: string;
  material: string;
  unit: string;
  qty: string;
  allocations: { locationId: string; qty: string }[];
  reservedQty: string;
  fulfilledQty: string;
  status: string;
  author: string;
  date: string;
  text: string | null;
  priority: string;
  requiredOn: string | null;
  updatedAt: string;
  expectedIncoming: string;
  decision: string | null;
};
type Candidate = {
  locationId: string;
  locationName: string;
  projectId: string | null;
  physical: string;
  reserved: string;
  transferHeld: string;
  custodyHeld: string;
  returnHeld: string;
  free: string;
};
type Board = {
  requests: Req[];
  projects: { id: string; name: string; status: string }[];
  materials: { id: string; name: string; unit: string }[];
  availability: Record<string, Candidate[]>;
  plans: Record<
    string,
    {
      approved: boolean;
      sourceChanged: boolean;
      items: { materialId: string; remaining: string; planned: string }[];
    }
  >;
  limit: number;
};
type Edit = {
  materialId: string;
  qty: string;
  text: string;
  priority: string;
  requiredOn: string;
  allocation: Record<string, string> | null;
};
type Result = { id: string; ok: boolean; message: string; replayed?: boolean };
const priorityLabels: Record<string, string> = {
  normal: "Adi",
  urgent: "Təcili",
  critical: "Kritik",
};
const statusLabels: Record<string, string> = {
  gozleyir: "Gözləyir",
  teklif: "Təklif mərhələsi",
  tesdiq: "Təsdiqlənib",
  qaytarildi: "Düzəlişə qaytarılıb",
  redd: "Rədd edilib",
  anbar: "Anbardan verilib",
  sifaris: "Sifarişdədir",
};
const pending = (r: Req) => ["gozleyir", "teklif"].includes(r.status);
export function DirectorRequestPanel() {
  const [board, setBoard] = useState<Board | null>(null),
    [edits, setEdits] = useState<Record<string, Edit>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [results, setResults] = useState<Result[]>([]),
    [expanded, setExpanded] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const [filter, setFilter] = useState({
    project: "",
    status: "pending",
    priority: "",
    author: "",
    from: "",
    to: "",
  });
  const keys = useRef(new Map<string, string>());
  async function load() {
    const data = await api<Board>("/api/request-workflows/board");
    setBoard(data);
    return data;
  }
  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : "Rəhbər paneli yüklənmədi"),
    );
  }, []);
  const edit = (r: Req): Edit =>
    edits[r.id] || {
      materialId: r.materialId,
      qty: r.qty,
      text: r.text || "",
      priority: r.priority,
      requiredOn: r.requiredOn || "",
      allocation: pending(r)
        ? null
        : Object.fromEntries(
            (r.allocations || []).map((a) => [a.locationId, a.qty]),
          ),
    };
  function change(r: Req, patch: Partial<Edit>) {
    setEdits((old) => ({ ...old, [r.id]: { ...edit(r), ...patch } }));
  }
  function eligible(r: Req, c: Candidate) {
    return !c.projectId || c.projectId === r.projectId;
  }
  function propose(r: Req) {
    let left = Number(edit(r).qty);
    const allocation: Record<string, string> = {};
    for (const c of [...(board?.availability[edit(r).materialId] || [])]
      .filter((c) => eligible(r, c))
      .sort((a, b) => Number(b.free) - Number(a.free))) {
      const qty = Math.min(left, Number(c.free));
      if (qty > 0) {
        allocation[c.locationId] = String(Math.round(qty * 1000) / 1000);
        left -= qty;
      }
    }
    change(r, { allocation });
  }
  async function decide(ids: string[], decision: string) {
    if (!board || !ids.length) return;
    setBusy(true);
    setError("");
    try {
      const qtyById: Record<string, string> = {},
        editsById: Record<string, unknown> = {},
        allocationsById: Record<string, unknown> = {};
      for (const id of ids) {
        const r = board.requests.find((r) => r.id === id);
        if (!r) continue;
        const e = edit(r);
        qtyById[id] = e.qty;
        editsById[id] = {
          materialId: e.materialId,
          text: e.text,
          priority: e.priority,
          requiredOn: e.requiredOn,
          expectedUpdatedAt: r.updatedAt,
        };
        if (e.allocation !== null)
          allocationsById[id] = Object.entries(e.allocation)
            .filter(([, qty]) => qty !== "" && qty !== "0")
            .map(([locationId, qty]) => ({ locationId, qty }));
      }
      const body = {
          ids,
          decision,
          reason,
          qtyById,
          editsById,
          allocationsById,
        },
        signature = JSON.stringify(body);
      let key = keys.current.get(signature);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(signature, key);
      }
      const response = await api<{ results: Result[] }>(
        "/api/request-workflows/decision",
        { method: "POST", body: JSON.stringify({ ...body, key }) },
      );
      keys.current.delete(signature);
      setResults(response.results);
      const failed = response.results.filter((r) => !r.ok).map((r) => r.id);
      setSelected(failed);
      setExpanded(failed[0] || "");
      setReason("");
      setEdits((old) => {
        const next = { ...old };
        response.results.filter((r) => r.ok).forEach((r) => delete next[r.id]);
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Qərar saxlanmadı");
    } finally {
      setBusy(false);
    }
  }
  if (!board) return <p role="status">{error || "Rəhbər paneli yüklənir…"}</p>;
  const rows = board.requests.filter(
    (r) =>
      (!filter.project || r.projectId === filter.project) &&
      (filter.status === "all" ||
        (filter.status === "pending" && pending(r)) ||
        r.status === filter.status) &&
      (!filter.priority || r.priority === filter.priority) &&
      (!filter.author ||
        r.author
          .toLocaleLowerCase()
          .includes(filter.author.toLocaleLowerCase())) &&
      (!filter.from || r.date >= filter.from) &&
      (!filter.to || r.date <= filter.to),
  );
  const failures = results.filter((r) => !r.ok);
  return (
    <section className="space-y-4">
      <h2>Rəhbər sifariş paneli</h2>
      <p>
        Təsdiq fiziki stoku dəyişmir; bölgü rezerv yaradır. Təmin olunmayan
        hissə satınalma gözləyir. Başqa layihədən təminat ayrıca səbəbli və
        imzalı transferlə aparılır.
      </p>
      <div className="form">
        <label>
          Layihə
          <select
            value={filter.project}
            disabled={busy}
            onChange={(e) => setFilter({ ...filter, project: e.target.value })}
          >
            <option value="">Bütün layihələr</option>
            {board.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="all">Hamısı</option>
            <option value="pending">Təsdiq gözləyənlər</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Təcililik
          <select
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          >
            <option value="">Hamısı</option>
            {Object.entries(priorityLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tələb edən
          <Input
            value={filter.author}
            onChange={(e) => setFilter({ ...filter, author: e.target.value })}
          />
        </label>
        <label>
          Tarixdən
          <Input
            type="date"
            value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })}
          />
        </label>
        <label>
          Tarixədək
          <Input
            type="date"
            value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })}
          />
        </label>
      </div>
      <div>
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void load()
              .then(() => {
                setEdits({});
                setResults([]);
                setSelected([]);
              })
              .catch((e) =>
                setError(e instanceof Error ? e.message : "Panel yüklənmədi"),
              )
              .finally(() => setBusy(false));
          }}
        >
          Paneli yenilə
        </Button>
        <Button
          disabled={busy || !rows.some(pending)}
          onClick={() => setSelected(rows.filter(pending).map((r) => r.id))}
        >
          Görünən açıq sifarişləri seç
        </Button>
        <Button
          disabled={busy || !selected.length}
          onClick={() =>
            void decide(
              selected.filter((id) =>
                rows.some((r) => r.id === id && pending(r)),
              ),
              "approve",
            )
          }
        >
          Seçilənləri təsdiqlə (
          {
            selected.filter((id) => rows.some((r) => r.id === id && pending(r)))
              .length
          }
          )
        </Button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <p role="status">
          {results.filter((r) => r.ok).length} uğurlu · {failures.length}{" "}
          problemli
        </p>
      )}
      {failures.length > 0 && (
        <section className="border rounded p-3">
          <h3>Problemli sifarişlər</h3>
          <p>
            Bu sifarişlər təsdiqlənmədi; qeyd olunan səbəbi düzəldib ayrıca
            yenidən baxın.
          </p>
          {failures.map((f) => (
            <p key={f.id}>
              <Button
                onClick={() => {
                  setExpanded(f.id);
                  setReason("");
                  setFilter({
                    ...filter,
                    project: "",
                    status: "all",
                    priority: "",
                    author: "",
                    from: "",
                    to: "",
                  });
                }}
              >
                {f.id}
              </Button>{" "}
              {f.message}
            </p>
          ))}
        </section>
      )}
      <p>
        Göstərilən: {rows.length} · Son {board.limit} sifariş
      </p>
      <div className="overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Seç</th>
              <th>Sifariş / tarix</th>
              <th>Layihə / sifarişçi</th>
              <th>Material / miqdar</th>
              <th>Təcililik / status</th>
              <th>Sərbəst / rezerv</th>
              <th>Gözlənilən mədaxil</th>
              <th>Bölgü</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const e = edit(r),
                cs = board.availability[e.materialId] || [],
                free = cs
                  .filter((c) => eligible(r, c))
                  .reduce((n, c) => n + Number(c.free), 0),
                reserved = cs.reduce((n, c) => n + Number(c.reserved), 0);
              const chosen =
                e.allocation === null
                  ? null
                  : Object.values(e.allocation).reduce(
                      (n, q) => n + Number(q || 0),
                      0,
                    );
              return (
                <tr key={r.id}>
                  <td>
                    {pending(r) && (
                      <input
                        aria-label={`${r.id} seç`}
                        type="checkbox"
                        disabled={busy}
                        checked={selected.includes(r.id)}
                        onChange={(ev) =>
                          setSelected((old) =>
                            ev.target.checked
                              ? [...old, r.id]
                              : old.filter((id) => id !== r.id),
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <Button
                      onClick={() => {
                        setExpanded(expanded === r.id ? "" : r.id);
                        setReason("");
                      }}
                    >
                      {r.id}
                    </Button>
                    <p>{r.date}</p>
                  </td>
                  <td>
                    {r.project}
                    <p>{r.author}</p>
                  </td>
                  <td>
                    {r.material}
                    <p>
                      {r.qty} {r.unit}
                    </p>
                  </td>
                  <td>
                    {priorityLabels[r.priority] || r.priority}
                    <p>{statusLabels[r.status] || r.status}</p>
                  </td>
                  <td>
                    {free.toFixed(3)} / {reserved.toFixed(3)}
                  </td>
                  <td>
                    {r.expectedIncoming} {r.unit}
                  </td>
                  <td>
                    {!pending(r)
                      ? `${r.reservedQty || "0"} rezerv · ${Math.max(0, Number(r.qty) - Number(r.fulfilledQty || 0) - Number(r.reservedQty || 0)).toFixed(3)} təminat gözləyir`
                      : chosen === null
                        ? "Avtomatik təklif"
                        : `${chosen.toFixed(3)} rezerv · ${Math.max(0, Number(e.qty) - chosen).toFixed(3)} satınalma`}
                    <p>{r.decision}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>Filtrlərə uyğun sifariş yoxdur.</p>}
      {board.requests
        .filter((r) => r.id === expanded)
        .map((r) => {
          const e = edit(r),
            canEdit = pending(r),
            material = board.materials.find((m) => m.id === e.materialId);
          return (
            <article key={r.id} className="border rounded p-4">
              <h3>
                {r.id} · {r.project}
              </h3>
              <div className="form">
                <label>
                  Material
                  <select
                    disabled={busy || !canEdit}
                    value={e.materialId}
                    onChange={(ev) =>
                      change(r, {
                        materialId: ev.target.value,
                        allocation: null,
                      })
                    }
                  >
                    {board.materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Təsdiq miqdarı
                  <Input
                    disabled={busy || !canEdit}
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={e.qty}
                    onChange={(ev) =>
                      change(r, { qty: ev.target.value, allocation: null })
                    }
                  />
                </label>
                <label>
                  Təcililik
                  <select
                    disabled={busy || !canEdit}
                    value={e.priority}
                    onChange={(ev) => change(r, { priority: ev.target.value })}
                  >
                    {Object.entries(priorityLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lazım olan tarix
                  <Input
                    disabled={busy || !canEdit}
                    type="date"
                    value={e.requiredOn}
                    onChange={(ev) =>
                      change(r, { requiredOn: ev.target.value })
                    }
                  />
                </label>
                <label>
                  Qeyd
                  <Input
                    disabled={busy || !canEdit}
                    value={e.text}
                    onChange={(ev) => change(r, { text: ev.target.value })}
                  />
                </label>
              </div>
              <h4>Təminat bölgüsü · {material?.unit || r.unit}</h4>
              <Button disabled={busy || !canEdit} onClick={() => propose(r)}>
                Sərbəst qalıqdan bölgü təklif et
              </Button>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      {[
                        "Anbar",
                        "Layihə",
                        "Fiziki",
                        "Rezerv",
                        "Transferdə",
                        "Məsulda",
                        "Qaytarma",
                        "Sərbəst",
                        "Mənbə layihənin qalan ehtiyacı",
                        "Seçilmiş bölgü",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(board.availability[e.materialId] || []).map((c) => {
                      const plan = c.projectId
                          ? board.plans[c.projectId]
                          : null,
                        need = plan?.items.find(
                          (i) => i.materialId === e.materialId,
                        );
                      return (
                        <tr key={c.locationId}>
                          <td>{c.locationName}</td>
                          <td>
                            {board.projects.find((p) => p.id === c.projectId)
                              ?.name || "Ümumi anbar"}
                          </td>
                          {[
                            c.physical,
                            c.reserved,
                            c.transferHeld,
                            c.custodyHeld,
                            c.returnHeld,
                            c.free,
                          ].map((v, i) => (
                            <td key={i}>{v}</td>
                          ))}
                          <td>
                            {plan?.approved
                              ? `${need?.remaining || "0"}${plan.sourceChanged ? " · mənbə dəyişib" : ""}`
                              : c.projectId
                                ? "Təsdiqli plan yoxdur"
                                : "—"}
                          </td>
                          <td>
                            {eligible(r, c) ? (
                              <Input
                                aria-label={`${r.id} ${c.locationName} bölgü`}
                                disabled={busy || !canEdit}
                                type="number"
                                min="0"
                                step="0.001"
                                value={e.allocation?.[c.locationId] || ""}
                                onChange={(ev) =>
                                  change(r, {
                                    allocation: {
                                      ...(e.allocation || {}),
                                      [c.locationId]: ev.target.value,
                                    },
                                  })
                                }
                              />
                            ) : (
                              <span>
                                Ayrıca layihələrarası transfer tələb olunur
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Link to="/anbar?tab=transfer">İmzalı transfer sənədləri</Link>
              {canEdit && (
                <>
                  <label>
                    Qərarın səbəbi
                    <Input
                      value={reason}
                      onChange={(ev) => setReason(ev.target.value)}
                    />
                  </label>
                  <div>
                    {["approve", "return", "reject"].map((d) => (
                      <Button
                        key={d}
                        disabled={busy || (d !== "approve" && !reason.trim())}
                        onClick={() => void decide([r.id], d)}
                      >
                        {d === "approve"
                          ? "Fərdi təsdiqlə"
                          : d === "return"
                            ? "Düzəlişə qaytar"
                            : "Rədd et"}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </article>
          );
        })}
    </section>
  );
}
