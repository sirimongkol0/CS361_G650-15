"use client";

// Account page for every signed-in role: the account from GET /auth/me and a
// password change (POST /auth/change-password, checked by Amazon Cognito).
// Roles live in Cognito groups, so they are not editable here.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, Mail, Shield } from "lucide-react";
import { ApiError, apiErrorMessage, apiPost } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { AccessState, LoadingState } from "@/components/data-states";
import { Field, Notice, inputCls, useAction } from "@/components/form-ui";
import { useDocumentTitle } from "@/lib/list-tools";

const POLICY_HINT = "อย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข";

/** Problem with the new password that the browser can see before asking the server. */
function passwordProblem(current: string, next: string, confirm: string): string | null {
  if (!current || !next || !confirm) return "กรุณากรอกให้ครบทุกช่อง";
  if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
    return `รหัสผ่านใหม่ต้องมี${POLICY_HINT}`;
  }
  if (next !== confirm) return "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน";
  if (next === current) return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม";
  return null;
}

function changePasswordMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return "รหัสผ่านเดิมไม่ถูกต้อง";
    if (error.status === 422) return `รหัสผ่านใหม่ต้องมี${POLICY_HINT}`;
    if (error.status === 429) return "ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
  }
  return apiErrorMessage(error);
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const local = passwordProblem(current, next, confirm);
    setProblem(local);
    if (local) return;
    const ok = await action.run(() => apiPost("/auth/change-password", { current_password: current, new_password: next }));
    if (ok) {
      setCurrent(""); setNext(""); setConfirm("");
      setNotice("เปลี่ยนรหัสผ่านแล้ว ใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป");
    } else {
      setProblem(null);
    }
  };

  const shown = problem ?? (action.error ? changePasswordMessage(action.error) : null);

  return (
    <form onSubmit={submit} className="max-w-md" noValidate>
      <Notice text={notice} />
      {shown && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{shown}</p>
      )}
      <Field label="รหัสผ่านเดิม">
        <input className={inputCls} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="รหัสผ่านใหม่" hint={POLICY_HINT}>
        <input className={inputCls} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="ยืนยันรหัสผ่านใหม่">
        <input className={inputCls} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary mt-1 gap-2" disabled={action.busy}>
        <KeyRound className="w-4 h-4" />
        เปลี่ยนรหัสผ่าน
      </button>
    </form>
  );
}

export default function SettingsPage() {
  useDocumentTitle("ตั้งค่าบัญชี");
  const { user, config, status, role } = useRole();

  if (status === "loading") return <div className="p-6"><LoadingState /></div>;
  if (status !== "authenticated" || !user) return <div className="p-6"><AccessState status={401} /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
          <Link href="/" className="text-faint hover:text-crimson">หน้าหลัก</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-crimson">ตั้งค่าบัญชี</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink font-display">ตั้งค่าบัญชี</h1>
        <p className="text-sm mt-0.5 text-faint">ข้อมูลบัญชีที่ใช้เข้าสู่ระบบ</p>
      </div>

      <div className="rounded-lg bg-white shadow-card p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-line">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold uppercase"
            style={{ background: config.pillBg, color: config.pillColor }}
          >
            {user.email[0]}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-ink truncate">{user.email}</div>
            <span className="badge mt-1" style={{ background: config.pillBg, color: config.pillColor }}>{config.label}</span>
          </div>
        </div>

        <dl className="grid sm:grid-cols-2 gap-5">
          <div>
            <dt className="flex items-center gap-1.5 text-sm font-semibold mb-1 text-mute"><Mail className="w-4 h-4" />อีเมล</dt>
            <dd className="text-sm text-ink break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-sm font-semibold mb-1 text-mute"><Shield className="w-4 h-4" />บทบาท</dt>
            <dd className="text-sm text-ink">{config.label}</dd>
          </div>
        </dl>

        <p className="mt-6 rounded-lg bg-soft border border-line px-4 py-3 text-sm text-mute">
          {role === "admin"
            ? "บทบาทของแต่ละบัญชีกำหนดที่ Amazon Cognito ดูรายชื่อบัญชีทั้งหมดได้ที่หน้าผู้ใช้และสิทธิ์"
            : "หากต้องการเปลี่ยนบทบาท กรุณาติดต่อผู้ดูแลระบบ"}
        </p>
      </div>

      <div className="rounded-lg bg-white shadow-card p-6">
        <h2 className="font-bold text-base mb-4 text-ink">เปลี่ยนรหัสผ่าน</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
