"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  User,
  Bell,
  Shield,
  Lock,
  Settings as SettingsIcon,
  Globe,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { adminProfile as mockAdminProfile } from "@/lib/mock";
import { loadAdminProfile, useApiData } from "@/lib/api";

const settingsTabs = [
  { id: "profile", label: "โปรไฟล์", icon: User },
  { id: "notifications", label: "การแจ้งเตือน", icon: Bell },
  { id: "privacy", label: "Data Privacy", icon: Shield },
  { id: "security", label: "Security", icon: Lock },
  { id: "system", label: "System Configuration", icon: SettingsIcon },
] as const;

type TabId = (typeof settingsTabs)[number]["id"];

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className="relative rounded-full transition-colors flex-shrink-0"
      style={{
        background: on ? "var(--primary)" : "#E2E8F0",
        height: 22,
        width: 42,
      }}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span
        className="absolute rounded-full bg-white transition-all shadow-sm"
        style={{ width: 18, height: 18, left: on ? 22 : 2, top: 2 }}
      />
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    mouExpiry: true,
    activityReminder: true,
    feedbackAlert: true,
    systemAlert: false,
    weeklyReport: true,
    emailDigest: false,
  });
  const [privacy, setPrivacy] = useState<Record<string, boolean>>({
    studentDataMask: true,
    logAccess: true,
    exportApproval: true,
    dataRetention: true,
  });
  const [saved, setSaved] = useState(false);

  // API-first with mock.ts as fallback (initial render uses mock until API resolves).
  const adminProfile = useApiData(loadAdminProfile, mockAdminProfile);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
          <Link href="/" className="text-faint hover:text-crimson">
            หน้าหลัก
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-crimson">ตั้งค่า</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink font-display">ตั้งค่าระบบ</h1>
        <p className="text-sm mt-0.5 text-faint">จัดการการตั้งค่าบัญชีและระบบ</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar nav */}
        <nav className="space-y-1">
          {settingsTabs.map((t) => (
            <button
              key={t.id}
              className={`sidebar-link w-full text-left ${
                activeTab === t.id ? "active" : ""
              }`}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="space-y-5">
          {activeTab === "profile" && (
            <div className="rounded-lg bg-white shadow-card p-6">
              <h2 className="font-bold text-base mb-5 text-ink">
                ข้อมูลโปรไฟล์
              </h2>
              <div className="flex items-center gap-5 mb-6 pb-6 border-b border-line">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-crimson-light text-crimson">
                  {adminProfile.firstName[0]}
                </div>
                <div>
                  <button className="btn btn-outline text-sm">
                    เปลี่ยนรูปโปรไฟล์
                  </button>
                  <p className="text-xs mt-1.5 text-faint">
                    JPG, PNG ขนาดไม่เกิน 2MB
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                {[
                  { label: "ชื่อ", value: adminProfile.firstName },
                  { label: "นามสกุล", value: adminProfile.lastName },
                  { label: "อีเมล", value: adminProfile.email },
                  { label: "โทรศัพท์", value: adminProfile.phone },
                  { label: "ตำแหน่ง", value: adminProfile.position },
                  { label: "หน่วยงาน", value: adminProfile.department },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-sm font-semibold mb-1.5 text-mute">
                      {f.label}
                    </label>
                    <input className={inputClass} defaultValue={f.value} />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary mt-5 gap-2" onClick={handleSave}>
                {saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    บันทึกแล้ว
                  </>
                ) : (
                  "บันทึกการเปลี่ยนแปลง"
                )}
              </button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="rounded-lg bg-white shadow-card p-6">
              <h2 className="font-bold text-base mb-5 text-ink">การแจ้งเตือน</h2>
              <div className="space-y-5">
                {[
                  {
                    key: "mouExpiry",
                    label: "แจ้งเตือน MoU ใกล้หมดอายุ",
                    desc: "รับแจ้งเตือนเมื่อ MoU จะหมดอายุภายใน 30/60/90 วัน",
                  },
                  {
                    key: "activityReminder",
                    label: "เตือนกิจกรรมที่กำลังจะมาถึง",
                    desc: "รับแจ้งเตือน 3 วันก่อนกิจกรรม",
                  },
                  {
                    key: "feedbackAlert",
                    label: "แจ้งเตือน Feedback ใหม่",
                    desc: "รับแจ้งเตือนเมื่อมี Feedback ที่ยังไม่ได้ตอบ",
                  },
                  {
                    key: "systemAlert",
                    label: "การแจ้งเตือนระบบ",
                    desc: "การอัปเดต การบำรุงรักษา และข้อผิดพลาด",
                  },
                  {
                    key: "weeklyReport",
                    label: "รายงานสรุปรายสัปดาห์",
                    desc: "รับสรุปกิจกรรมและสถิติรายสัปดาห์",
                  },
                  {
                    key: "emailDigest",
                    label: "Email Digest รายวัน",
                    desc: "สรุปกิจกรรมและรายการรอดำเนินการ",
                  },
                ].map((n) => (
                  <div
                    key={n.key}
                    className="flex items-center justify-between py-3 border-b border-paper gap-4"
                  >
                    <div>
                      <div className="font-semibold text-sm text-ink">
                        {n.label}
                      </div>
                      <div className="text-xs mt-0.5 text-faint">{n.desc}</div>
                    </div>
                    <Toggle
                      on={notifs[n.key]}
                      onChange={(v) => setNotifs((prev) => ({ ...prev, [n.key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary mt-5" onClick={handleSave}>
                บันทึก
              </button>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="rounded-lg bg-white shadow-card p-6">
              <h2 className="font-bold text-base mb-1 text-ink">Data Privacy</h2>
              <p className="text-sm mb-5 text-faint">
                การตั้งค่าความเป็นส่วนตัวของข้อมูล ตาม PDPA
              </p>
              <div className="space-y-4">
                {[
                  {
                    key: "studentDataMask",
                    label: "ซ่อนข้อมูลส่วนตัวนักศึกษา",
                    desc: "แสดงเฉพาะข้อมูลที่จำเป็นตามระดับสิทธิ์ผู้ใช้",
                  },
                  {
                    key: "logAccess",
                    label: "บันทึก Access Log",
                    desc: "บันทึกการเข้าถึงข้อมูลละเอียดอ่อนทุกครั้ง",
                  },
                  {
                    key: "exportApproval",
                    label: "ต้องได้รับอนุมัติก่อน Export",
                    desc: "การส่งออกข้อมูลต้องผ่านการอนุมัติจากผู้บริหาร",
                  },
                  {
                    key: "dataRetention",
                    label: "นโยบายเก็บข้อมูล 5 ปี",
                    desc: "ลบข้อมูลที่เกิน 5 ปีโดยอัตโนมัติ",
                  },
                ].map((p) => (
                  <div
                    key={p.key}
                    className="flex items-center justify-between p-4 rounded-lg bg-soft border border-line gap-4"
                  >
                    <div>
                      <div className="font-semibold text-sm text-ink">
                        {p.label}
                      </div>
                      <div className="text-xs mt-0.5 text-faint">{p.desc}</div>
                    </div>
                    <Toggle
                      on={privacy[p.key]}
                      onChange={(v) => setPrivacy((prev) => ({ ...prev, [p.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              <div className="rounded-lg bg-white shadow-card p-6">
                <h2 className="font-bold text-base mb-5 text-ink">
                  เปลี่ยนรหัสผ่าน
                </h2>
                <div className="space-y-4 max-w-md">
                  {[
                    {
                      label: "รหัสผ่านปัจจุบัน",
                      show: showOldPassword,
                      toggle: setShowOldPassword,
                    },
                    { label: "รหัสผ่านใหม่", show: false, toggle: () => {} },
                    { label: "ยืนยันรหัสผ่านใหม่", show: false, toggle: () => {} },
                  ].map((f, i) => (
                    <div key={i}>
                      <label className="block text-sm font-semibold mb-1.5 text-mute">
                        {f.label}
                      </label>
                      <div className="relative">
                        <input
                          className={`${inputClass} pr-10`}
                          type={f.show ? "text" : "password"}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-faint"
                          onClick={() => f.toggle(!f.show)}
                          aria-label={f.show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                        >
                          {f.show ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-primary">เปลี่ยนรหัสผ่าน</button>
                </div>
              </div>
              <div className="rounded-lg bg-white shadow-card p-6">
                <h2 className="font-bold text-base mb-4 text-ink">
                  Two-Factor Authentication
                </h2>
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-200 gap-4">
                  <div>
                    <div className="font-semibold text-sm text-green-700">
                      2FA เปิดใช้งานแล้ว
                    </div>
                    <div className="text-xs mt-0.5 text-green-600">
                      บัญชีของคุณได้รับการป้องกันด้วย Authenticator App
                    </div>
                  </div>
                  <span className="badge badge-green">Active</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-5">
              <div className="rounded-lg bg-white shadow-card p-6">
                <h2 className="font-bold text-base mb-4 text-ink">
                  System Configuration
                </h2>
                <div className="grid sm:grid-cols-2 gap-5">
                  {[
                    { label: "ชื่อระบบ", value: "PCSMS" },
                    { label: "เวอร์ชัน", value: "3.1.0" },
                    { label: "ภาษาหลัก", value: "ภาษาไทย (th-TH)" },
                    { label: "เขตเวลา", value: "Asia/Bangkok (UTC+7)" },
                    { label: "รูปแบบวันที่", value: "DD/MM/YYYY (พ.ศ.)" },
                    { label: "อีเมลผู้ดูแล", value: adminProfile.email },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block text-sm font-semibold mb-1.5 text-mute">
                        {f.label}
                      </label>
                      <input className={inputClass} defaultValue={f.value} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary mt-5" onClick={handleSave}>
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      บันทึกแล้ว
                    </>
                  ) : (
                    "บันทึกการตั้งค่า"
                  )}
                </button>
              </div>
              <div className="rounded-lg bg-white shadow-card p-6">
                <h2 className="font-bold text-base mb-4 text-ink">
                  API &amp; Integration
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      label: "Registrar System API",
                      status: "connected",
                      url: "https://registrar.university.ac.th/api",
                    },
                    {
                      label: "สหกิจศึกษา System",
                      status: "connected",
                      url: "https://coop.university.ac.th/api",
                    },
                    {
                      label: "Google Workspace SSO",
                      status: "connected",
                      url: "OAuth 2.0",
                    },
                    {
                      label: "LMS Integration",
                      status: "disconnected",
                      url: "ยังไม่ได้เชื่อมต่อ",
                    },
                  ].map((api) => (
                    <div
                      key={api.label}
                      className="flex items-center gap-4 p-3.5 rounded-lg bg-soft border border-line"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background:
                            api.status === "connected" ? "#DCFCE7" : "#FEE2E2",
                        }}
                      >
                        <Globe
                          className="w-4 h-4"
                          style={{
                            color:
                              api.status === "connected" ? "#15803D" : "#B91C1C",
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-ink">
                          {api.label}
                        </div>
                        <div className="text-xs text-faint">{api.url}</div>
                      </div>
                      <span
                        className={`badge ${
                          api.status === "connected" ? "badge-green" : "badge-crimson"
                        }`}
                      >
                        {api.status === "connected" ? "เชื่อมต่อแล้ว" : "ไม่ได้เชื่อมต่อ"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
