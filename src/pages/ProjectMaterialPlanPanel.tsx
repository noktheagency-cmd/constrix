import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api, ApiError } from "../api";
import { Button, Input } from "../components/primitives";
import { useStore } from "../store";
type DraftLine = {
  materialId: string;
  unit: string;
  sourceKind: string;
  sourceRef: string;
  smetaLineId: string;
  qty: string;
  coefficient: string;
};
type Source = {
  materials: { id: string; name: string; unit: string }[];
  smetas: {
    id: string;
    version: number;
    status: string;
    lines: {
      id: string;
      name: string;
      kind: string;
      unit: string;
      qty: string;
    }[];
  }[];
};
type Plan = {
  id: string;
  version: number;
  status: string;
  reference: string;
  createdBy: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  lines: (DraftLine & { name: string })[];
};
type Report = {
  plan: Plan | null;
  plans: Plan[];
  sourceChanged: boolean;
  unmatchedReceiptLines: string[];
  items: {
    materialId: string;
    name: string;
    unit: string;
    planned: string;
    accepted: string;
    returned: string;
    transferNet: string;
    supplied: string;
    remaining: string;
    excess: string;
    consumed: string;
    unplanned: boolean;
  }[];
};
const empty = (): DraftLine => ({
  materialId: "",
  unit: "",
  sourceKind: "qrp",
  sourceRef: "",
  smetaLineId: "",
  qty: "",
  coefficient: "1",
});
const statuses: Record<string, string> = {
  pending: "Təsdiq gözləyir",
  approved: "Qüvvədədir",
  superseded: "Əvvəlki versiya",
  rejected: "Rədd edilib",
};
export function ProjectMaterialPlanPanel() {
  const { actor } = useStore(),
    canWrite = ["director", "pm", "site"].includes(actor.role);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]),
    [projectId, setProjectId] = useState(""),
    [sources, setSources] = useState<Source>({ materials: [], smetas: [] }),
    [report, setReport] = useState<Report | null>(null),
    [rows, setRows] = useState<DraftLine[]>([empty()]),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [smetaId, setSmetaId] = useState(""),
    [loaded, setLoaded] = useState("");
  useEffect(() => {
    void api<{ id: string; name: string }[]>("/api/project-material-plans")
      .then(setProjects)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Layihələr yüklənmədi"),
      );
  }, []);
  useEffect(() => {
    let active = true;
    setReport(null);
    setLoaded("");
    setRows([empty()]);
    setSources({ materials: [], smetas: [] });
    setSmetaId("");
    setReference("");
    setError("");
    if (projectId)
      void Promise.all([
        api<Source>(`/api/project-material-plans/${projectId}/sources`),
        api<Report>(`/api/project-material-plans/${projectId}`),
      ])
        .then(([s, r]) => {
          if (active) {
            setSources(s);
            setReport(r);
            setLoaded(projectId);
          }
        })
        .catch((e) => {
          if (active)
            setError(e instanceof ApiError ? e.message : "Məlumat yüklənmədi");
        });
    return () => {
      active = false;
    };
  }, [projectId]);
  async function reload() {
    setReport(await api<Report>(`/api/project-material-plans/${projectId}`));
  }
  async function post(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/project-material-plans/${projectId}${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Əməliyyat alınmadı");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function update(i: number, patch: Partial<DraftLine>) {
    setRows((old) => old.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }
  function smetaRows() {
    const smeta = sources.smetas.find((s) => s.id === smetaId);
    if (!smeta) return;
    const lines = smeta.lines.filter((l) => l.kind === "material");
    if (!lines.length) {
      setError(
        "Bu smetada material tipli sətir yoxdur. İş həcmi üçün mühəndis hesabı seçin.",
      );
      return;
    }
    setRows(
      lines.map((l) => {
        const matches = sources.materials.filter(
          (m) => m.name.trim() === l.name.trim() && m.unit === l.unit,
        );
        return {
          materialId: matches.length === 1 ? matches[0].id : "",
          unit: matches.length === 1 ? matches[0].unit : l.unit,
          sourceKind: "smeta",
          sourceRef: `Smeta v${smeta.version} / ${l.id}`,
          smetaLineId: l.id,
          qty: l.qty,
          coefficient: "1",
        };
      }),
    );
    setReference(`Smeta v${smeta.version}`);
    setError(
      lines.some(
        (l) =>
          sources.materials.filter(
            (m) => m.name.trim() === l.name.trim() && m.unit === l.unit,
          ).length !== 1,
      )
        ? "Material uyğunluğu olmayan sətirləri kataloqla uyğunlaşdırın."
        : "",
    );
  }
  async function importFile(file: File) {
    setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw Error("Fayl 10 MB-dan böyükdür");
      const buffer = await file.arrayBuffer(),
        book = XLSX.read(buffer, { type: "array" });
      const sheetName = book.SheetNames[0];
      const entries = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        book.Sheets[sheetName],
        { raw: false, defval: "" },
      );
      if (!entries.length || entries.length > 500)
        throw Error("İlk vərəqdə 1–500 sətir olmalıdır");
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const imported = entries.map((r, i) => {
        const m = sources.materials.find(
          (m) => m.id === String(r.materialId || "").trim(),
        );
        if (
          !m ||
          !String(r.qty || "").match(/^\d+(\.\d{1,3})?$/) ||
          String(r.unit || "").trim() !== m.unit
        )
          throw Error(
            `${i + 2}-ci sətirdə materialId, qty və unit uyğun deyil`,
          );
        const sourceKind = String(r.sourceKind || "qrp");
        const coefficient = String(r.coefficient || "1");
        if (
          !["qrp", "engineer"].includes(sourceKind) ||
          !/^\d+(\.\d{1,6})?$/.test(coefficient) ||
          Number(coefficient) <= 0
        )
          throw Error(`${i + 2}-ci sətirdə mənbə/əmsal düzgün deyil`);
        return {
          ...empty(),
          sourceKind,
          coefficient,
          materialId: m.id,
          unit: m.unit,
          qty: String(r.qty),
          sourceRef: `${String(r.sourceRef || "row " + (i + 2)).slice(0, 80)} / SHA256:${hash}`,
        };
      });
      setRows(imported);
      setReference(`${file.name.slice(0, 100)} / SHA256:${hash}`);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fayl oxunmadı");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h2>Layihə üzrə material planı və təminat</h2>
      <label>
        Layihə
        <select
          value={projectId}
          disabled={busy}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Layihə seçin</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {projectId && loaded === projectId && (
        <>
          {canWrite && (
            <details>
              <summary>Yeni plan versiyası hazırla</summary>
              <p>
                Smeta materialını birbaşa götürün; iş həcmindən hesab üçün
                mühəndis mənbəsi və material/iş əmsalı seçin. QRP/Excel ilk
                vərəqinin sütunları: materialId, qty, unit, sourceRef; əlavə
                olaraq sourceKind (qrp/engineer), coefficient. Miqdarda onluq
                ayırıcı nöqtədir. İdxal mövcud formanın sətirlərini əvəz edir.
              </p>
              <label>
                Smeta versiyası
                <select
                  value={smetaId}
                  onChange={(e) => setSmetaId(e.target.value)}
                >
                  <option value="">Smeta seçin</option>
                  {sources.smetas.map((s) => (
                    <option key={s.id} value={s.id}>
                      v{s.version} · {s.status}
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={busy || !smetaId} onClick={smetaRows}>
                Material sətirlərindən plan yarat
              </Button>
              <label>
                QRP / mühəndis hesabı faylı
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <p>
                Kataloqda material ID-si uyğunlaşdırma üçün istifadə olunur.
              </p>
              <label>
                Mənbə sənədinin istinadı
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>Material / vahid</th>
                      <th>Mənbə</th>
                      <th>Smeta iş/material sətri</th>
                      <th>Mənbə həcmi</th>
                      <th>Əmsal</th>
                      <th>İstinad</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <select
                            value={r.materialId}
                            onChange={(e) =>
                              update(i, {
                                materialId: e.target.value,
                                unit:
                                  sources.materials.find(
                                    (m) => m.id === e.target.value,
                                  )?.unit || "",
                              })
                            }
                          >
                            <option value="">Material seçin</option>
                            {sources.materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} · {m.unit} · {m.id}
                              </option>
                            ))}
                          </select>
                          <span>{r.unit}</span>
                        </td>
                        <td>
                          <select
                            value={r.sourceKind}
                            onChange={(e) =>
                              update(i, {
                                sourceKind: e.target.value,
                                smetaLineId: "",
                                coefficient: "1",
                              })
                            }
                          >
                            <option value="smeta">Smeta materialı</option>
                            <option value="qrp">QRP</option>
                            <option value="engineer">Mühəndis hesabı</option>
                          </select>
                        </td>
                        <td>
                          <select
                            disabled={r.sourceKind === "qrp"}
                            value={r.smetaLineId}
                            onChange={(e) => {
                              const l = sources.smetas
                                .flatMap((s) => s.lines)
                                .find((l) => l.id === e.target.value);
                              update(i, {
                                smetaLineId: e.target.value,
                                qty: l?.qty || "",
                              });
                            }}
                          >
                            <option value="">Sərbəst hesab həcmi</option>
                            {sources.smetas.flatMap((s) =>
                              s.lines.map((l) => (
                                <option key={l.id} value={l.id}>
                                  v{s.version} · {l.name} · {l.qty} {l.unit}
                                </option>
                              )),
                            )}
                          </select>
                        </td>
                        <td>
                          <Input
                            aria-label={`Mənbə həcmi ${i + 1}`}
                            disabled={!!r.smetaLineId}
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={r.qty}
                            onChange={(e) => update(i, { qty: e.target.value })}
                          />
                        </td>
                        <td>
                          <Input
                            aria-label={`Əmsal ${i + 1}`}
                            disabled={r.sourceKind !== "engineer"}
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            value={r.coefficient}
                            onChange={(e) =>
                              update(i, { coefficient: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <Input
                            aria-label={`Mənbə istinadı ${i + 1}`}
                            value={r.sourceRef}
                            onChange={(e) =>
                              update(i, { sourceRef: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              setRows((old) => old.filter((_, n) => n !== i))
                            }
                          >
                            Sil
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                disabled={busy || rows.length >= 500}
                onClick={() => setRows((old) => [...old, empty()])}
              >
                Sətir əlavə et
              </Button>
              <Button
                disabled={
                  busy ||
                  !reference.trim() ||
                  !rows.length ||
                  rows.some(
                    (r) => !r.materialId || !r.sourceRef.trim() || !r.qty,
                  )
                }
                onClick={() =>
                  void post("", { reference, lines: rows }).then((ok) => {
                    if (ok) {
                      setRows([empty()]);
                      setReference("");
                    }
                  })
                }
              >
                Planı təsdiqə göndər
              </Button>
            </details>
          )}
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void reload()
                .catch((e) =>
                  setError(e instanceof Error ? e.message : "Hesabat alınmadı"),
                )
                .finally(() => setBusy(false));
            }}
          >
            Uzlaşmanı yenilə
          </Button>
          {!report?.plan && (
            <p>
              Təsdiqlənmiş plan yoxdur. Qəbul və sərfiyyat göstəriciləri məlumat
              üçündür.
            </p>
          )}
          {report?.plan && (
            <p>
              Qüvvədə olan plan: v{report.plan.version} ·{" "}
              {report.plan.reference} · {report.plan.reviewedBy}
            </p>
          )}
          {report?.sourceChanged && (
            <p role="alert" className="form-error">
              Smeta mənbəsi dəyişib. Yeni plan versiyası hazırlanmalıdır;
              təsdiqli tarixçə saxlanılıb.
            </p>
          )}
          {!!report?.unmatchedReceiptLines.length && (
            <p role="alert" className="form-error">
              Material/vahid uyğunlaşdırması tələb edən qəbul sətri:{" "}
              {report.unmatchedReceiptLines.length}
            </p>
          )}
          <p>
            Qalan təminat ehtiyacı = plan − faktiki qəbul + göndərilmiş supplier
            qaytarması − layihələrarası xalis transfer. Mübahisəli qəbul təminat
            sayılmır. Sərfiyyat ayrıca göstəricidir.
          </p>
          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {[
                    "Material",
                    "Vahid",
                    "Plan",
                    "Qəbul",
                    "Supplier-ə qaytarılıb",
                    "Transfer xalis",
                    "Təmin edilib",
                    "Qalan ehtiyac",
                    "Artıq təminat",
                    "Təsdiqli sərfiyyat",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report?.items.map((r) => (
                  <tr key={r.materialId}>
                    <td>
                      {r.name}
                      {r.unplanned ? " · plansız" : ""}
                    </td>
                    {[
                      r.unit,
                      r.planned,
                      r.accepted,
                      r.returned,
                      r.transferNet,
                      r.supplied,
                      r.remaining,
                      r.excess,
                      r.consumed,
                    ].map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report?.plans.map((p) => (
            <details key={p.id}>
              <summary>
                v{p.version} · {statuses[p.status] || p.status} · {p.reference}
              </summary>
              <p>
                Hazırlayan: {p.createdBy} · Baxış: {p.reviewedBy || "—"} ·{" "}
                {p.reviewNote}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Plan miqdarı</th>
                    <th>Əmsal</th>
                    <th>Mənbə</th>
                  </tr>
                </thead>
                <tbody>
                  {p.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.name}</td>
                      <td>
                        {l.qty} {l.unit}
                      </td>
                      <td>{l.coefficient}</td>
                      <td>
                        {l.sourceKind} · {l.sourceRef}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {actor.role === "director" && p.status === "pending" && (
                <div>
                  <label>
                    Qərarın əsası
                    <Input
                      value={notes[p.id] || ""}
                      onChange={(e) =>
                        setNotes({ ...notes, [p.id]: e.target.value })
                      }
                    />
                  </label>
                  {["approve", "reject"].map((decision) => (
                    <Button
                      key={decision}
                      disabled={busy || (notes[p.id] || "").trim().length < 3}
                      onClick={() =>
                        void post(`/${p.id}/review`, {
                          decision,
                          note: notes[p.id],
                        })
                      }
                    >
                      {decision === "approve" ? "Planı təsdiqlə" : "Rədd et"}
                    </Button>
                  ))}
                </div>
              )}
            </details>
          ))}
        </>
      )}
    </section>
  );
}
