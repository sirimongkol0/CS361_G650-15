'use client';

/*
 * Login — Next.js port of legacy/figma-mock/src/pages/Login.tsx (TU theme).
 * MOCK AUTH: picking a role sets it in localStorage and routes to the role
 * dashboard. Real authentication (SSO / TU account) is planned for V2.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, ArrowRight, Building2, Users, FileText,
  GraduationCap, ChevronDown, Shield, Globe,
} from 'lucide-react';
import { ROLES, useRole, getRoleConfig, type UserRole } from '@/lib/role-context';

const stats = [
  { icon: Building2, value: '48', label: 'หน่วยงานคู่ความร่วมมือ', color: '#F5D6DE' },
  { icon: FileText, value: '23', label: 'MoU / MoA ที่มีผลบังคับ', color: '#FEF3C7' },
  { icon: Users, value: '156', label: 'กิจกรรมทั้งหมด', color: '#DCFCE7' },
  { icon: GraduationCap, value: '32', label: 'นักศึกษาแลกเปลี่ยน', color: '#DBEAFE' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useRole();

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setRole(selectedRole);
    router.push(getRoleConfig(selectedRole).dashboardPath);
  };

  const handleSSO = () => {
    setRole(selectedRole);
    router.push(getRoleConfig(selectedRole).dashboardPath);
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F7F8FA' }}>
      {/* ── Left: Form ──────────────────────────────── */}
      <div
        className="flex flex-col justify-center w-full max-w-md px-10 py-12 mx-auto lg:mx-0 bg-white min-h-screen"
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.06)' }}
      >
        {/* Logo */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-md flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-crimson to-[#B8243E]">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-extrabold text-lg leading-tight text-ink">
                PCSMS
              </div>
              <div className="text-xs leading-tight text-faint">
                Program Collaboration &amp; Stakeholder Management
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-1.5 text-ink">ยินดีต้อนรับ</h1>
          <p className="text-faint" style={{ fontSize: 14, lineHeight: 1.6 }}>
            เข้าสู่ระบบบริหารความร่วมมือและผู้มีส่วนได้ส่วนเสียของหลักสูตร
          </p>
        </div>

        {/* Note about prototype */}
        <div
          className="flex items-start gap-2.5 p-3 rounded-md mb-5 text-xs"
          style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}
        >
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
          <span>
            <span className="font-bold">Prototype Mode:</span> เลือกประเภทผู้ใช้งานเพื่อดู
            Dashboard ตามสิทธิ์ของแต่ละ Role — ในระบบจริง Role ถูกกำหนดจาก
            Authentication ระบบ
          </span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
              ประเภทผู้ใช้งาน
            </label>
            <div className="relative">
              <select
                className="w-full px-3 py-2 pr-10 text-sm font-medium appearance-none rounded-md border bg-white"
                style={{ borderColor: 'var(--border)' }}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#9CA3AF' }}
              />
            </div>
            {/* Role badge preview */}
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className="badge text-xs"
                style={{ color: getRoleConfig(selectedRole).pillColor, background: getRoleConfig(selectedRole).pillBg }}
              >
                <Shield className="w-3 h-3" />
                {getRoleConfig(selectedRole).labelShort}
              </span>
              <span className="text-xs text-faint">
                จะถูก Redirect ไปยัง Dashboard ที่เหมาะสม
              </span>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
              อีเมล / ชื่อผู้ใช้
            </label>
            <input
              className="w-full px-3 py-2 text-sm rounded-md border outline-none focus:border-crimson"
              style={{ borderColor: 'var(--border)' }}
              type="text"
              placeholder="email@tu.ac.th"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
              รหัสผ่าน
            </label>
            <div className="relative">
              <input
                className="w-full px-3 py-2 pr-10 text-sm rounded-md border outline-none focus:border-crimson"
                style={{ borderColor: 'var(--border)' }}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword((s) => !s)}
                style={{ color: '#9CA3AF' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#8B1538' }}
              />
              <span className="text-sm text-faint">จดจำการเข้าสู่ระบบ</span>
            </label>
            <button type="button" className="text-sm font-semibold text-crimson">
              ลืมรหัสผ่าน?
            </button>
          </div>

          {/* Login button */}
          <button type="submit" className="btn btn-primary w-full py-2.5 text-base mt-2">
            เข้าสู่ระบบ
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs text-faint">หรือเข้าสู่ระบบด้วย</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Google */}
          <button type="button" className="btn btn-outline w-full py-2.5" onClick={handleSSO}>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>

          {/* SSO */}
          <button
            type="button"
            className="btn w-full py-2.5"
            style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary-muted)' }}
            onClick={handleSSO}
          >
            <Shield className="w-4 h-4" />
            SSO / University Account
          </button>
        </form>

        <p className="text-center text-xs mt-8 text-faint">
          © 2568 มหาวิทยาลัยธรรมศาสตร์ • PCSMS v3.1 • Secure Collaboration Workspace
        </p>
      </div>

      {/* ── Right: Illustration ──────────────────────── */}
      <div className="hidden lg:flex flex-1 relative flex-col items-center justify-center p-14" style={{ background: '#111827' }}>
        {/* TU stripe top */}
        <div className="absolute top-0 left-0 right-0 h-1 tu-stripe" />

        {/* Decorative rings */}
        <div
          className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full border opacity-10"
          style={{ borderColor: '#8B1538', borderWidth: 40 }}
        />
        <div
          className="absolute bottom-[-60px] left-[-60px] w-60 h-60 rounded-full border opacity-10"
          style={{ borderColor: '#C8961E', borderWidth: 30 }}
        />

        <div className="relative z-10 max-w-sm w-full">
          {/* Heading */}
          <div className="mb-8">
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#C8961E' }}>
              Thammasat University
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-3 font-display">
              ระบบบริหารความร่วมมือ
              <br />
              และ Stakeholder
            </h2>
            <p className="text-[#9CA3AF]" style={{ fontSize: 14, lineHeight: 1.7 }}>
              บริหารจัดการ MoU/MoA กิจกรรม และนักศึกษาแลกเปลี่ยน
              อย่างเป็นระบบในที่เดียว
            </p>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {stats.map(({ icon: Icon, value, label, color }) => (
              <div
                key={label}
                className="rounded-md p-4"
                style={{ background: '#1F2937', border: '1px solid #374151' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${color}22` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="text-xl font-extrabold text-white font-display">{value}</div>
                <div className="text-xs mt-0.5 text-[#9CA3AF]">{label}</div>
              </div>
            ))}
          </div>

          {/* Role preview chips */}
          <div>
            <div className="text-xs font-semibold mb-2.5 text-faint">
              รองรับผู้ใช้งาน 5 ประเภท
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <span
                  key={r.id}
                  className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: '#1F2937', color: '#D1D5DB', border: '1px solid #374151' }}
                >
                  {r.labelShort}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
