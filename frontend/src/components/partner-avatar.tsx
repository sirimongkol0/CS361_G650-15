"use client";

import { useState } from "react";

// Bump when stored logos are replaced so browsers holding an old cached copy fetch the new URL.
const LOGO_VERSION = 2;
const API_BASE = (process.env.NEXT_PUBLIC_API_BROWSER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

/* Partner logo (stored in the database, served by the backend) in a round badge;
   falls back to coloured initials when the partner has no stored logo. */
export function PartnerAvatar({ partner, size = 34, className = "" }: {
  partner: { id: number; name: string; initials: string; bg: string; color: string };
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(process.env.NEXT_PUBLIC_DEMO_MODE === 'true');
  const base = `rounded-full flex items-center justify-center font-bold flex-shrink-0 overflow-hidden ${className}`;

  if (!failed) {
    return (
      <div className={`${base} bg-white border border-line`} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served by our API, not a static asset */}
        <img src={`${API_BASE}/partners/${partner.id}/logo?v=${LOGO_VERSION}`} alt={`โลโก้ ${partner.name}`} loading="lazy"
          className="w-[70%] h-[70%] object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className={base} style={{ background: partner.bg, color: partner.color, width: size, height: size, fontSize: Math.round(size / 3) }}>
      {partner.initials}
    </div>
  );
}
