import { useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronRight, Globe, Mail, Phone, ExternalLink, MapPin, FileText, CalendarDays, GraduationCap, MessageSquare, Star, Download, ArrowUpRight } from "lucide-react";

const tabs = ["ภาพรวม", "MoU / MoA", "กิจกรรม", "นักศึกษาแลกเปลี่ยน", "Feedback", "เอกสาร"];

const mouList = [
  { title: "MoU ความร่วมมือทางวิชาการ พ.ศ.2567", type: "MoU", start: "1 ม.ค. 2567", expire: "31 ธ.ค. 2571", status: "active" },
  { title: "MoA แลกเปลี่ยนนักศึกษา 2566", type: "MoA", start: "15 มี.ค. 2566", expire: "14 มี.ค. 2569", status: "active" },
];

const activityList = [
  { name: "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", date: "15 ส.ค. 2568", status: "เสร็จสิ้น", participants: 80, statusColor: "badge-green" },
  { name: "อบรมเชิงปฏิบัติการ AI for Education", date: "20 ส.ค. 2568", status: "กำลังดำเนินการ", participants: 45, statusColor: "badge-blue" },
  { name: "โครงการวิจัยร่วม Digital Learning", date: "5 ก.ค. 2568", status: "เสร็จสิ้น", participants: 12, statusColor: "badge-green" },
];

const exchangeList = [
  { name: "นายสมศักดิ์ ใจดี", type: "ไปแลกเปลี่ยน", period: "ก.พ.–พ.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { name: "นางสาวปวีณา เพ็ชรดี", type: "ไปแลกเปลี่ยน", period: "มิ.ย.–ส.ค. 2568", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { name: "Miss Li Wei", type: "มารับการแลกเปลี่ยน", period: "มี.ค.–มิ.ย. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
];

const feedbackList = [
  { title: "ความพึงพอใจการอบรม AI for Education", rating: 5, date: "21 ส.ค. 2568", comment: "กิจกรรมมีประโยชน์มากและทีมวิทยากรมีความเชี่ยวชาญสูง" },
  { title: "ข้อเสนอแนะการแลกเปลี่ยนนักศึกษา", rating: 4, date: "10 ส.ค. 2568", comment: "ระบบสนับสนุนนักศึกษาควรปรับปรุงด้านข้อมูลที่พัก" },
  { title: "Feedback การสัมมนาวิชาการ", rating: 5, date: "16 ส.ค. 2568", comment: "เนื้อหาตรงกับความต้องการและเป็นประโยชน์ต่อการพัฒนาหลักสูตร" },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i<=rating?"star-filled":"star-empty"}`} fill={i<=rating?"#f59e0b":"none"} />
      ))}
    </div>
  );
}

export default function StakeholderDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("ภาพรวม");

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mb-5" style={{ color: "#94a3b8" }}>
        <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/stakeholders" style={{ color: "#94a3b8" }}>หน่วยงานคู่ความร่วมมือ</Link>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: "#4f46e5" }}>มหาวิทยาลัยเชียงใหม่</span>
      </nav>

      {/* Profile header */}
      <div className="content-card p-6 mb-5">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="avatar w-16 h-16 text-xl" style={{ background: "#ede9fe", color: "#7c3aed" }}>มช</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                มหาวิทยาลัยเชียงใหม่
              </h1>
              <span className="badge badge-green">Active</span>
              <span className="badge badge-indigo">มหาวิทยาลัย</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 text-sm" style={{ color: "#64748b" }}>
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> เชียงใหม่, ประเทศไทย 🇹🇭</span>
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> somchai@cmu.ac.th</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +66 53 941 300</span>
              <a href="#" className="flex items-center gap-1.5 hover:underline" style={{ color: "#4f46e5" }}>
                <Globe className="w-3.5 h-3.5" /> www.cmu.ac.th <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="mt-2 text-sm" style={{ color: "#64748b" }}>
              <span className="font-semibold">ผู้ประสานงาน:</span> รศ.ดร.สมชาย ใจดี
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline">แก้ไขข้อมูล</button>
            <button className="btn btn-primary">+ เพิ่มกิจกรรม</button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
          {[
            { icon: FileText, label: "Active MoU", value: "2", color: "#4f46e5", bg: "#ede9fe" },
            { icon: CalendarDays, label: "กิจกรรม", value: "12", color: "#1d4ed8", bg: "#dbeafe" },
            { icon: GraduationCap, label: "นักศึกษาแลกเปลี่ยน", value: "8", color: "#16a34a", bg: "#dcfce7" },
            { icon: MessageSquare, label: "Feedback", value: "24", color: "#be185d", bg: "#fce7f3" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: s.bg }}>
              <s.icon className="w-5 h-5 flex-shrink-0" style={{ color: s.color }} />
              <div>
                <div className="text-lg font-bold" style={{ color: "#1e293b" }}>{s.value}</div>
                <div className="text-xs" style={{ color: "#64748b" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="content-card">
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          {tabs.map(t => (
            <button key={t} className={`tab-btn ${activeTab===t?"active":""}`} onClick={() => setActiveTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "ภาพรวม" && (
            <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px" }}>
              <div>
                <h3 className="font-bold mb-3" style={{ color: "#1e293b" }}>เกี่ยวกับหน่วยงาน</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
                  มหาวิทยาลัยเชียงใหม่ (มช.) เป็นมหาวิทยาลัยของรัฐในประเทศไทย ตั้งอยู่ที่จังหวัดเชียงใหม่
                  ก่อตั้งเมื่อปี พ.ศ. 2507 เป็นมหาวิทยาลัยในภูมิภาคแห่งแรกของประเทศไทย
                  มีความเชี่ยวชาญด้านวิทยาศาสตร์เทคโนโลยี การแพทย์ และสังคมศาสตร์
                </p>
                <h3 className="font-bold mt-5 mb-3" style={{ color: "#1e293b" }}>ขอบเขตความร่วมมือ</h3>
                <ul className="space-y-2">
                  {[
                    "การแลกเปลี่ยนนักศึกษาและบุคลากร",
                    "การจัดกิจกรรมวิชาการร่วมกัน",
                    "การวิจัยและพัฒนาร่วมกัน",
                    "การแลกเปลี่ยนข้อมูลและทรัพยากรทางการศึกษา",
                    "การพัฒนาหลักสูตรร่วม",
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm" style={{ color: "#374151" }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4f46e5" }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid var(--border)" }}>
                  <h4 className="text-sm font-bold mb-3" style={{ color: "#1e293b" }}>ข้อมูลการติดต่อ</h4>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: "ผู้ติดต่อ", value: "รศ.ดร.สมชาย ใจดี" },
                      { label: "ตำแหน่ง", value: "รองคณบดีฝ่ายวิชาการ" },
                      { label: "อีเมล", value: "somchai@cmu.ac.th" },
                      { label: "โทรศัพท์", value: "+66 53 941 300" },
                    ].map(row => (
                      <div key={row.label} className="flex gap-2">
                        <span className="text-xs font-semibold flex-shrink-0 mt-0.5" style={{ color: "#94a3b8", width: 80 }}>{row.label}</span>
                        <span style={{ color: "#374151" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid var(--border)" }}>
                  <h4 className="text-sm font-bold mb-3" style={{ color: "#1e293b" }}>สถานะความร่วมมือ</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span style={{ color: "#64748b" }}>เริ่มต้น</span><span className="font-semibold">1 ม.ค. 2567</span></div>
                    <div className="flex justify-between"><span style={{ color: "#64748b" }}>หมดอายุ</span><span className="font-semibold">31 ธ.ค. 2571</span></div>
                    <div className="flex justify-between"><span style={{ color: "#64748b" }}>ระยะเวลา</span><span className="font-semibold">5 ปี</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "MoU / MoA" && (
            <div>
              <div className="flex justify-between mb-4">
                <h3 className="font-bold" style={{ color: "#1e293b" }}>เอกสารข้อตกลง</h3>
                <button className="btn btn-primary text-sm">+ เพิ่มข้อตกลง</button>
              </div>
              <div className="space-y-3">
                {mouList.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#ede9fe" }}>
                      <FileText className="w-5 h-5" style={{ color: "#7c3aed" }} />
                    </div>
                    <div className="flex-1">
                      <Link to="/documents/1" className="font-semibold text-sm hover:underline" style={{ color: "#1e293b" }}>{m.title}</Link>
                      <div className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{m.start} – {m.expire}</div>
                    </div>
                    <span className="badge badge-blue">{m.type}</span>
                    <span className="badge badge-green">ใช้งาน</span>
                    <Link to="/documents/1" className="btn btn-ghost p-1.5"><ArrowUpRight className="w-4 h-4" /></Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "กิจกรรม" && (
            <div>
              <div className="flex justify-between mb-4">
                <h3 className="font-bold" style={{ color: "#1e293b" }}>กิจกรรมทั้งหมด</h3>
              </div>
              <div className="space-y-3">
                {activityList.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#dbeafe" }}>
                      <CalendarDays className="w-5 h-5" style={{ color: "#1d4ed8" }} />
                    </div>
                    <div className="flex-1">
                      <Link to="/activities/1" className="font-semibold text-sm hover:underline" style={{ color: "#1e293b" }}>{a.name}</Link>
                      <div className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{a.date} • {a.participants} ผู้เข้าร่วม</div>
                    </div>
                    <span className={`badge ${a.statusColor}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "นักศึกษาแลกเปลี่ยน" && (
            <div className="space-y-3">
              {exchangeList.map((s, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <div className="avatar" style={{ background: "#dcfce7", color: "#16a34a" }}>{s.name[0]}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: "#1e293b" }}>{s.name}</div>
                    <div className="text-xs" style={{ color: "#94a3b8" }}>{s.type} • {s.period}</div>
                  </div>
                  <span className={`badge ${s.statusColor}`}>{s.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "Feedback" && (
            <div className="space-y-3">
              {feedbackList.map((f, i) => (
                <div key={i} className="p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-sm" style={{ color: "#1e293b" }}>{f.title}</span>
                    <StarRow rating={f.rating} />
                  </div>
                  <p className="text-sm" style={{ color: "#64748b" }}>{f.comment}</p>
                  <div className="text-xs mt-2" style={{ color: "#94a3b8" }}>{f.date}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "เอกสาร" && (
            <div className="space-y-3">
              {["MoU_CMU_signed_2567.pdf", "MoA_Exchange_CMU_2566.pdf", "รายงานกิจกรรม_2568.pdf"].map(f => (
                <div key={f} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#fee2e2" }}>
                    <FileText className="w-5 h-5" style={{ color: "#dc2626" }} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: "#1e293b" }}>{f}</div>
                    <div className="text-xs" style={{ color: "#94a3b8" }}>PDF • 2.4 MB</div>
                  </div>
                  <button className="btn btn-outline text-xs gap-1.5">
                    <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
