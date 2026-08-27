import { useState } from "react";
import { Link } from "react-router";
import { ChevronRight, User, Bell, Shield, Lock, Settings as SettingsIcon, Globe, Database, Key, Eye, EyeOff, Check } from "lucide-react";

const settingsTabs = [
  { id: "profile", label: "โปรไฟล์", icon: User },
  { id: "notifications", label: "การแจ้งเตือน", icon: Bell },
  { id: "privacy", label: "Data Privacy", icon: Shield },
  { id: "security", label: "Security", icon: Lock },
  { id: "system", label: "System Configuration", icon: SettingsIcon },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? "#4f46e5" : "#e2e8f0", height: 22, width: 42 }}
      onClick={() => onChange(!on)}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-transform shadow-sm"
        style={{ width: 18, height: 18, left: on ? 22 : 2, transition: "left 0.15s" }}
      />
    </button>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [notifs, setNotifs] = useState({
    mouExpiry: true, activityReminder: true, feedbackAlert: true, systemAlert: false, weeklyReport: true, emailDigest: false,
  });
  const [privacy, setPrivacy] = useState({
    studentDataMask: true, logAccess: true, exportApproval: true, dataRetention: true,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#94a3b8" }}>
          <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: "#4f46e5" }}>ตั้งค่า</span>
        </nav>
        <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตั้งค่าระบบ</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>จัดการการตั้งค่าบัญชีและระบบ</p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "220px 1fr" }}>
        {/* Sidebar nav */}
        <nav className="space-y-1">
          {settingsTabs.map(t => (
            <button
              key={t.id}
              className="sidebar-link w-full text-left"
              style={{ background: activeTab===t.id?"#ede9fe":"transparent", color: activeTab===t.id?"#4f46e5":"#64748b" }}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon className="sidebar-icon" />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="space-y-5">
          {activeTab === "profile" && (
            <div className="content-card p-6">
              <h2 className="font-bold text-base mb-5" style={{ color: "#1e293b" }}>ข้อมูลโปรไฟล์</h2>
              <div className="flex items-center gap-5 mb-6 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="avatar w-16 h-16 text-xl" style={{ background: "#ede9fe", color: "#4f46e5" }}>อ</div>
                <div>
                  <button className="btn btn-outline text-sm">เปลี่ยนรูปโปรไฟล์</button>
                  <p className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>JPG, PNG ขนาดไม่เกิน 2MB</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                {[
                  { label: "ชื่อ", value: "Admin" },
                  { label: "นามสกุล", value: "System" },
                  { label: "อีเมล", value: "admin@university.ac.th" },
                  { label: "โทรศัพท์", value: "+66 2 123 4567" },
                  { label: "ตำแหน่ง", value: "ผู้ดูแลระบบ" },
                  { label: "หน่วยงาน", value: "สำนักงานหลักสูตร" },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>{f.label}</label>
                    <input className="input" defaultValue={f.value} />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary mt-5 gap-2" onClick={handleSave}>
                {saved ? <><Check className="w-4 h-4" />บันทึกแล้ว</> : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="content-card p-6">
              <h2 className="font-bold text-base mb-5" style={{ color: "#1e293b" }}>การแจ้งเตือน</h2>
              <div className="space-y-5">
                {[
                  { key: "mouExpiry", label: "แจ้งเตือน MoU ใกล้หมดอายุ", desc: "รับแจ้งเตือนเมื่อ MoU จะหมดอายุภายใน 30/60/90 วัน" },
                  { key: "activityReminder", label: "เตือนกิจกรรมที่กำลังจะมาถึง", desc: "รับแจ้งเตือน 3 วันก่อนกิจกรรม" },
                  { key: "feedbackAlert", label: "แจ้งเตือน Feedback ใหม่", desc: "รับแจ้งเตือนเมื่อมี Feedback ที่ยังไม่ได้ตอบ" },
                  { key: "systemAlert", label: "การแจ้งเตือนระบบ", desc: "การอัปเดต การบำรุงรักษา และข้อผิดพลาด" },
                  { key: "weeklyReport", label: "รายงานสรุปรายสัปดาห์", desc: "รับสรุปกิจกรรมและสถิติรายสัปดาห์" },
                  { key: "emailDigest", label: "Email Digest รายวัน", desc: "สรุปกิจกรรมและรายการรอดำเนินการ" },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#f1f5f9" }}>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "#1e293b" }}>{n.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{n.desc}</div>
                    </div>
                    <Toggle
                      on={(notifs as any)[n.key]}
                      onChange={v => setNotifs(prev => ({ ...prev, [n.key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary mt-5" onClick={handleSave}>บันทึก</button>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="content-card p-6">
              <h2 className="font-bold text-base mb-1" style={{ color: "#1e293b" }}>Data Privacy</h2>
              <p className="text-sm mb-5" style={{ color: "#64748b" }}>การตั้งค่าความเป็นส่วนตัวของข้อมูล ตาม PDPA</p>
              <div className="space-y-4">
                {[
                  { key: "studentDataMask", label: "ซ่อนข้อมูลส่วนตัวนักศึกษา", desc: "แสดงเฉพาะข้อมูลที่จำเป็นตามระดับสิทธิ์ผู้ใช้" },
                  { key: "logAccess", label: "บันทึก Access Log", desc: "บันทึกการเข้าถึงข้อมูลละเอียดอ่อนทุกครั้ง" },
                  { key: "exportApproval", label: "ต้องได้รับอนุมัติก่อน Export", desc: "การส่งออกข้อมูลต้องผ่านการอนุมัติจากผู้บริหาร" },
                  { key: "dataRetention", label: "นโยบายเก็บข้อมูล 5 ปี", desc: "ลบข้อมูลที่เกิน 5 ปีโดยอัตโนมัติ" },
                ].map(p => (
                  <div key={p.key} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "#f8fafc", border: "1px solid var(--border)" }}>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "#1e293b" }}>{p.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{p.desc}</div>
                    </div>
                    <Toggle
                      on={(privacy as any)[p.key]}
                      onChange={v => setPrivacy(prev => ({ ...prev, [p.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              <div className="content-card p-6">
                <h2 className="font-bold text-base mb-5" style={{ color: "#1e293b" }}>เปลี่ยนรหัสผ่าน</h2>
                <div className="space-y-4 max-w-md">
                  {[
                    { label: "รหัสผ่านปัจจุบัน", show: showOldPassword, toggle: setShowOldPassword },
                    { label: "รหัสผ่านใหม่", show: false, toggle: () => {} },
                    { label: "ยืนยันรหัสผ่านใหม่", show: false, toggle: () => {} },
                  ].map((f, i) => (
                    <div key={i}>
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>{f.label}</label>
                      <div className="relative">
                        <input className="input pr-10" type={f.show ? "text" : "password"} placeholder="••••••••" />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => f.toggle(!f.show)} style={{ color: "#94a3b8" }}>
                          {f.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-primary">เปลี่ยนรหัสผ่าน</button>
                </div>
              </div>
              <div className="content-card p-6">
                <h2 className="font-bold text-base mb-4" style={{ color: "#1e293b" }}>Two-Factor Authentication</h2>
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "#15803d" }}>2FA เปิดใช้งานแล้ว</div>
                    <div className="text-xs mt-0.5" style={{ color: "#16a34a" }}>บัญชีของคุณได้รับการป้องกันด้วย Authenticator App</div>
                  </div>
                  <span className="badge badge-green">Active</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-5">
              <div className="content-card p-6">
                <h2 className="font-bold text-base mb-4" style={{ color: "#1e293b" }}>System Configuration</h2>
                <div className="grid grid-cols-2 gap-5">
                  {[
                    { label: "ชื่อระบบ", value: "PCSMS" },
                    { label: "เวอร์ชัน", value: "3.1.0" },
                    { label: "ภาษาหลัก", value: "ภาษาไทย (th-TH)" },
                    { label: "เขตเวลา", value: "Asia/Bangkok (UTC+7)" },
                    { label: "รูปแบบวันที่", value: "DD/MM/YYYY (พ.ศ.)" },
                    { label: "อีเมลผู้ดูแล", value: "admin@university.ac.th" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>{f.label}</label>
                      <input className="input" defaultValue={f.value} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary mt-5" onClick={handleSave}>
                  {saved ? <><Check className="w-4 h-4 mr-1" />บันทึกแล้ว</> : "บันทึกการตั้งค่า"}
                </button>
              </div>
              <div className="content-card p-6">
                <h2 className="font-bold text-base mb-4" style={{ color: "#1e293b" }}>API & Integration</h2>
                <div className="space-y-3">
                  {[
                    { label: "Registrar System API", status: "connected", url: "https://registrar.university.ac.th/api" },
                    { label: "สหกิจศึกษา System", status: "connected", url: "https://coop.university.ac.th/api" },
                    { label: "Google Workspace SSO", status: "connected", url: "OAuth 2.0" },
                    { label: "LMS Integration", status: "disconnected", url: "ยังไม่ได้เชื่อมต่อ" },
                  ].map(api => (
                    <div key={api.label} className="flex items-center gap-4 p-3.5 rounded-xl" style={{ background: "#f8fafc", border: "1px solid var(--border)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: api.status === "connected" ? "#dcfce7" : "#fee2e2" }}>
                        <Globe className="w-4 h-4" style={{ color: api.status === "connected" ? "#16a34a" : "#dc2626" }} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm" style={{ color: "#1e293b" }}>{api.label}</div>
                        <div className="text-xs" style={{ color: "#94a3b8" }}>{api.url}</div>
                      </div>
                      <span className={`badge ${api.status === "connected" ? "badge-green" : "badge-red"}`}>
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
