import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";

interface StateProps {
  title?: string;
  message?: string;
  compact?: boolean;
}

const container = (compact: boolean) =>
  `flex flex-col items-center justify-center text-center rounded-lg border border-line bg-white ${
    compact ? "px-4 py-8" : "px-6 py-14 shadow-card"
  }`;

export function LoadingState({
  title = "กำลังโหลดข้อมูล",
  message = "กรุณารอสักครู่",
  compact = false,
}: StateProps) {
  return (
    <div className={container(compact)} role="status" aria-live="polite">
      <LoaderCircle className="mb-3 h-7 w-7 animate-spin text-crimson" />
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-faint">{message}</p>
    </div>
  );
}

export function EmptyState({
  title = "ยังไม่มีข้อมูลที่เผยแพร่",
  message = "เมื่อมีข้อมูลที่พร้อมเผยแพร่ รายการจะแสดงที่นี่",
  compact = false,
}: StateProps) {
  return (
    <div className={container(compact)}>
      <Inbox className="mb-3 h-7 w-7 text-faint" />
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-faint">{message}</p>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: ApiError;
  onRetry: () => void;
  compact?: boolean;
}) {
  const notFound = error.status === 404;
  return (
    <div className={container(compact)} role="alert">
      <AlertCircle className="mb-3 h-7 w-7 text-crimson" />
      <h2 className="font-semibold text-ink">
        {notFound ? "ไม่พบข้อมูลที่เผยแพร่" : "ไม่สามารถโหลดข้อมูลได้"}
      </h2>
      <p className="mt-1 text-sm text-faint">
        {notFound
          ? "รายการนี้อาจไม่มีอยู่หรือยังไม่ได้รับอนุญาตให้เผยแพร่"
          : "โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"}
      </p>
      <button className="btn btn-outline mt-4 gap-2" onClick={onRetry} type="button">
        <RefreshCw className="h-4 w-4" />
        ลองอีกครั้ง
      </button>
    </div>
  );
}
