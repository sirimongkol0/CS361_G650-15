'use client';

/*
 * Login — real sign-in (V3). The backend checks the password with Amazon Cognito;
 * the role comes from the account, not from a picker. Accounts are created by an
 * administrator (no self sign-up).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Shield, Globe, AlertCircle } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { ROLES, useRole, getRoleConfig } from '@/lib/role-context';

/** Only same-site paths are allowed as the post-login destination. */
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่';
  if (error.status === 401 && error.message === 'Password change required') {
    return 'บัญชีนี้ต้องตั้งรหัสผ่านใหม่ กรุณาติดต่อผู้ดูแลระบบ';
  }
  switch (error.status) {
    case 401: return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    case 403: return 'บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
    case 422: return 'กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง';
    case 429: return 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
    default: return 'ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login, status, config } = useRole();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in -> go to this role's dashboard.
  useEffect(() => {
    if (status === 'authenticated') router.replace(nextPath() ?? config.dashboardPath);
  }, [status, config.dashboardPath, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(email.trim(), password);
      setPassword('');
      router.replace(nextPath() ?? getRoleConfig(me.role).dashboardPath);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
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
                ระบบบริหารความร่วมมือและผู้มีส่วนได้ส่วนเสีย
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-1.5 text-ink">ยินดีต้อนรับ</h1>
          <p className="text-faint" style={{ fontSize: 14, lineHeight: 1.6 }}>
            เข้าสู่ระบบบริหารความร่วมมือและผู้มีส่วนได้ส่วนเสียของหลักสูตร
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-md text-sm"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
              อีเมล
            </label>
            <input
              id="login-email"
              className="w-full px-3 py-2 text-sm rounded-md border outline-none focus:border-crimson"
              style={{ borderColor: 'var(--border)' }}
              type="email"
              autoComplete="username"
              placeholder="email@tu.ac.th"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="login-password" className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
              รหัสผ่าน
            </label>
            <div className="relative">
              <input
                id="login-password"
                className="w-full px-3 py-2 pr-10 text-sm rounded-md border outline-none focus:border-crimson"
                style={{ borderColor: 'var(--border)' }}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                style={{ color: '#9CA3AF' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            type="submit"
            className="btn btn-primary w-full py-2.5 text-base mt-2"
            disabled={submitting || !email.trim() || !password}
          >
            {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="flex items-start gap-2 text-xs text-faint">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            บัญชีผู้ใช้สร้างโดยผู้ดูแลระบบ สิทธิ์การใช้งานกำหนดตามบัญชีของคุณ
          </p>
        </form>

        <p className="text-center text-xs mt-8 text-faint">
          © 2568 มหาวิทยาลัยธรรมศาสตร์ • PCSMS
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
            <div className="text-sm font-bold mb-3" style={{ color: '#C8961E' }}>
              มหาวิทยาลัยธรรมศาสตร์
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-3 font-display">
              ระบบบริหารความร่วมมือ
              <br />
              และผู้มีส่วนได้ส่วนเสีย
            </h2>
            <p className="text-[#9CA3AF]" style={{ fontSize: 14, lineHeight: 1.7 }}>
              บริหารจัดการ MoU/MoA กิจกรรม และนักศึกษาแลกเปลี่ยน
              อย่างเป็นระบบในที่เดียว
            </p>
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
