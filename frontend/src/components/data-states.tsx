import Link from "next/link";
import { AlertCircle, Inbox, LoaderCircle, Lock, LogIn, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";

interface StateProps {
  title?: string;
  message?: string;
  compact?: boolean;
}

const container = (compact: boolean) =>
  `flex flex-col items-center justify-center text-center rounded-base bg-white ${
    compact ? "border border-line px-4 py-8" : "px-6 py-14 shadow-card"
  }`;

export function LoadingState({
  title = "กำลังโหลด…",
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
  title = "ยังไม่มีข้อมูล",
  message = "ข้อมูลจะแสดงที่นี่เมื่อเผยแพร่แล้ว",
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
  if (error.status === 401 || error.status === 403) return <AccessState status={error.status} compact={compact} />;
  const notFound = error.status === 404;
  return (
    <div className={container(compact)} role="alert">
      <AlertCircle className="mb-3 h-7 w-7 text-crimson" />
      <h2 className="font-semibold text-ink">
        {notFound ? "ไม่พบรายการนี้" : "โหลดข้อมูลไม่สำเร็จ"}
      </h2>
      <p className="mt-1 text-sm text-faint">
        {notFound
          ? "รายการนี้อาจยังไม่เผยแพร่หรือลบไปแล้ว"
          : "กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"}
      </p>
      <button className="btn btn-outline mt-4 gap-2" onClick={onRetry} type="button">
        <RefreshCw className="h-4 w-4" />
        ลองอีกครั้ง
      </button>
    </div>
  );
}

/** 401 -> ask to log in (and come back here); 403 -> the role may not see this. */
export function AccessState({ status, compact = false }: { status: 401 | 403; compact?: boolean }) {
  const login = status === 401;
  const next = typeof window === "undefined" ? "/" : window.location.pathname;
  return (
    <div className={container(compact)} role="alert">
      <Lock className="mb-3 h-7 w-7 text-crimson" />
      <h2 className="font-semibold text-ink">{login ? "กรุณาเข้าสู่ระบบ" : "ไม่มีสิทธิ์เข้าถึง"}</h2>
      <p className="mt-1 text-sm text-faint">
        {login
          ? "ต้องเข้าสู่ระบบก่อนจึงจะดูข้อมูลส่วนนี้ได้"
          : "บทบาทนี้ดูข้อมูลส่วนนี้ไม่ได้ หากคิดว่าไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ"}
      </p>
      {login && (
        <Link className="btn btn-primary mt-4 gap-2" href={`/login?next=${encodeURIComponent(next)}`}>
          <LogIn className="h-4 w-4" />
          เข้าสู่ระบบ
        </Link>
      )}
    </div>
  );
}
