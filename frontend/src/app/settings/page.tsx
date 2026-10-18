"use client";

// Account page for every signed-in role: shows the account from GET /auth/me.
// Password, name and role are kept in Amazon Cognito, so nothing here is editable.

import Link from "next/link";
import { ChevronRight, Mail, Shield } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { AccessState, LoadingState } from "@/components/data-states";
import { useDocumentTitle } from "@/lib/list-tools";

export default function SettingsPage() {
  useDocumentTitle("ตั้งค่าบัญชี");
  const { user, config, status } = useRole();

  if (status === "loading") return <div className="p-6"><LoadingState /></div>;
  if (status !== "authenticated" || !user) return <div className="p-6"><AccessState status={401} /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
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
          หากต้องการเปลี่ยนรหัสผ่านหรือบทบาท กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </div>
  );
}
