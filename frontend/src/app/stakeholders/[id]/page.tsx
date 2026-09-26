"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, ExternalLink, Globe, Mail, MapPin } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/data-states";
import { useRole } from "@/lib/role-context";

interface ContactPerson {
  id: number;
  name: string;
  position?: string;
  email?: string;
  phone?: string;
  is_public: boolean;
}

interface StakeholderDetail {
  id: number;
  name: string;
  category: string;
  type?: string;
  country?: string;
  description?: string;
  website_url?: string;
  websiteUrl?: string;
  contacts?: ContactPerson[];
  contactName?: string;
  contactEmail?: string;
  bg?: string;
  color?: string;
  initials?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ฟังก์ชันสุ่มสีและสร้างอักษรย่อสำหรับ Avatar
function getAvatarProps(name: string) {
  const colors = [
    { bg: "#E0F2FE", color: "#0369A1" },
    { bg: "#DCFCE7", color: "#15803D" },
    { bg: "#FFE4E6", color: "#BE123C" },
    { bg: "#FEF3C7", color: "#B45309" },
    { bg: "#F3E8FF", color: "#6B21A8" },
  ];
  const charCode = name ? name.charCodeAt(0) : 0;
  const colorScheme = colors[charCode % colors.length];
  const initials = name ? name.slice(0, 2).toUpperCase() : "--";
  return { ...colorScheme, initials };
}

export default function StakeholderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const { role } = useRole();

  const [item, setItem] = useState<StakeholderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setError("รหัสหน่วยงานไม่ถูกต้อง (Invalid partner id)");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/stakeholders/${id}`);

      if (res.status === 404) {
        throw new Error("ไม่พบข้อมูลหน่วยงานรหัสนี้ หรือรายการยังไม่ถูกเผยแพร่ (404 Not Found)");
      }

      if (!res.ok) {
        throw new Error(`เกิดข้อผิดพลาดในการดึงข้อมูล (HTTP ${res.status})`);
      }

      const rawData = await res.json();
      const firstContact = rawData.contacts && rawData.contacts.length > 0 ? rawData.contacts[0] : null;
      const avatar = getAvatarProps(rawData.name || "");

      const formattedData: StakeholderDetail = {
        ...rawData,
        type: rawData.category || rawData.type || "ทั่วไป",
        country: rawData.country || "—",
        websiteUrl: rawData.website_url || rawData.websiteUrl || rawData.website || null,
        contactName: firstContact ? firstContact.name : (rawData.contact_name || "—"),
        contactEmail: firstContact ? firstContact.email : (rawData.contact_email || "—"),
        bg: avatar.bg,
        color: avatar.color,
        initials: avatar.initials,
      };

      setItem(formattedData);
    } catch (err: any) {
      setError(err.message || "ไม่สามารถโหลดข้อมูลหน่วยงานได้");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto">
        <LoadingState title="กำลังโหลดข้อมูลหน่วยงาน" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto">
        <ErrorState error={error || "ไม่พบข้อมูลหน่วยงาน"} onRetry={fetchDetail} />
        <div className="mt-4 text-center">
          <Link href="/stakeholders" className="text-sm font-semibold text-crimson hover:underline">
            กลับไปหน้ารายการหน่วยงาน
          </Link>
        </div>
      </div>
    );
  }

  const website = item.websiteUrl && /^https?:\/\//i.test(item.websiteUrl) ? item.websiteUrl : null;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs mb-5 text-faint">
        <Link href="/" className="hover:text-crimson">หน้าหลัก</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/stakeholders" className="hover:text-crimson">หน่วยงานคู่ความร่วมมือ</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-crimson">{item.name}</span>
      </nav>

      {/* Main Header Card */}
      <section className="bg-white border border-line rounded-lg shadow-card p-6 mb-5">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold" style={{ background: item.bg, color: item.color }}>
            {item.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-ink font-display">{item.name}</h1>
              <span className="badge badge-green">เผยแพร่แล้ว</span>
              <span className="badge bg-[#E0E7FF] text-[#4338CA]">{item.type}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-faint">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{item.country}</span>
              {item.contactEmail && item.contactEmail !== "—" && (
                <a href={`mailto:${item.contactEmail}`} className="flex items-center gap-1.5 hover:underline text-crimson">
                  <Mail className="w-3.5 h-3.5" />{item.contactEmail}
                </a>
              )}
              {website && (
                <a href={website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:underline text-crimson">
                  <Globe className="w-3.5 h-3.5" />เว็บไซต์<ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          {role !== "public" && (
            <div className="flex gap-2">
              <button className="btn btn-outline" type="button">แก้ไขข้อมูล</button>
              <button className="btn btn-primary" type="button">+ เพิ่มกิจกรรม</button>
            </div>
          )}
        </div>
      </section>

      {/* Two Columns Grid Layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* About Section */}
        <section className="bg-white border border-line rounded-lg shadow-card p-6">
          <h2 className="font-bold mb-3 text-ink">เกี่ยวกับหน่วยงาน</h2>
          {item.description ? (
            <p className="text-sm leading-relaxed text-faint whitespace-pre-line">{item.description}</p>
          ) : (
            <p className="text-sm text-faint">ยังไม่มีรายละเอียดเพิ่มเติมสำหรับหน่วยงานนี้</p>
          )}
        </section>

        {/* Sidebar Contact Info */}
        <aside className="bg-white border border-line rounded-lg shadow-card p-5 h-fit">
          <h2 className="font-bold mb-4 text-ink">ข้อมูลการติดต่อ</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs font-semibold text-faint">ผู้ติดต่อ</dt><dd className="mt-1 text-mute">{item.contactName ?? "—"}</dd></div>
            <div><dt className="text-xs font-semibold text-faint">อีเมล</dt><dd className="mt-1 break-all text-mute">{item.contactEmail ?? "—"}</dd></div>
            <div><dt className="text-xs font-semibold text-faint">เว็บไซต์</dt><dd className="mt-1 break-all text-mute">{item.websiteUrl ?? "—"}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}



