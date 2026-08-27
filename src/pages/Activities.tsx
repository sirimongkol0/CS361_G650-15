import { useState } from "react";
import { Link } from "react-router";
import { Search, Plus, ChevronRight, CalendarDays, Users, ArrowUpRight, MoreHorizontal, Filter } from "lucide-react";

const activities = [
  { id: 1, name: "อบรมเชิงปฏิบัติการ AI for Education", org: "National Taiwan University", type: "อบรม", date: "20 ส.ค. 2568", participants: 45, mou: "MoU NTU 2567", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 2, name: "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", org: "มหาวิทยาลัยเชียงใหม่", type: "สัมมนา", date: "15 ส.ค. 2568", participants: 80, mou: "MoU มช. 2567", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 3, name: "การเยี่ยมชมบริษัทและศึกษาดูงาน", org: "บริษัท เทคโนโลยี จำกัด", type: "การเยี่ยมเยือน", date: "10 ส.ค. 2568", participants: 25, mou: "MoA บ.เทคโนฯ", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { id: 4, name: "Workshop Data Science for Business", org: "University of Malaya", type: "อบรม", date: "5 ส.ค. 2568", participants: 30, mou: "MoU UM 2565", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { id: 5, name: "โครงการวิจัยร่วม AI Healthcare", org: "บริษัท ABC จำกัด", type: "การวิจัย", date: "1 ส.ค. 2568", participants: 15, mou: "MoA ABC 2568", status: "วางแผน", statusColor: "badge-purple" },
  { id: 6, name: "งาน Open Day สัมพันธ์ภาคอุตสาหกรรม", org: "สมาคมผู้ประกอบการ IT ไทย", type: "กิจกรรมวิชาการ", date: "25 ก.ค. 2568", participants: 120, mou: "MoU สมาคม IT", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 7, name: "นิทรรศการผลงานนักศึกษา Tech Expo", org: "บริษัท เทคโนโลยี จำกัด", type: "กิจกรรมวิชาการ", date: "20 ก.ค. 2568", participants: 200, mou: "MoA บ.เทคโนฯ", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 8, name: "ประชุมความร่วมมือวิจัยชีวภาพ", org: "Chulabhorn Research Institute", type: "การวิจัย", date: "15 ก.ค. 2568", participants: 18, mou: "MoU CRI 2567", status: "เสร็จสิ้น", statusColor: "badge-green" },
];

const typeColors: Record<string, string> = {
  "อบรม": "badge-blue",
  "สัมมนา": "badge-purple",
  "การเยี่ยมเยือน": "badge-indigo",
  "กิจกรรมวิชาการ": "badge-green",
  "การวิจัย": "badge-yellow",
  "กิจกรรมร่วมกับหน่วยงานภายนอก": "badge-gray",
};

export default function Activities() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"table" | "card">("table");

  const filtered = activities.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.org.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || a.type === typeFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#94a3b8" }}>
            <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "#4f46e5" }}>กิจกรรม</span>
          </nav>
          <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>กิจกรรม</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>บริหารจัดการกิจกรรมและโครงการความร่วมมือ</p>
        </div>
        <button className="btn btn-primary gap-2"><Plus className="w-4 h-4" />เพิ่มกิจกรรม</button>
      </div>

      <div className="content-card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
            <input className="input pl-9" placeholder="ค้นหากิจกรรม..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: "auto", minWidth: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">ประเภท: ทั้งหมด</option>
            {Object.keys(typeColors).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input" style={{ width: "auto", minWidth: 160 }}>
            <option>หน่วยงาน: ทั้งหมด</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 140 }}>
            <option>ช่วงเวลา: ทั้งหมด</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="เสร็จสิ้น">เสร็จสิ้น</option>
            <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
            <option value="วางแผน">วางแผน</option>
          </select>
        </div>
      </div>

      {/* Summary tags */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <span className="text-sm" style={{ color: "#64748b" }}>{filtered.length} กิจกรรม</span>
        <span className="badge badge-green">เสร็จสิ้น: {activities.filter(a => a.status === "เสร็จสิ้น").length}</span>
        <span className="badge badge-blue">กำลังดำเนินการ: {activities.filter(a => a.status === "กำลังดำเนินการ").length}</span>
        <span className="badge badge-purple">วางแผน: {activities.filter(a => a.status === "วางแผน").length}</span>
      </div>

      <div className="content-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                <th className="text-left px-5 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ชื่อกิจกรรม</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>หน่วยงาน</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ประเภท</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>วันที่</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ผู้เข้าร่วม</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>MoU ที่เกี่ยวข้อง</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>สถานะ</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="table-row-hover border-b" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#dbeafe" }}>
                        <CalendarDays className="w-4 h-4" style={{ color: "#1d4ed8" }} />
                      </div>
                      <Link to={`/activities/${a.id}`} className="text-sm font-semibold hover:underline" style={{ color: "#1e293b" }}>
                        {a.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm" style={{ color: "#64748b" }}>{a.org}</td>
                  <td className="px-4 py-4"><span className={`badge ${typeColors[a.type] || "badge-gray"}`}>{a.type}</span></td>
                  <td className="px-4 py-4 text-sm" style={{ color: "#64748b" }}>{a.date}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
                      <span className="font-semibold" style={{ color: "#1e293b" }}>{a.participants}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Link to="/documents/1" className="text-xs font-medium hover:underline" style={{ color: "#4f46e5" }}>{a.mou}</Link>
                  </td>
                  <td className="px-4 py-4"><span className={`badge ${a.statusColor}`}>{a.status}</span></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <Link to={`/activities/${a.id}`} className="btn btn-ghost p-1.5"><ArrowUpRight className="w-4 h-4" /></Link>
                      <button className="btn btn-ghost p-1.5"><MoreHorizontal className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "#64748b" }}>แสดง 1–{filtered.length} จาก {activities.length} กิจกรรม</span>
          <div className="flex gap-1">
            {[1,2,3].map(p=>(
              <button key={p} className="btn text-xs px-3 py-1.5" style={{ background: p===1?"var(--primary)":"var(--muted)", color: p===1?"#fff":"#64748b" }}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
