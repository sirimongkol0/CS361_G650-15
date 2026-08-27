import { Link } from "react-router";
import { ChevronRight, FileText, Download, Eye, CheckCircle2, Clock, Edit, AlertTriangle } from "lucide-react";

const timeline = [
  { label: "Draft", date: "1 พ.ย. 2566", done: true, current: false },
  { label: "Review", date: "15 พ.ย. 2566", done: true, current: false },
  { label: "Signed", date: "1 ม.ค. 2567", done: true, current: false },
  { label: "Active", date: "1 ม.ค. 2567", done: true, current: true },
  { label: "Renewal", date: "31 ธ.ค. 2571", done: false, current: false },
];

const relatedActivities = [
  { name: "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", date: "15 ส.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { name: "อบรมเชิงปฏิบัติการ AI for Education", date: "20 ส.ค. 2568", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { name: "โครงการวิจัยร่วม Digital Learning", date: "5 ก.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
];

export default function DocumentDetail() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs mb-5" style={{ color: "#94a3b8" }}>
        <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/documents" style={{ color: "#94a3b8" }}>เอกสารข้อตกลง</Link>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: "#4f46e5" }}>MoU กับ มหาวิทยาลัยเชียงใหม่</span>
      </nav>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              MoU ความร่วมมือทางวิชาการ มช.
            </h1>
            <span className="badge badge-green">ใช้งาน</span>
            <span className="badge badge-blue">MoU</span>
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>มหาวิทยาลัยเชียงใหม่ • เริ่ม 1 ม.ค. 2567 • หมดอายุ 31 ธ.ค. 2571</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline gap-2"><Edit className="w-4 h-4" />แก้ไข</button>
          <button className="btn btn-primary gap-2"><Download className="w-4 h-4" />ดาวน์โหลด</button>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Main */}
        <div className="space-y-5">
          {/* Info */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-4" style={{ color: "#1e293b" }}>ข้อมูลข้อตกลง</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                { label: "ประเภท", value: "MoU (Memorandum of Understanding)" },
                { label: "หน่วยงาน", value: "มหาวิทยาลัยเชียงใหม่" },
                { label: "วันที่เริ่มต้น", value: "1 มกราคม 2567" },
                { label: "วันหมดอายุ", value: "31 ธันวาคม 2571" },
                { label: "ระยะเวลา", value: "5 ปี" },
                { label: "ผู้รับผิดชอบ", value: "ผศ.ดร.วิชัย สอนดี" },
                { label: "สถานะ", value: "ใช้งาน" },
                { label: "ผู้ลงนาม (ฝ่ายเรา)", value: "รศ.ดร.ประธาน มหาวิทยาลัย" },
                { label: "ผู้ลงนาม (หน่วยงาน)", value: "รศ.ดร.สมชาย ใจดี" },
              ].map(row => (
                <div key={row.label}>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: "#94a3b8" }}>{row.label}</div>
                  <div className="text-sm font-medium" style={{ color: "#1e293b" }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-4" style={{ color: "#1e293b" }}>ขอบเขตความร่วมมือ</h2>
            <ul className="space-y-2.5">
              {[
                "การแลกเปลี่ยนนักศึกษาและบุคลากรระหว่างสองสถาบัน",
                "การจัดกิจกรรมและโครงการวิชาการร่วมกัน",
                "การวิจัยและพัฒนาร่วมกันในสาขาที่เกี่ยวข้อง",
                "การแลกเปลี่ยนข้อมูล ทรัพยากร และองค์ความรู้",
                "การพัฒนาหลักสูตรและโปรแกรมการเรียนรู้ร่วมกัน",
                "การสนับสนุนทุนการศึกษาและการฝึกอบรม",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "#374151" }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Related Activities */}
          <div className="content-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: "#1e293b" }}>กิจกรรมที่เกี่ยวข้อง</h2>
              <Link to="/activities" className="text-xs font-semibold" style={{ color: "#4f46e5" }}>ดูทั้งหมด</Link>
            </div>
            <div className="space-y-3">
              {relatedActivities.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#dbeafe" }}>
                    <Clock className="w-4 h-4" style={{ color: "#1d4ed8" }} />
                  </div>
                  <div className="flex-1">
                    <Link to="/activities/1" className="text-sm font-semibold hover:underline" style={{ color: "#1e293b" }}>{a.name}</Link>
                    <div className="text-xs" style={{ color: "#94a3b8" }}>{a.date}</div>
                  </div>
                  <span className={`badge ${a.statusColor}`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Document file */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-4" style={{ color: "#1e293b" }}>เอกสาร</h2>
            <div className="rounded-xl p-4" style={{ background: "#fef2f2", border: "2px dashed #fecaca" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#fee2e2" }}>
                  <FileText className="w-5 h-5" style={{ color: "#dc2626" }} />
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "#1e293b" }}>MoU_CMU_signed.pdf</div>
                  <div className="text-xs" style={{ color: "#94a3b8" }}>PDF • 3.2 MB • อัปโหลด 1 ม.ค. 2567</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-outline text-xs flex-1 gap-1.5 py-2">
                  <Eye className="w-3.5 h-3.5" /> ดูตัวอย่าง
                </button>
                <button className="btn btn-primary text-xs flex-1 gap-1.5 py-2">
                  <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                </button>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-5" style={{ color: "#1e293b" }}>ความคืบหน้า</h2>
            <div className="relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5" style={{ background: "#e2e8f0" }} />
              <div className="space-y-5">
                {timeline.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 relative">
                    <div className={`timeline-dot z-10 ${step.current ? "border-indigo-500 bg-indigo-500" : step.done ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"}`}
                      style={{
                        borderColor: step.current ? "#4f46e5" : step.done ? "#16a34a" : "#d1d5db",
                        background: step.current ? "#4f46e5" : step.done ? "#16a34a" : "#fff"
                      }} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold flex items-center gap-2" style={{ color: step.current ? "#4f46e5" : step.done ? "#1e293b" : "#94a3b8" }}>
                        {step.label}
                        {step.current && <span className="badge badge-indigo text-xs">ปัจจุบัน</span>}
                      </div>
                      <div className="text-xs" style={{ color: "#94a3b8" }}>{step.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Related Stakeholder link */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-3" style={{ color: "#1e293b" }}>หน่วยงาน</h2>
            <Link to="/stakeholders/1" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="avatar" style={{ background: "#ede9fe", color: "#7c3aed" }}>มช</div>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: "#1e293b" }}>มหาวิทยาลัยเชียงใหม่</div>
                <div className="text-xs" style={{ color: "#94a3b8" }}>มหาวิทยาลัย • ไทย 🇹🇭</div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "#94a3b8" }} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
