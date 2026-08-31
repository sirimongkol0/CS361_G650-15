import { Link } from "react-router";
import { ChevronRight, MapPin, Users, Calendar, FileText, Star, Download, ImageIcon, CheckCircle2, MessageSquare, User } from "lucide-react";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i=>(
        <Star key={i} className={`w-3.5 h-3.5`} fill={i<=rating?"#f59e0b":"none"} color={i<=rating?"#f59e0b":"#e2e8f0"} />
      ))}
    </div>
  );
}

const participants = [
  { name: "นายสมศักดิ์ ใจดี", role: "นักศึกษาปริญญาโท", avatar: "สศ" },
  { name: "นางสาวปวีณา เพ็ชรดี", role: "นักศึกษาปริญญาตรี", avatar: "ปว" },
  { name: "ดร.กิตติพงษ์ รักษา", role: "อาจารย์ผู้ดูแล", avatar: "กต" },
  { name: "คุณวิรัช พัฒนา", role: "วิทยากรภายนอก", avatar: "วร" },
];

const feedbackList = [
  { name: "นายสมศักดิ์ ใจดี", rating: 5, comment: "เนื้อหาตรงกับความต้องการมาก วิทยากรมีความเชี่ยวชาญสูง และกิจกรรมปฏิบัติ hands-on ช่วยให้เข้าใจได้ดีมาก" },
  { name: "นางสาวปวีณา เพ็ชรดี", rating: 5, comment: "ได้รับความรู้ใหม่เยอะมาก โดยเฉพาะเรื่อง AI application ในการศึกษา ประทับใจมากค่ะ" },
  { name: "ผู้เข้าร่วมไม่ประสงค์ออกนาม", rating: 4, comment: "ดีมาก แต่ควรเพิ่มเวลา workshop ให้มากกว่านี้" },
];

const photos = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=300&fit=crop&auto=format",
];

export default function ActivityDetail() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs mb-5" style={{ color: "#94a3b8" }}>
        <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/activities" style={{ color: "#94a3b8" }}>กิจกรรม</Link>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: "#4f46e5" }}>อบรมเชิงปฏิบัติการ AI for Education</span>
      </nav>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              อบรมเชิงปฏิบัติการ AI for Education
            </h1>
            <span className="badge badge-green">เสร็จสิ้น</span>
            <span className="badge badge-blue">อบรม</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm" style={{ color: "#64748b" }}>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />20 สิงหาคม 2568</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />ห้อง 301 อาคารวิจัย NTU</span>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />45 ผู้เข้าร่วม</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline">แก้ไข</button>
          <button className="btn btn-primary gap-2"><FileText className="w-4 h-4" />ออกรายงาน</button>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Main */}
        <div className="space-y-5">
          {/* Description */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-3" style={{ color: "#1e293b" }}>รายละเอียดกิจกรรม</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
              โครงการอบรมเชิงปฏิบัติการ "AI for Education" เป็นความร่วมมือระหว่างหลักสูตร
              กับ National Taiwan University มุ่งเน้นการนำเทคโนโลยี AI มาประยุกต์ใช้ในการเรียนการสอน
              ผู้เข้าร่วมได้รับความรู้ด้าน Machine Learning, Natural Language Processing,
              และการออกแบบประสบการณ์การเรียนรู้ที่ใช้ AI เป็นเครื่องมือ
            </p>
          </div>

          {/* Outcomes */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-4" style={{ color: "#1e293b" }}>ผลลัพธ์และผลสำเร็จ</h2>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: "ผู้เข้าร่วม", value: "45", sub: "คน", color: "#4f46e5", bg: "#ede9fe" },
                { label: "คะแนนความพึงพอใจ", value: "4.8", sub: "/ 5.0", color: "#16a34a", bg: "#dcfce7" },
                { label: "เอกสารประกอบ", value: "12", sub: "ชิ้น", color: "#d97706", bg: "#fef3c7" },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: s.bg }}>
                  <div className="text-2xl font-bold mb-0.5" style={{ color: s.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
                  <div className="text-xs" style={{ color: "#64748b" }}>{s.sub}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: "#1e293b" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <h3 className="font-semibold text-sm mb-3" style={{ color: "#1e293b" }}>ผลลัพธ์หลัก</h3>
            <ul className="space-y-2">
              {[
                "ผู้เข้าร่วม 45 คน สามารถนำ AI tools มาใช้ในการออกแบบบทเรียนได้",
                "สร้าง prototype AI-assisted learning module จำนวน 8 ชิ้น",
                "เกิดความร่วมมือวิจัยต่อเนื่องระหว่างสองสถาบัน",
                "นักศึกษา 3 คนได้รับเชิญเข้าร่วมโปรแกรมแลกเปลี่ยนที่ NTU",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#374151" }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Photos */}
          <div className="content-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: "#1e293b" }}>ภาพกิจกรรม</h2>
              <button className="btn btn-outline text-xs gap-1.5"><ImageIcon className="w-3.5 h-3.5" />เพิ่มรูป</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((src, i) => (
                <div key={i} className="rounded-xl overflow-hidden aspect-video" style={{ background: "#f1f5f9" }}>
                  <img src={src} alt={`กิจกรรม ${i+1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="content-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: "#1e293b" }}>Feedback จากผู้เข้าร่วม</h2>
              <div className="flex items-center gap-2">
                <StarRow rating={5} />
                <span className="text-sm font-bold" style={{ color: "#1e293b" }}>4.8 / 5</span>
              </div>
            </div>
            <div className="space-y-3">
              {feedbackList.map((f, i) => (
                <div key={i} className="p-4 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="avatar" style={{ background: "#ede9fe", color: "#7c3aed", width: 28, height: 28, fontSize: 11 }}>
                        {f.name[0]}
                      </div>
                      <span className="text-sm font-semibold" style={{ color: "#1e293b" }}>{f.name}</span>
                    </div>
                    <StarRow rating={f.rating} />
                  </div>
                  <p className="text-sm" style={{ color: "#64748b" }}>{f.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Info */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-4" style={{ color: "#1e293b" }}>ข้อมูลกิจกรรม</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: "หน่วยงาน", value: "National Taiwan University" },
                { label: "ประเภท", value: "อบรมเชิงปฏิบัติการ" },
                { label: "วันที่", value: "20 สิงหาคม 2568" },
                { label: "เวลา", value: "09:00 – 17:00 น." },
                { label: "สถานที่", value: "ห้อง 301 อาคารวิจัย NTU" },
                { label: "ผู้รับผิดชอบ", value: "ผศ.ดร.วิชัย สอนดี" },
              ].map(row => (
                <div key={row.label} className="flex gap-2">
                  <span className="text-xs font-semibold flex-shrink-0 mt-0.5" style={{ color: "#94a3b8", width: 100 }}>{row.label}</span>
                  <span style={{ color: "#374151" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="content-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: "#1e293b" }}>ผู้เข้าร่วม</h2>
              <span className="text-sm font-bold" style={{ color: "#4f46e5" }}>45 คน</span>
            </div>
            <div className="space-y-2.5">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="avatar" style={{ background: "#ede9fe", color: "#7c3aed", width: 32, height: 32, fontSize: 11 }}>{p.avatar}</div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#1e293b" }}>{p.name}</div>
                    <div className="text-xs" style={{ color: "#94a3b8" }}>{p.role}</div>
                  </div>
                </div>
              ))}
              <button className="text-xs font-semibold mt-1" style={{ color: "#4f46e5" }}>ดูทั้งหมด 45 คน →</button>
            </div>
          </div>

          {/* Related MoU */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-3" style={{ color: "#1e293b" }}>MoU ที่เกี่ยวข้อง</h2>
            <Link to="/documents/2" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#ede9fe" }}>
                <FileText className="w-4 h-4" style={{ color: "#7c3aed" }} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: "#1e293b" }}>MoU NTU 2567</div>
                <div className="text-xs" style={{ color: "#94a3b8" }}>หมดอายุ 31 ธ.ค. 2571</div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "#94a3b8" }} />
            </Link>
          </div>

          {/* Related Stakeholder */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-3" style={{ color: "#1e293b" }}>หน่วยงาน</h2>
            <Link to="/stakeholders/2" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="avatar" style={{ background: "#dbeafe", color: "#1d4ed8" }}>NTU</div>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: "#1e293b" }}>National Taiwan University</div>
                <div className="text-xs" style={{ color: "#94a3b8" }}>ไต้หวัน 🇹🇼</div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "#94a3b8" }} />
            </Link>
          </div>

          {/* Documents */}
          <div className="content-card p-5">
            <h2 className="font-bold mb-3" style={{ color: "#1e293b" }}>เอกสารที่เกี่ยวข้อง</h2>
            <div className="space-y-2">
              {["กำหนดการ_AI_Education.pdf", "สไลด์_Workshop.pdf", "รายชื่อผู้เข้าร่วม.xlsx"].map(f => (
                <div key={f} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "#f8fafc" }}>
                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#dc2626" }} />
                  <span className="text-xs flex-1 truncate" style={{ color: "#374151" }}>{f}</span>
                  <button><Download className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
