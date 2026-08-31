import { useState } from "react";
import { Link } from "react-router";
import { Search, ChevronRight, Star, Filter, X, MessageSquare, Send, CheckCircle2 } from "lucide-react";

const feedbackData = [
  { id: 1, title: "ความพึงพอใจการอบรม AI for Education", source: "ผู้เข้าร่วมกิจกรรม", org: "National Taiwan University", activity: "อบรม AI for Education", rating: 5, date: "21 ส.ค. 2568", status: "ตรวจสอบแล้ว", statusColor: "badge-green", comment: "กิจกรรมมีประโยชน์มากและทีมวิทยากรมีความเชี่ยวชาญสูง เนื้อหาตรงกับความต้องการ และกิจกรรม hands-on ทำให้เข้าใจได้ดีมาก ขอขอบคุณทีมงานทุกท่าน" },
  { id: 2, title: "ข้อเสนอแนะหลักสูตรปริญญาโท", source: "ศิษย์เก่า", org: "—", activity: "—", rating: 4, date: "18 ส.ค. 2568", status: "รอดำเนินการ", statusColor: "badge-yellow", comment: "หลักสูตรดีมากแต่อยากให้เพิ่มวิชาที่เน้น practical skills มากกว่านี้ โดยเฉพาะด้าน DevOps และ Cloud Computing ซึ่งตลาดงานต้องการมาก" },
  { id: 3, title: "Feedback จากภาคอุตสาหกรรม", source: "คู่ความร่วมมือ", org: "บริษัท เทคโนโลยี จำกัด", activity: "—", rating: 5, date: "15 ส.ค. 2568", status: "ตรวจสอบแล้ว", statusColor: "badge-green", comment: "บัณฑิตจากหลักสูตรนี้มีคุณภาพดีมาก สามารถทำงานได้จริงตั้งแต่วันแรก ขอชื่นชมทีมอาจารย์ที่เน้นการปฏิบัติจริง" },
  { id: 4, title: "ประเมินสหกิจศึกษา ภาคเรียนที่ 1/2568", source: "ระบบสหกิจศึกษา", org: "บริษัท ABC จำกัด", activity: "โครงการสหกิจศึกษา", rating: 4, date: "12 ส.ค. 2568", status: "รอดำเนินการ", statusColor: "badge-yellow", comment: "นักศึกษาขยันและเรียนรู้เร็ว แต่ควรพัฒนาทักษะการสื่อสารและการนำเสนองานให้มากขึ้น" },
  { id: 5, title: "ความพึงพอใจการสัมมนาวิชาการ", source: "ผู้เข้าร่วมกิจกรรม", org: "มหาวิทยาลัยเชียงใหม่", activity: "สัมมนาวิชาการนวัตกรรม", rating: 5, date: "16 ส.ค. 2568", status: "ตรวจสอบแล้ว", statusColor: "badge-green", comment: "เนื้อหาตรงกับความต้องการและเป็นประโยชน์ต่อการพัฒนาหลักสูตร ได้แนวคิดใหม่ ๆ กลับไปมาก" },
  { id: 6, title: "Feedback นักศึกษาแลกเปลี่ยน NTU", source: "นักศึกษา", org: "National Taiwan University", activity: "Student Exchange Program", rating: 5, date: "10 ส.ค. 2568", status: "รับทราบ", statusColor: "badge-blue", comment: "ประสบการณ์แลกเปลี่ยนครั้งนี้ดีมากเลยครับ ได้เรียนรู้วัฒนธรรมใหม่และมีโอกาสพัฒนาทักษะภาษาอังกฤษ" },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i=>(
        <Star key={i} className="w-3.5 h-3.5" fill={i<=rating?"#f59e0b":"none"} color={i<=rating?"#f59e0b":"#e2e8f0"} />
      ))}
    </div>
  );
}

const sourceColors: Record<string, string> = {
  "ผู้เข้าร่วมกิจกรรม": "badge-blue",
  "ศิษย์เก่า": "badge-purple",
  "คู่ความร่วมมือ": "badge-indigo",
  "ระบบสหกิจศึกษา": "badge-yellow",
  "นักศึกษา": "badge-green",
};

export default function Feedback() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [replyText, setReplyText] = useState("");

  const filtered = feedbackData.filter(f => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "all" || f.source === sourceFilter;
    const matchRating = ratingFilter === "all" || f.rating === parseInt(ratingFilter);
    return matchSearch && matchSource && matchRating;
  });

  const selected = feedbackData.find(f => f.id === selectedId);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#94a3b8" }}>
            <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "#4f46e5" }}>Feedback</span>
          </nav>
          <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Feedback</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>จัดการ Feedback จากทุกแหล่ง</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-4 mb-5">
        {[
          { label: "ทั้งหมด", value: feedbackData.length, color: "#4f46e5" },
          { label: "คะแนนเฉลี่ย", value: "4.5★", color: "#f59e0b" },
          { label: "ตรวจสอบแล้ว", value: feedbackData.filter(f=>f.status==="ตรวจสอบแล้ว").length, color: "#16a34a" },
          { label: "รอดำเนินการ", value: feedbackData.filter(f=>f.status==="รอดำเนินการ").length, color: "#d97706" },
          { label: "แหล่ง Feedback", value: 5, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-xl font-bold mb-0.5" style={{ color: s.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
            <div className="text-xs" style={{ color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 420px" }}>
        {/* List */}
        <div>
          <div className="content-card p-4 mb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
                <input className="input pl-9" placeholder="ค้นหา Feedback..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="input" style={{ width: "auto", minWidth: 180 }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                <option value="all">แหล่ง: ทั้งหมด</option>
                {Object.keys(sourceColors).map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select className="input" style={{ width: "auto", minWidth: 140 }} value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
                <option value="all">คะแนน: ทั้งหมด</option>
                {[5,4,3,2,1].map(r=><option key={r} value={r}>{r} ดาว</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map(f => (
              <div
                key={f.id}
                className="content-card p-4 cursor-pointer transition-all"
                style={{
                  borderColor: selectedId === f.id ? "#4f46e5" : "var(--border)",
                  borderWidth: selectedId === f.id ? 2 : 1,
                }}
                onClick={() => setSelectedId(f.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold leading-snug flex-1" style={{ color: "#1e293b" }}>{f.title}</p>
                  <span className={`badge ${f.statusColor} flex-shrink-0`}>{f.status}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`badge ${sourceColors[f.source] || "badge-gray"} text-xs`}>{f.source}</span>
                  <StarRow rating={f.rating} />
                  <span className="text-xs" style={{ color: "#94a3b8" }}>{f.date}</span>
                </div>
                {f.org !== "—" && (
                  <div className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>
                    🏢 {f.org}
                    {f.activity !== "—" && <> • 📅 {f.activity}</>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="space-y-4 sticky top-6">
            <div className="content-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-base mb-1" style={{ color: "#1e293b" }}>{selected.title}</h2>
                  <span className={`badge ${selected.statusColor}`}>{selected.status}</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="btn btn-ghost p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#fef3c7" }}>
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <StarRow rating={selected.rating} />
                    <span className="font-bold text-lg" style={{ color: "#1e293b" }}>{selected.rating} / 5</span>
                  </div>
                  <div className="text-xs" style={{ color: "#94a3b8" }}>{selected.date}</div>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                {[
                  { label: "แหล่ง", value: selected.source },
                  { label: "หน่วยงาน", value: selected.org },
                  { label: "กิจกรรม", value: selected.activity },
                ].filter(r => r.value !== "—").map(row => (
                  <div key={row.label} className="flex gap-3">
                    <span className="text-xs font-semibold mt-0.5" style={{ color: "#94a3b8", width: 64 }}>{row.label}</span>
                    <span className="text-sm" style={{ color: "#374151" }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl mb-5" style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4" style={{ color: "#64748b" }} />
                  <span className="text-sm font-semibold" style={{ color: "#1e293b" }}>ความคิดเห็น</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{selected.comment}</p>
              </div>

              {/* Reply */}
              <div>
                <div className="text-sm font-semibold mb-2" style={{ color: "#1e293b" }}>ตอบกลับ / บันทึกการดำเนินการ</div>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="พิมพ์คำตอบหรือการดำเนินการ..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-primary gap-2 flex-1 py-2">
                    <Send className="w-3.5 h-3.5" />ส่งคำตอบ
                  </button>
                  <button className="btn btn-outline gap-2 py-2 px-3">
                    <CheckCircle2 className="w-3.5 h-3.5" />ปิด
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
