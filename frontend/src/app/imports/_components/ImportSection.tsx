"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  apiErrorMessage,
  apiGetFresh,
  apiPost,
  apiUpload,
  ApiError,
} from "@/lib/api";

import { downloadFile } from "@/lib/download-file";

type ImportKind = "feedback" | "outcome";

type ImportStatus =
  | "processing"
  | "previewed"
  | "committed"
  | "rolled_back"
  | "failed";

type PreviewRow = Record<string, string | number | null>;

interface ImportBatch {
  id: number;
  kind: ImportKind;
  sourceCode: string | null;
  fileName: string;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number | null;
    message: string;
  }>;
  previewData?: PreviewRow[];
  createdAt: string | null;
  committedAt: string | null;
  rolledBackAt: string | null;
}

const statusLabels: Record<ImportStatus, string> = {
  processing: "กำลังตรวจสอบไฟล์",
  previewed: "ตรวจสอบแล้ว / รอยืนยัน",
  committed: "นำเข้าแล้ว",
  rolled_back: "ยกเลิกแล้ว",
  failed: "ประมวลผลไม่สำเร็จ",
};

const kindLabels: Record<ImportKind, string> = {
  feedback: "ความคิดเห็น",
  outcome: "ผลลัพธ์",
};

const card =
  "rounded-lg border border-line bg-white p-5 shadow-card";

const control =
  "rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/10";

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 415) {
    return "รองรับเฉพาะไฟล์ .csv และ .xlsx";
  }

  return error instanceof ApiError
    ? error.message
    : apiErrorMessage(error);
}

function thaiDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("th-TH");
}

export default function ImportSection() {
  const [kind, setKind] = useState<ImportKind>("feedback");
  const [file, setFile] = useState<File | null>(null);

  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selected, setSelected] = useState<ImportBatch | null>(null);

  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const rows = await apiGetFresh<ImportBatch[]>("/imports/");
    setBatches(rows);
  }, []);

  const loadBatch = useCallback(async (id: number) => {
    const row = await apiGetFresh<ImportBatch>(`/imports/${id}`);

    setSelected(row);

    return row;
  }, []);

  useEffect(() => {
    void loadHistory().catch((error) => {
      setPageError(errorText(error));
    });
  }, [loadHistory]);

  // Poll เฉพาะชุดนำเข้าที่กำลัง processing
  useEffect(() => {
    if (!selected || selected.status !== "processing") {
      return;
    }

    const timer = window.setInterval(() => {
      void loadBatch(selected.id)
        .then((latest) => {
          if (latest.status !== "processing") {
            void loadHistory().catch(() => undefined);

            setNotice(
              latest.status === "previewed"
                ? "ตรวจสอบไฟล์เสร็จแล้ว กรุณาตรวจผลก่อนยืนยัน"
                : null
            );
          }
        })
        .catch((error) => {
          setPageError(errorText(error));
        });
    }, 1500);

    return () => window.clearInterval(timer);
  }, [selected, loadBatch, loadHistory]);

  const upload = async () => {
    if (!file) return;

    setBusy(true);
    setPageError(null);
    setNotice(null);

    try {
      const created = await apiUpload<ImportBatch>(
        `/imports/?kind=${kind}`,
        file,
        "file",
        "POST"
      );

      setSelected(created);
      setFile(null);

      const picker = document.getElementById(
        "import-file"
      ) as HTMLInputElement | null;

      if (picker) picker.value = "";

      await loadHistory();

      setNotice(
        "รับไฟล์แล้ว ระบบกำลังตรวจสอบข้อมูลในเบื้องหลัง"
      );
    } catch (error) {
      setPageError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!selected) return;

    setBusy(true);
    setPageError(null);

    try {
      const updated = await apiPost<ImportBatch>(
        `/imports/${selected.id}/commit`
      );

      setSelected(updated);
      await loadHistory();

      setNotice("นำเข้าข้อมูลที่ผ่านการตรวจสอบแล้วเรียบร้อย");
    } catch (error) {
      setPageError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (
      !selected ||
      !window.confirm(
        "ยืนยันยกเลิกชุดนำเข้านี้หรือไม่? หากนำเข้าแล้ว ระบบจะลบเฉพาะข้อมูลที่มาจากชุดนี้"
      )
    ) {
      return;
    }

    setBusy(true);
    setPageError(null);

    try {
      const updated = await apiPost<ImportBatch>(
        `/imports/${selected.id}/rollback`
      );

      setSelected(updated);
      await loadHistory();

      setNotice("ยกเลิกชุดนำเข้าเรียบร้อยแล้ว");
    } catch (error) {
      setPageError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async (path: string) => {
    setPageError(null);

    try {
      await downloadFile(path);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "ดาวน์โหลดไฟล์ไม่สำเร็จ"
      );
    }
  };

  return (
    <div className="space-y-5">

      {pageError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {pageError}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      {/* Upload and Template */}
      <section className={`${card}`}>
        <div className="mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-crimson" />
          <h2 className="font-semibold text-ink">
            นำเข้าไฟล์จากระบบสหกิจศึกษา
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">

          <label className="grid gap-1 text-sm text-mute">
            ประเภทข้อมูล

            <select
              className={control}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as ImportKind)
              }
            >
              <option value="feedback">
                ความคิดเห็น (Feedback)
              </option>

              <option value="outcome">
                ผลลัพธ์ (Outcomes)
              </option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-mute">
            เลือกไฟล์ CSV หรือ XLSX

            <input
              id="import-file"
              className={control}
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) =>
                setFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <button
            type="button"
            className="btn btn-primary flex items-center justify-center gap-2"
            disabled={!file || busy}
            onClick={() => void upload()}
          >
            <Upload className="h-4 w-4" />

            {busy ? "กำลังดำเนินการ…" : "อัปโหลดและตรวจสอบ"}
          </button>
        </div>

        <p className="mt-2 text-xs text-faint">
          ไฟล์ไม่เกิน 10 MB • ระบบจะตรวจทุกแถวก่อนบันทึกจริง
          และไม่เก็บชื่อ อีเมล หรือรหัสนักศึกษาไว้ใน Preview
        </p>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <span className="mr-1 self-center text-xs font-semibold text-faint">
            ดาวน์โหลดไฟล์:
          </span>

          {(["feedback", "outcome"] as ImportKind[]).map((item) => (
            <div
              key={item}
              className="flex flex-wrap items-center gap-1"
            >
              <span className="self-center text-xs text-mute">
                {kindLabels[item]}
              </span>

              {(["csv", "xlsx"] as const).map((format) => (
                <button
                  key={`${item}-${format}`}
                  type="button"
                  className="btn btn-outline px-2 py-1 text-xs"
                  onClick={() =>
                    void downloadTemplate(
                      `/imports/templates/${item}?format=${format}`
                    )
                  }
                >
                  <Download className="mr-1 inline h-3 w-3" />
                  Template {format.toUpperCase()}
                </button>
              ))}

              <button
                type="button"
                className="btn btn-ghost px-2 py-1 text-xs"
                onClick={() =>
                  void downloadTemplate(
                    `/imports/templates/${item}?format=csv&sample=true`
                  )
                }
              >
                ตัวอย่างสมมติ
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Import History and Preview */}
      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">

        <div className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">
              ประวัติชุดนำเข้า
            </h2>

            <button
              type="button"
              className="rounded p-1 text-faint hover:bg-soft"
              aria-label="รีเฟรชประวัติ"
              onClick={() =>
                void loadHistory().catch((error) =>
                  setPageError(errorText(error))
                )
              }
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {batches.length === 0 && (
              <p className="py-6 text-center text-sm text-faint">
                ยังไม่มีประวัติการนำเข้า
              </p>
            )}

            {batches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  void loadBatch(item.id).catch((error) =>
                    setPageError(errorText(error))
                  )
                }
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selected?.id === item.id
                    ? "border-crimson bg-crimson/5"
                    : "border-line hover:bg-soft"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">
                    #{item.id} · {kindLabels[item.kind]}
                  </span>

                  <span className="text-[11px] text-faint">
                    {statusLabels[item.status]}
                  </span>
                </div>

                <p className="mt-1 truncate text-xs text-mute">
                  {item.fileName}
                </p>

                <p className="mt-1 text-[11px] text-faint">
                  {thaiDate(item.createdAt)} · ผ่าน {item.validRows} / {item.totalRows} แถว
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className={card}>
          {!selected ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center text-faint">
              <FileSpreadsheet className="mb-2 h-8 w-8" />
              <p className="text-sm">
                เลือกชุดนำเข้าจากประวัติเพื่อดูผลการตรวจสอบ
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink">
                    ชุดนำเข้า #{selected.id} · {kindLabels[selected.kind]}
                  </h2>

                  <p className="mt-1 text-xs text-faint">
                    {selected.fileName} · {statusLabels[selected.status]}
                  </p>
                </div>

                <div className="flex gap-2">
                  {selected.status === "previewed" &&
                    selected.validRows > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void commit()}
                      >
                        <CheckCircle2 className="mr-1 inline h-4 w-4" />
                        ยืนยันนำเข้า ({selected.validRows})
                      </button>
                    )}

                  {(["previewed", "committed"] as ImportStatus[]).includes(
                    selected.status
                  ) && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => void rollback()}
                    >
                      <XCircle className="mr-1 inline h-4 w-4" />
                      ยกเลิกชุดนี้
                    </button>
                  )}
                </div>
              </div>

              {selected.status === "processing" ? (
                <div className="rounded-md bg-soft p-4 text-sm text-mute">
                  ระบบกำลังอ่านไฟล์และตรวจสอบแต่ละแถว
                  หน้านี้จะอัปเดตผลให้อัตโนมัติ
                </div>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-soft p-3">
                      <div className="text-xl font-bold text-ink">
                        {selected.totalRows}
                      </div>
                      <div className="text-xs text-faint">แถวทั้งหมด</div>
                    </div>

                    <div className="rounded-md bg-green-50 p-3">
                      <div className="text-xl font-bold text-green-700">
                        {selected.validRows}
                      </div>
                      <div className="text-xs text-green-700">ผ่าน</div>
                    </div>

                    <div className="rounded-md bg-red-50 p-3">
                      <div className="text-xl font-bold text-red-700">
                        {selected.invalidRows}
                      </div>
                      <div className="text-xs text-red-700">ไม่ผ่าน</div>
                    </div>
                  </div>

                  {selected.errors.length > 0 && (
                    <div className="mb-4">
                      <h3 className="mb-2 text-sm font-semibold text-red-800">
                        แถวที่ไม่ผ่านและเหตุผล
                      </h3>

                      <div className="max-h-52 overflow-auto rounded-md border border-red-100">
                        {selected.errors.map((item, index) => (
                          <div
                            key={`${item.row}-${index}`}
                            className="border-b border-red-100 px-3 py-2 text-xs last:border-0"
                          >
                            <span className="font-semibold text-red-800">
                              {item.row ? `แถว ${item.row}` : "ไฟล์"}:
                            </span>{" "}

                            <span className="text-mute">
                              {item.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h3 className="mb-2 text-sm font-semibold text-ink">
                    ข้อมูลที่ผ่านการตรวจสอบ (ตัวอย่างก่อนบันทึก)
                  </h3>

                  {selected.previewData?.length ? (
                    <div className="max-h-80 overflow-auto rounded-md border border-line">
                      {selected.previewData.map((row, index) => (
                        <div
                          key={String(row.external_id ?? index)}
                          className="border-b border-line p-3 text-xs last:border-0"
                        >
                          <div className="mb-1 font-semibold text-ink">
                            {index + 1}. {String(row.title ?? "(ไม่มีชื่อ)")}{" "}
                            <span className="font-normal text-faint">
                              · {String(row.external_id ?? "")}
                            </span>
                          </div>

                          <pre className="whitespace-pre-wrap break-all text-[11px] text-mute">
                            {JSON.stringify(row, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md bg-soft p-3 text-sm text-faint">
                      ไม่มีแถวที่ผ่านการตรวจสอบ
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}