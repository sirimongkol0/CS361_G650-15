import { useState } from "react";
import { Link } from "react-router";
import { Search, Plus, ChevronRight, GraduationCap, ArrowUpRight, ArrowDownLeft, Filter, MoreHorizontal } from "lucide-react";

const students = [
  { id: 1, name: "นายสมศักดิ์ ใจดี", type: "outbound", from: "หลักสูตรวิทยาการคอมพิวเตอร์", to: "National Taiwan University", period: "ก.พ.–พ.ค. 2568", program: "Student Exchange", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 2, name: "นางสาวปวีณา เพ็ชรดี", type: "outbound", from: "หลักสูตรวิทยาการคอมพิวเตอร์", to: "University of Malaya", period: "มิ.ย.–ส.ค. 2568", program: "Student Exchange", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { id: 3, name: "นายธนวัฒน์ พรสวรรค์", type: "outbound", from: "หลักสูตรวิศวกรรมซอฟต์แวร์", to: "Waseda University", period: "ก.ย.–ธ.ค. 2568", program: "Internship", status: "กำลังสมัคร", statusColor: "badge-yellow" },
  { id: 4, name: "Miss Li Wei", type: "inbound", from: "National Taiwan University", to: "หลักสูตรวิทยาการคอมพิวเตอร์", period: "มี.ค.–มิ.ย. 2568", program: "Student Exchange", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 5, name: "Mr. Ahmad Faiz", type: "inbound", from: "University of Malaya", to: "หลักสูตรวิทยาการคอมพิวเตอร์", period: "ก.ค.–ต.ค. 2568", program: "Research Exchange", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { id: 6, name: "นางสาวกัลยา รักษ์ดี", type: "outbound", from: "หลักสูตรวิทยาการคอมพิวเตอร์", to: "Chulabhorn Research Institute", period: "ส.ค.–ก.ย. 2568", program: "Research Internship", status: "วางแผน", statusColor: "badge-purple" },
  { id: 7, name: "Mr. Takeshi Tanaka", type: "inbound", from: "Waseda University", to: "หลักสูตรวิศวกรรมซอฟต์แวร์", period: "ต.ค.–ธ.ค. 2568", program: "Student Exchange", status: "กำลังสมัคร", statusColor: "badge-yellow" },
];

const statusMap: Record<string, string> = {
  "เสร็จสิ้น": "badge-green",
  "กำลังดำเนินการ": "badge-blue",
  "กำลังสมัคร": "badge-yellow",
  "วางแผน": "badge-purple",
};

export default function StudentExchange() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.to.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || s.type === typeFilter;
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#94a3b8" }}>
            <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "#4f46e5" }}>นักศึกษาแลกเปลี่ยน</span>
          </nav>
          <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>นักศึกษาแลกเปลี่ยน</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>บริหารจัดการโครงการแลกเปลี่ยนนักศึกษา</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline gap-2 text-sm">
            <Filter className="w-4 h-4" />ส่งออก
          </button>
          <button className="btn btn-primary gap-2"><Plus className="w-4 h-4" />เพิ่มนักศึกษา</button>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl mb-5" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#dbeafe" }}>
          <GraduationCap className="w-4 h-4" style={{ color: "#1d4ed8" }} />
        </div>
        <p className="text-sm" style={{ color: "#1d4ed8" }}>
          <span className="font-semibold">Security & Privacy:</span> ข้อมูลส่วนตัวนักศึกษาถูกปกป้องตาม PDPA
          การแสดงผลถูกควบคุมตามสิทธิ์ผู้ใช้ (Role-based Access)
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "ทั้งหมด", value: students.length, color: "#4f46e5", bg: "#ede9fe" },
          { label: "ไปแลกเปลี่ยน (Outbound)", value: students.filter(s=>s.type==="outbound").length, color: "#1d4ed8", bg: "#dbeafe" },
          { label: "มารับการแลกเปลี่ยน (Inbound)", value: students.filter(s=>s.type==="inbound").length, color: "#16a34a", bg: "#dcfce7" },
          { label: "กำลังดำเนินการ", value: students.filter(s=>s.status==="กำลังดำเนินการ").length, color: "#d97706", bg: "#fef3c7" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl font-bold mb-1" style={{ color: s.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
            <div className="text-xs" style={{ color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="content-card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
            <input className="input pl-9" placeholder="ค้นหาชื่อนักศึกษา, สถาบัน..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: "auto", minWidth: 180 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">ประเภท: ทั้งหมด</option>
            <option value="outbound">ไปแลกเปลี่ยน (Outbound)</option>
            <option value="inbound">มารับการแลกเปลี่ยน (Inbound)</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="เสร็จสิ้น">เสร็จสิ้น</option>
            <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
            <option value="กำลังสมัคร">กำลังสมัคร</option>
            <option value="วางแผน">วางแผน</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 140 }}>
            <option>ช่วงเวลา: ทั้งหมด</option>
            <option>2568</option>
            <option>2567</option>
          </select>
        </div>
      </div>

      <div className="content-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                <th className="text-left px-5 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ชื่อ-นามสกุล</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ประเภท</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>จาก / ไป</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ช่วงเวลา</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>โครงการ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>สถานะ</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="table-row-hover border-b" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="avatar" style={{
                        background: s.type === "outbound" ? "#dbeafe" : "#dcfce7",
                        color: s.type === "outbound" ? "#1d4ed8" : "#16a34a",
                        width: 36, height: 36, fontSize: 12
                      }}>
                        {s.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "#1e293b" }}>{s.name}</div>
                        <div className="text-xs" style={{ color: "#94a3b8" }}>{s.from.replace("หลักสูตร", "")}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      {s.type === "outbound"
                        ? <ArrowUpRight className="w-4 h-4" style={{ color: "#1d4ed8" }} />
                        : <ArrowDownLeft className="w-4 h-4" style={{ color: "#16a34a" }} />
                      }
                      <span className={`badge ${s.type==="outbound"?"badge-blue":"badge-green"}`}>
                        {s.type === "outbound" ? "ไปแลกเปลี่ยน" : "มารับ"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm" style={{ color: "#1e293b" }}>
                      {s.type === "outbound" ? `→ ${s.to}` : `← ${s.from}`}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm" style={{ color: "#64748b" }}>{s.period}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge badge-indigo text-xs">{s.program}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${s.statusColor}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <button className="btn btn-ghost p-1.5 text-xs">ดู</button>
                      <button className="btn btn-ghost p-1.5"><MoreHorizontal className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "#64748b" }}>แสดง 1–{filtered.length} จาก {students.length} คน</span>
          <div className="flex gap-1">
            <button className="btn text-xs px-3 py-1.5" style={{ background: "var(--primary)", color: "#fff" }}>1</button>
            <button className="btn text-xs px-3 py-1.5" style={{ background: "var(--muted)", color: "#64748b" }}>2</button>
          </div>
        </div>
      </div>
    </div>
  );
}
