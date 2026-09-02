"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronRight, MoreHorizontal, Plus, Search, Users } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { loadActivities, useApiResource } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { activityTypeColors } from "@/lib/mock";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

export default function ActivitiesPage() {
  const { role } = useRole();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const activities = useApiResource(loadActivities);

  const data = activities.status === "success" ? activities.data : [];
  const types = useMemo(() => Array.from(new Set(data.map((item) => item.type))), [data]);
  const organizations = useMemo(() => Array.from(new Set(data.map((item) => item.org))), [data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th");
    return data.filter((item) =>
      (!query || item.name.toLocaleLowerCase("th").includes(query) || item.org.toLocaleLowerCase("th").includes(query)) &&
      (typeFilter === "all" || item.type === typeFilter) &&
      (orgFilter === "all" || item.org === orgFilter) &&
      (statusFilter === "all" || item.status === statusFilter)
    );
  }, [data, orgFilter, search, statusFilter, typeFilter]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">กิจกรรม</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">กิจกรรม</h1>
          <p className="text-sm mt-0.5 text-faint">
            {role === "public" ? "กิจกรรมความร่วมมือที่ได้รับอนุญาตให้เผยแพร่" : "กิจกรรมและโครงการความร่วมมือ"}
          </p>
        </div>
        {role !== "public" && (
          <button className="btn btn-primary gap-2" type="button"><Plus className="w-4 h-4" />เพิ่มกิจกรรม</button>
        )}
      </div>

      {activities.status === "loading" && <LoadingState title="กำลังโหลดกิจกรรม" />}
      {activities.status === "error" && <ErrorState error={activities.error} onRetry={activities.retry} />}
      {activities.status === "success" && activities.data.length === 0 && <EmptyState title="ยังไม่มีกิจกรรมที่เผยแพร่" />}

      {activities.status === "success" && activities.data.length > 0 && (
        <>
          <div className="bg-white border border-line rounded-lg shadow-card p-4 mb-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                <input className={`${inputCls} pl-9`} placeholder="ค้นหากิจกรรมหรือหน่วยงาน..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">ประเภท: ทั้งหมด</option>
                {types.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} value={orgFilter} onChange={(event) => setOrgFilter(event.target.value)}>
                <option value="all">หน่วยงาน: ทั้งหมด</option>
                {organizations.map((org) => <option key={org} value={org}>{org}</option>)}
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">สถานะ: ทั้งหมด</option>
                <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                <option value="วางแผน">วางแผน</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <span className="text-sm text-faint">แสดง {filtered.length} จาก {data.length} กิจกรรม</span>
            <span className="badge badge-green">เสร็จสิ้น: {data.filter((item) => item.status === "เสร็จสิ้น").length}</span>
            <span className="badge badge-blue">กำลังดำเนินการ: {data.filter((item) => item.status === "กำลังดำเนินการ").length}</span>
            <span className="badge badge-purple">วางแผน: {data.filter((item) => item.status === "วางแผน").length}</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="ไม่พบกิจกรรมที่ค้นหา" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          ) : (
            <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-line bg-[#F8FAFC]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">ชื่อกิจกรรม</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">หน่วยงาน</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ประเภท</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">วันที่</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ผู้เข้าร่วม</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">สถานะ</th>
                    <th className="px-4 py-3.5" />
                  </tr></thead>
                  <tbody>{filtered.map((item) => (
                    <tr key={item.id} className="border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-5 py-4"><div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#DBEAFE]"><CalendarDays className="w-4 h-4 text-[#1D4ED8]" /></div>
                        <Link href={`/activities/${item.id}`} className="text-sm font-semibold hover:underline text-ink">{item.name}</Link>
                      </div></td>
                      <td className="px-4 py-4 text-sm text-faint">{item.org}</td>
                      <td className="px-4 py-4"><span className={activityTypeColors[item.type] ?? "badge badge-gray"}>{item.type}</span></td>
                      <td className="px-4 py-4 text-sm text-faint">{item.date}</td>
                      <td className="px-4 py-4"><span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Users className="w-3.5 h-3.5 text-faint" />{item.participants}</span></td>
                      <td className="px-4 py-4"><span className={`badge ${item.statusColor}`}>{item.status}</span></td>
                      <td className="px-4 py-4"><div className="flex gap-1">
                        <Link href={`/activities/${item.id}`} className="btn p-1.5 text-faint hover:bg-soft hover:text-ink" aria-label={`ดู ${item.name}`}><ArrowUpRight className="w-4 h-4" /></Link>
                        {role !== "public" && <button className="btn p-1.5 text-faint hover:bg-soft hover:text-ink" type="button" aria-label={`จัดการ ${item.name}`}><MoreHorizontal className="w-4 h-4" /></button>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
