import { useState } from "react";
import { Link } from "react-router";
import { Search, Plus, ChevronRight, FileText, AlertTriangle, MoreHorizontal, Download } from "lucide-react";

const documents = [
  { id: 1, title: "MoU ความร่วมมือทางวิชาการ มช.", org: "มหาวิทยาลัยเชียงใหม่", type: "MoU", start: "1 ม.ค. 2567", expire: "31 ธ.ค. 2571", responsible: "ผศ.ดร.วิชัย สอนดี", status: "active", daysLeft: 1200 },
  { id: 2, title: "MoA แลกเปลี่ยนนักศึกษา NTU", org: "National Taiwan University", type: "MoA", start: "15 มี.ค. 2566", expire: "14 มี.ค. 2569", responsible: "รศ.ดร.นงนุช ประเสริฐ", status: "active", daysLeft: 560 },
  { id: 3, title: "MoU ความร่วมมือ University of Malaya", org: "University of Malaya", type: "MoU", start: "1 มิ.ย. 2565", expire: "31 พ.ค. 2568", responsible: "ดร.กิตติพงษ์ รักษา", status: "expiring", daysLeft: 25 },
  { id: 4, title: "MoA สหกิจศึกษา บ.เทคโนโลยี", org: "บริษัท เทคโนโลยี จำกัด", type: "MoA", start: "1 ก.ค. 2565", expire: "30 มิ.ย. 2568", responsible: "ผศ.สุดา วงศ์ดี", status: "expiring", daysLeft: 15 },
  { id: 5, title: "MoU ความร่วมมือ Waseda University", org: "Waseda University", type: "MoU", start: "1 ก.พ. 2563", expire: "31 ม.ค. 2568", responsible: "รศ.ดร.มานะ ฝึกฝน", status: "expired", daysLeft: -30 },
  { id: 6, title: "MoA ฝึกงาน บ.ABC จำกัด", org: "บริษัท ABC จำกัด", type: "MoA", start: "1 ส.ค. 2568", expire: "31 ก.ค. 2571", responsible: "ผศ.ดร.ธนา ขยัน", status: "draft", daysLeft: 999 },
  { id: 7, title: "MoU ความร่วมมือ CRI", org: "Chulabhorn Research Institute", type: "MoU", start: "1 มี.ค. 2567", expire: "28 ก.พ. 2572", responsible: "ดร.นิภา วิจัย", status: "active", daysLeft: 1400 },
];

const statusMap: Record<string, { label: string; cls: string }> = {
  active: { label: "ใช้งาน", cls: "badge-green" },
  expiring: { label: "ใกล้หมดอายุ", cls: "badge-yellow" },
  expired: { label: "หมดอายุ", cls: "badge-red" },
  draft: { label: "อยู่ระหว่างจัดทำ", cls: "badge-blue" },
};

export default function Documents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("MoU / MoA");

  const filtered = documents.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.org.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchType = typeFilter === "all" || d.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#94a3b8" }}>
            <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "#4f46e5" }}>เอกสารข้อตกลง</span>
          </nav>
          <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            เอกสารข้อตกลง
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>บริหารจัดการ MoU, MoA และเอกสารความร่วมมือ</p>
        </div>
        <button className="btn btn-primary gap-2"><Plus className="w-4 h-4" />เพิ่มข้อตกลง</button>
      </div>

      {/* Warning banner */}
      {documents.filter(d => d.status === "expiring").length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl mb-5" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#d97706" }} />
          <div className="flex-1">
            <span className="font-semibold text-sm" style={{ color: "#92400e" }}>
              มี {documents.filter(d => d.status === "expiring").length} ฉบับที่ใกล้หมดอายุ
            </span>
            <span className="text-sm ml-2" style={{ color: "#b45309" }}>
              กรุณาตรวจสอบและดำเนินการต่ออายุ
            </span>
          </div>
          <button className="btn text-xs" style={{ background: "#d97706", color: "#fff" }}>ดูรายการ</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: "var(--border)" }}>
        {["MoU / MoA", "ข้อตกลงอื่น ๆ", "เอกสารทั้งหมด"].map(t => (
          <button key={t} className={`tab-btn ${activeTab===t?"active":""}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="content-card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
            <input className="input pl-9" placeholder="ค้นหาชื่อข้อตกลง, หน่วยงาน..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: "auto", minWidth: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">ประเภท: ทั้งหมด</option>
            <option value="MoU">MoU</option>
            <option value="MoA">MoA</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="active">ใช้งาน</option>
            <option value="expiring">ใกล้หมดอายุ</option>
            <option value="expired">หมดอายุ</option>
            <option value="draft">อยู่ระหว่างจัดทำ</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 180 }}>
            <option>วันหมดอายุ: ทั้งหมด</option>
            <option>ใน 30 วัน</option>
            <option>ใน 90 วัน</option>
            <option>ใน 1 ปี</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {Object.entries(statusMap).map(([key, { label, cls }]) => (
          <span key={key} className={`badge ${cls} text-xs px-3 py-1`}>
            {label}: {documents.filter(d => d.status === key).length}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="content-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                <th className="text-left px-5 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ชื่อข้อตกลง</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>หน่วยงาน</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ประเภท</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>วันที่เริ่มต้น</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>วันหมดอายุ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ผู้รับผิดชอบ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>สถานะ</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id} className="table-row-hover border-b" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: doc.status === "expired" ? "#fee2e2" : doc.status === "expiring" ? "#fef3c7" : "#ede9fe" }}>
                        <FileText className="w-4 h-4" style={{ color: doc.status === "expired" ? "#dc2626" : doc.status === "expiring" ? "#d97706" : "#7c3aed" }} />
                      </div>
                      <div>
                        <Link to={`/documents/${doc.id}`} className="text-sm font-semibold hover:underline" style={{ color: "#1e293b" }}>
                          {doc.title}
                        </Link>
                        {doc.status === "expiring" && (
                          <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "#d97706" }}>
                            <AlertTriangle className="w-3 h-3" />
                            เหลืออีก {doc.daysLeft} วัน
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm" style={{ color: "#64748b" }}>{doc.org}</td>
                  <td className="px-4 py-4"><span className="badge badge-blue">{doc.type}</span></td>
                  <td className="px-4 py-4 text-sm" style={{ color: "#64748b" }}>{doc.start}</td>
                  <td className="px-4 py-4">
                    <span className="text-sm" style={{ color: doc.status === "expired" ? "#dc2626" : doc.status === "expiring" ? "#d97706" : "#374151", fontWeight: doc.status === "expiring" ? 600 : 400 }}>
                      {doc.expire}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm" style={{ color: "#64748b" }}>{doc.responsible}</td>
                  <td className="px-4 py-4">
                    <span className={`badge ${statusMap[doc.status].cls}`}>{statusMap[doc.status].label}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link to={`/documents/${doc.id}`} className="btn btn-ghost p-1.5 text-xs">ดู</Link>
                      <button className="btn btn-ghost p-1.5"><Download className="w-3.5 h-3.5" /></button>
                      <button className="btn btn-ghost p-1.5"><MoreHorizontal className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "#64748b" }}>แสดง 1–{filtered.length} จาก {documents.length} รายการ</span>
          <div className="flex gap-1">
            {[1,2].map(p=>(
              <button key={p} className="btn text-xs px-3 py-1.5" style={{ background: p===1?"var(--primary)":"var(--muted)", color: p===1?"#fff":"#64748b" }}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
