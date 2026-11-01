import { useStore } from "../store";
import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Button, Input } from "../components/primitives";
type Loc = {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  responsibleAccountId: string | null;
  projectId?: string | null;
};
type Line = {
  materialId: string;
  name: string;
  unit: string;
  expected: string;
  counted: string;
};
type Doc = {
  id: string;
  locationId: string;
  status: string;
  reason: string;
  documentRef: string;
  createdBy: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  lines: Line[];
};
type Overview = {
  projects: { id: string; name: string }[];
  locations: Loc[];
  members: { accountId: string; name: string }[];
  counts: Doc[];
  materials: { id: string; name: string; unit: string }[];
};
const kinds: Record<string, string> = {
  merkez: "Mərkəzi anbar",
  layihe: "Layihə anbarı",
  sahe: "Sahə anbarı",
  muveqqeti: "Müvəqqəti saxlama",
  zavod: "Zavod",
  sex: "Sex",
};
export function WarehouseControlPanel({
  view,
  director,
}: {
  view: "structure" | "inventory";
  director: boolean;
}) {
  const { reload: reloadBooks } = useStore();
  const [data, setData] = useState<Overview>({
      projects: [],
      locations: [],
      members: [],
      counts: [],
      materials: [],
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [loc, setLoc] = useState({
      id: "",
      name: "",
      kind: "merkez",
      parentId: "",
      responsibleAccountId: "",
      projectId: "",
    }),
    [locationId, setLocationId] = useState(""),
    [reason, setReason] = useState(""),
    [documentRef, setDocumentRef] = useState(""),
    [quantities, setQuantities] = useState<Record<string, string>>({}),
    [notes, setNotes] = useState<Record<string, string>>({});
  async function reload() {
    try {
      setData(await api<Overview>("/api/warehouse-control"));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Məlumat yüklənmədi");
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  async function post(path: string, body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/warehouse-control/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await reload();
      reloadBooks();
      setMessage("Sənəd qeydə alındı");
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Əməliyyat tamamlanmadı");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function path(id: string) {
    const names: string[] = [],
      seen = new Set<string>();
    let row = data.locations.find((l) => l.id === id);
    while (row && !seen.has(row.id)) {
      seen.add(row.id);
      names.unshift(row.name);
      row = data.locations.find((l) => l.id === row!.parentId);
    }
    return names.join(" / ");
  }
  return (
    <section className="space-y-4">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {view === "structure" ? (
        <>
          <h2>Anbar iyerarxiyası və məsul şəxs</h2>
          {director && (
            <div className="form">
              <label>
                Anbarın redaktəsi
                <select
                  value={loc.id}
                  onChange={(e) => {
                    const row = data.locations.find(
                      (l) => l.id === e.target.value,
                    );
                    setLoc(
                      row
                        ? {
                            id: row.id,
                            name: row.name,
                            kind: row.kind,
                            parentId: row.parentId || "",
                            responsibleAccountId:
                              row.responsibleAccountId || "",
                            projectId: row.projectId || "",
                          }
                        : {
                            id: "",
                            name: "",
                            kind: "merkez",
                            parentId: "",
                            responsibleAccountId: "",
                            projectId: "",
                          },
                    );
                  }}
                >
                  <option value="">Yeni anbar</option>
                  {data.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {path(l.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ad
                <Input
                  value={loc.name}
                  onChange={(e) => setLoc({ ...loc, name: e.target.value })}
                />
              </label>
              <label>
                Layihə
                <select
                  value={loc.projectId}
                  disabled={!!loc.id}
                  onChange={(e) =>
                    setLoc({ ...loc, projectId: e.target.value })
                  }
                >
                  <option value="">Ümumi / üst anbardan</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Növ
                <select
                  value={loc.kind}
                  onChange={(e) => setLoc({ ...loc, kind: e.target.value })}
                >
                  {Object.entries(kinds).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Üst anbar
                <select
                  value={loc.parentId}
                  onChange={(e) => setLoc({ ...loc, parentId: e.target.value })}
                >
                  <option value="">Kök səviyyə</option>
                  {data.locations
                    .filter((l) => l.id !== loc.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {path(l.id)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Anbar məsulu
                <select
                  value={loc.responsibleAccountId}
                  onChange={(e) =>
                    setLoc({ ...loc, responsibleAccountId: e.target.value })
                  }
                >
                  <option value="">Məsul seçin</option>
                  {data.members.map((m) => (
                    <option key={m.accountId} value={m.accountId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                disabled={busy || !loc.name.trim() || !loc.responsibleAccountId}
                onClick={() => void post("locations", loc)}
              >
                Yadda saxla
              </Button>
            </div>
          )}
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Anbar yolu</th>
                <th>Növ</th>
                <th>Məsul</th>
              </tr>
            </thead>
            <tbody>
              {data.locations.map((l) => (
                <tr key={l.id}>
                  <td>{path(l.id)}</td>
                  <td>{kinds[l.kind] || l.kind}</td>
                  <td>
                    {data.members.find(
                      (m) => m.accountId === l.responsibleAccountId,
                    )?.name || "Təyin edilməyib"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <h2>İnventarizasiya — sayım və təsdiqli düzəliş</h2>
          <p>
            Sayılmış materialları daxil edin. Boş sətirlər sayımın əhatəsinə
            daxil edilmir. Göndərmə qalığı dəyişmir; başqa direktorun təsdiqi
            tələb olunur.
          </p>
          <div className="form">
            <label>
              Anbar
              <select
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setQuantities({});
                }}
              >
                <option value="">Anbar seçin</option>
                {data.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {path(l.id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Səbəb
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              Sayım aktı / sənəd istinadı
              <Input
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
              />
            </label>
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Faktiki sayılmış miqdar</th>
                </tr>
              </thead>
              <tbody>
                {data.materials.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.name} ({m.unit})
                    </td>
                    <td>
                      <Input
                        aria-label={`${m.name} sayılmış miqdar`}
                        type="number"
                        min="0"
                        step="0.001"
                        value={quantities[m.id] ?? ""}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            [m.id]: e.target.value,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              disabled={
                busy ||
                !locationId ||
                reason.trim().length < 3 ||
                !documentRef.trim() ||
                !Object.values(quantities).some((q) => q !== "")
              }
              onClick={() => {
                void post("counts", {
                  locationId,
                  reason,
                  documentRef,
                  lines: Object.entries(quantities)
                    .filter(([, q]) => q !== "")
                    .map(([materialId, counted]) => ({ materialId, counted })),
                }).then((ok) => {
                  if (ok) {
                    setQuantities({});
                    setReason("");
                    setDocumentRef("");
                  }
                });
              }}
            >
              Sayımı təsdiqə göndər
            </Button>
          </div>
          {data.counts.map((d) => (
            <article className="border rounded p-4" key={d.id}>
              <b>
                {path(d.locationId)} · {d.documentRef}
              </b>
              <p>
                {(
                  {
                    pending: "Təsdiq gözləyir",
                    approved: "Təsdiqlənib",
                    rejected: "Rədd edilib",
                  } as Record<string, string>
                )[d.status] || d.status}{" "}
                · {d.createdBy} · {d.reason}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Sistem qalığı</th>
                    <th>Sayılıb</th>
                    <th>Fərq</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.materialId}>
                      <td>
                        {l.name} ({l.unit})
                      </td>
                      <td>{l.expected}</td>
                      <td>{l.counted}</td>
                      <td>
                        {(Number(l.counted) - Number(l.expected)).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.reviewedBy && (
                <p>
                  {d.reviewedBy}: {d.reviewNote}
                </p>
              )}
              {director && d.status === "pending" && (
                <div>
                  <label>
                    Qərarın əsası
                    <Input
                      value={notes[d.id] || ""}
                      onChange={(e) =>
                        setNotes({ ...notes, [d.id]: e.target.value })
                      }
                    />
                  </label>
                  {(["approve", "reject"] as const).map((decision) => (
                    <Button
                      key={decision}
                      disabled={busy || (notes[d.id] || "").trim().length < 3}
                      onClick={() =>
                        void post(`counts/${d.id}/review`, {
                          decision,
                          note: notes[d.id],
                        })
                      }
                    >
                      {decision === "approve" ? "Fərqi təsdiqlə" : "Rədd et"}
                    </Button>
                  ))}
                </div>
              )}
            </article>
          ))}
          {!data.counts.length && <p>Sayım sənədi yoxdur.</p>}
        </>
      )}
    </section>
  );
}
