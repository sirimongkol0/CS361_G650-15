"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { useRole } from "@/lib/role-context";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

interface ContactPerson {
  id: number;
  name: string;
  position?: string;
  email?: string;
  phone?: string;
  is_public: boolean;
}

interface Stakeholder {
  id: number;
  name: string;
  category: string;
  type?: string;
  country?: string;
  description?: string;
  website_url?: string;
  logo_url?: string;
  contacts: ContactPerson[];
  contactName?: string;
  contactEmail?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ฟังก์ชันช่วยสุ่มสีและสร้าง อักษรย่อ (Initials) สำหรับ Avatar ในตาราง
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

export default function StakeholdersPage() {
  const { role } = useRole();
  const [data, setData] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");

  // ดึงข้อมูลจาก API V2 จริง
  const fetchStakeholders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/stakeholders?size=100`);
      if (!res.ok) {
        throw new Error(`เกิดข้อผิดพลาดในการดึงข้อมูล (HTTP ${res.status})`);
      }
      const result = await res.json();
      
      // แปลงข้อมูล V2 ให้พร้อมแสดงผลบน UI เดิม
      const items = (result.items || result || []).map((item: any) => {
        const firstContact = item.contacts && item.contacts.length > 0 ? item.contacts[0] : null;
        const avatar = getAvatarProps(item.name);
        return {
          ...item,
          type: item.category || item.type || "ทั่วไป",
          country: item.country || "—",
          contactName: firstContact ? firstContact.name : (item.contact_name || "—"),
          contactEmail: firstContact ? firstContact.email : (item.contact_email || "—"),
          bg: avatar.bg,
          color: avatar.color,
          initials: avatar.initials,
        };
      });

      setData(items);
    } catch (err: any) {
      setError(err.message || "ไม่สามารถดึงข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStakeholders();
  }, [fetchStakeholders]);

  const types = useMemo(
    () => Array.from(new Set(data.map((item) => item.type).filter((value) => value && value !== "—"))),
    [data]
  );
  const countries = useMemo(
    () => Array.from(new Set(data.map((item) => item.country).filter((value) => value && value !== "—"))),
    [data]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th");
    return data.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLocaleLowerCase("th").includes(query) ||
        (item.contactName ?? "").toLocaleLowerCase("th").includes(query);
      return (
        matchesSearch &&
        (typeFilter === "all" || item.type === typeFilter) &&
        (countryFilter === "all" || item.country === countryFilter)
      );
    });
  }, [countryFilter, data, search, typeFilter]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">หน่วยงานคู่ความร่วมมือ</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">หน่วยงานคู่ความร่วมมือ</h1>
          <p className="text-sm mt-0.5 text-faint">
            {role === "public"
              ? "ข้อมูลหน่วยงานคู่ความร่วมมือที่ได้รับอนุญาตให้เผยแพร่"
              : "ข้อมูลหน่วยงานและ Stakeholder ที่เกี่ยวข้อง"}
          </p>
        </div>
        {role !== "public" && (
          <button className="btn btn-primary gap-2" type="button">
            <Plus className="w-4 h-4" /> เพิ่มหน่วยงาน
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && <LoadingState title="กำลังโหลดหน่วยงาน" />}

      {/* Error State with Retry */}
      {!loading && error && <ErrorState error={error} onRetry={fetchStakeholders} />}

      {/* Empty State */}
      {!loading && !error && data.length === 0 && <EmptyState />}

      {/* Content Table */}
      {!loading && !error && data.length > 0 && (
        <>
          <div className="bg-white border border-line rounded-lg shadow-card p-4 mb-5">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="ค้นหาหน่วยงานหรือผู้ติดต่อ..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">ประเภท: ทั้งหมด</option>
                {types.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
                <option value="all">ประเทศ: ทั้งหมด</option>
                {countries.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
            </div>
          </div>

          <p className="mb-4 text-sm text-faint">แสดง {filtered.length} จาก {data.length} หน่วยงาน</p>

          {filtered.length === 0 ? (
            <EmptyState title="ไม่พบหน่วยงานที่ค้นหา" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          ) : (
            <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line bg-[#F8FAFC]">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">หน่วยงาน</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ประเภท</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ประเทศ</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ผู้ติดต่อ</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">อีเมล</th>
                      <th className="px-4 py-3.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className="border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: item.bg, color: item.color }}>
                              {item.initials}
                            </div>
                            <Link href={`/stakeholders/${item.id}`} className="text-sm font-semibold hover:underline text-ink">
                              {item.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-4"><span className="badge bg-[#E0E7FF] text-[#4338CA]">{item.type}</span></td>
                        <td className="px-4 py-4 text-sm text-faint">{item.country}</td>
                        <td className="px-4 py-4 text-sm text-faint">{item.contactName}</td>
                        <td className="px-4 py-4 text-sm text-faint">{item.contactEmail}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Link href={`/stakeholders/${item.id}`} className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink">ดูข้อมูล</Link>
                            {role !== "public" && (
                              <button className="btn p-1.5 text-faint hover:bg-soft hover:text-ink" type="button" aria-label={`จัดการ ${item.name}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}





