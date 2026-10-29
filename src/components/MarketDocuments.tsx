import { useEffect, useState } from "react";
import { api } from "../api";

export type MarketFile = {
  id: string;
  name: string;
  kind: string;
  version: number;
  scanStatus: string;
  scanNote: string;
};
export function MarketDocuments({
  value,
  onChange,
  kind = "commercial",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  kind?: string;
}) {
  const [files, setFiles] = useState<MarketFile[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<MarketFile[]>("/api/blob-files")
      .then((rows) => {
        if (active) setFiles(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const row = await api<MarketFile>("/api/blob-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name),
          "x-file-kind": kind,
          "x-upload-key": crypto.randomUUID(),
        },
        body: file,
      });
      setFiles((old) => [row, ...old]);
      if (row.scanStatus === "clean") onChange([...value, row.id]);
      else setError(row.scanNote);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fayl yüklənmədi");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="market-documents">
      <label className="market-upload">
        {busy ? "Yoxlanılır…" : "Sənəd yüklə · maksimum 20 MB"}
        <input
          type="file"
          disabled={busy}
          accept=".pdf,.xlsx,.xls,.docx,.png,.jpg,.jpeg,.webp,.txt,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="market-error">
          {error}
        </p>
      )}
      <div>
        {files
          .filter((f) => f.kind === kind)
          .map((file) => (
            <label key={file.id} className="market-file">
              <input
                type="checkbox"
                disabled={file.scanStatus !== "clean" || busy}
                checked={value.includes(file.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, file.id]
                      : value.filter((id) => id !== file.id),
                  )
                }
              />
              <span>
                {file.name} · v{file.version}
                <small>
                  {file.scanStatus === "clean" ? "Yoxlanılıb" : file.scanNote}
                </small>
              </span>
            </label>
          ))}
      </div>
    </div>
  );
}
export function MarketDownload({
  id,
  label = "Sənədi yüklə",
}: {
  id: string;
  label?: string;
}) {
  return (
    <a
      className="market-download"
      href={`/api/blob-files/${encodeURIComponent(id)}/download`}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}
