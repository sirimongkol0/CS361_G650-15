"use client";

// Ported from legacy/figma-mock/src/pages/StakeholderDetail.tsx (Next.js App Router + TU theme tokens).

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  Globe,
  Mail,
  Phone,
  ExternalLink,
  MapPin,
  FileText,
  CalendarDays,
  GraduationCap,
  MessageSquare,
  Star,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { stakeholderOrganizations } from "../data";

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
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "text-[#F59E0B]" : "text-line"}`}
          fill={i <= rating ? "#f59e0b" : "none"}
        />
      ))}
    </div>
  );
}

export default function StakeholderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const org = stakeholderOrganizations.find((o) => o.id === id);

  // Mock detail content is written for the first organization (มหาวิทยาลัยเชียงใหม่);
  // fall back to it when the id does not resolve.
  const name = org?.name ?? "มหาวิทยาลัยเชียงใหม่";
  const initials = org?.initials ?? "มช";
  const avatarBg = org?.bg ?? "#ede9fe";
  const avatarColor = org?.color ?? "#7c3aed";

  const [activeTab, setActiveTab] = useState("ภาพรวม");

  const tabCls = (t: string) =>
    `px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
      activeTab === t
        ? "text-crimson border-crimson font-semibold"
        : "text-faint border-transparent hover:text-ink hover:bg-soft rounded-t-md"
    }`;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mb-5 text-faint">
        <Link href="/" className="text-faint hover:text-crimson">หน้าหลัก</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/stakeholders" className="text-faint hover:text-crimson">หน่วยงานคู่ความร่วมมือ</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-crimson">{name}</span>
      </nav>

      {/* Profile header */}
      <div className="bg-white border border-line rounded-lg shadow-card p-6 mb-5">
        <div className="flex items-start gap-5 flex-wrap">
          <div
            className="flex items-center justify-center rounded-full font-bold w-16 h-16 text-xl shrink-0"
            style={{ background: avatarBg, color: avatarColor }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-ink font-display">{name}</h1>
              <span className="badge badge-green">Active</span>
              <span className="badge bg-[#E0E7FF] text-[#4338CA]">{org?.type ?? "มหาวิทยาลัย"}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 text-sm text-faint">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> เชียงใหม่, ประเทศไทย 🇹🇭</span>
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> somchai@cmu.ac.th</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +66 53 941 300</span>
              <a href="#" className="flex items-center gap-1.5 hover:underline text-crimson">
                <Globe className="w-3.5 h-3.5" /> www.cmu.ac.th <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="mt-2 text-sm text-faint">
              <span className="font-semibold">ผู้ประสานงาน:</span> รศ.ดร.สมชาย ใจดี
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline">แก้ไขข้อมูล</button>
            <button className="btn btn-primary">+ เพิ่มกิจกรรม</button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-5 border-t border-line">
          {[
            { icon: FileText, label: "Active MoU", value: "2", color: "#4f46e5", bg: "#ede9fe" },
            { icon: CalendarDays, label: "กิจกรรม", value: "12", color: "#1d4ed8", bg: "#dbeafe" },
            { icon: GraduationCap, label: "นักศึกษาแลกเปลี่ยน", value: "8", color: "#16a34a", bg: "#dcfce7" },
            { icon: MessageSquare, label: "Feedback", value: "24", color: "#be185d", bg: "#fce7f3" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: s.bg }}>
              <s.icon className="w-5 h-5 flex-shrink-0" style={{ color: s.color }} />
              <div>
                <div className="text-lg font-bold text-ink">{s.value}</div>
                <div className="text-xs text-faint">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-line rounded-lg shadow-card">
        <div className="flex border-b border-line overflow-x-auto">
          {tabs.map((t) => (
            <button key={t} className={tabCls(t)} onClick={() => setActiveTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "ภาพรวม" && (
            <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px" }}>
              <div>
                <h3 className="font-bold mb-3 text-ink">เกี่ยวกับหน่วยงาน</h3>
                <p className="text-sm leading-relaxed text-faint">
                  มหาวิทยาลัยเชียงใหม่ (มช.) เป็นมหาวิทยาลัยของรัฐในประเทศไทย ตั้งอยู่ที่จังหวัดเชียงใหม่
                  ก่อตั้งเมื่อปี พ.ศ. 2507 เป็นมหาวิทยาลัยในภูมิภาคแห่งแรกของประเทศไทย
                  มีความเชี่ยวชาญด้านวิทยาศาสตร์เทคโนโลยี การแพทย์ และสังคมศาสตร์
                </p>
                <h3 className="font-bold mt-5 mb-3 text-ink">ขอบเขตความร่วมมือ</h3>
                <ul className="space-y-2">
                  {[
                    "การแลกเปลี่ยนนักศึกษาและบุคลากร",
                    "การจัดกิจกรรมวิชาการร่วมกัน",
                    "การวิจัยและพัฒนาร่วมกัน",
                    "การแลกเปลี่ยนข้อมูลและทรัพยากรทางการศึกษา",
                    "การพัฒนาหลักสูตรร่วม",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-mute">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-crimson" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl p-4 bg-[#F8FAFC] border border-line">
                  <h4 className="text-sm font-bold mb-3 text-ink">ข้อมูลการติดต่อ</h4>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: "ผู้ติดต่อ", value: "รศ.ดร.สมชาย ใจดี" },
                      { label: "ตำแหน่ง", value: "รองคณบดีฝ่ายวิชาการ" },
                      { label: "อีเมล", value: "somchai@cmu.ac.th" },
                      { label: "โทรศัพท์", value: "+66 53 941 300" },
                    ].map((row) => (
                      <div key={row.label} className="flex gap-2">
                        <span className="text-xs font-semibold flex-shrink-0 mt-0.5 text-faint" style={{ width: 80 }}>
                          {row.label}
                        </span>
                        <span className="text-mute">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-4 bg-[#F8FAFC] border border-line">
                  <h4 className="text-sm font-bold mb-3 text-ink">สถานะความร่วมมือ</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-faint">เริ่มต้น</span><span className="font-semibold text-ink">1 ม.ค. 2567</span></div>
                    <div className="flex justify-between"><span className="text-faint">หมดอายุ</span><span className="font-semibold text-ink">31 ธ.ค. 2571</span></div>
                    <div className="flex justify-between"><span className="text-faint">ระยะเวลา</span><span className="font-semibold text-ink">5 ปี</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "MoU / MoA" && (
            <div>
              <div className="flex justify-between mb-4">
                <h3 className="font-bold text-ink">เอกสารข้อตกลง</h3>
                <button className="btn btn-primary text-sm">+ เพิ่มข้อตกลง</button>
              </div>
              <div className="space-y-3">
                {mouList.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-line">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#ede9fe]">
                      <FileText className="w-5 h-5 text-[#7c3aed]" />
                    </div>
                    <div className="flex-1">
                      <Link href="/documents/1" className="font-semibold text-sm hover:underline text-ink">{m.title}</Link>
                      <div className="text-xs mt-0.5 text-faint">{m.start} – {m.expire}</div>
                    </div>
                    <span className="badge badge-blue">{m.type}</span>
                    <span className="badge badge-green">ใช้งาน</span>
                    <Link href="/documents/1" className="btn p-1.5 text-faint hover:bg-soft hover:text-ink">
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "กิจกรรม" && (
            <div>
              <div className="flex justify-between mb-4">
                <h3 className="font-bold text-ink">กิจกรรมทั้งหมด</h3>
              </div>
              <div className="space-y-3">
                {activityList.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-line">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#dbeafe]">
                      <CalendarDays className="w-5 h-5 text-[#1d4ed8]" />
                    </div>
                    <div className="flex-1">
                      <Link href="/activities/1" className="font-semibold text-sm hover:underline text-ink">{a.name}</Link>
                      <div className="text-xs mt-0.5 text-faint">{a.date} • {a.participants} ผู้เข้าร่วม</div>
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
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-line">
                  <div
                    className="flex items-center justify-center rounded-full font-bold text-sm shrink-0 w-9 h-9"
                    style={{ background: "#dcfce7", color: "#16a34a" }}
                  >
                    {s.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-ink">{s.name}</div>
                    <div className="text-xs text-faint">{s.type} • {s.period}</div>
                  </div>
                  <span className={`badge ${s.statusColor}`}>{s.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "Feedback" && (
            <div className="space-y-3">
              {feedbackList.map((f, i) => (
                <div key={i} className="p-4 rounded-xl border border-line">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-sm text-ink">{f.title}</span>
                    <StarRow rating={f.rating} />
                  </div>
                  <p className="text-sm text-faint">{f.comment}</p>
                  <div className="text-xs mt-2 text-faint">{f.date}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "เอกสาร" && (
            <div className="space-y-3">
              {["MoU_CMU_signed_2567.pdf", "MoA_Exchange_CMU_2566.pdf", "รายงานกิจกรรม_2568.pdf"].map((f) => (
                <div key={f} className="flex items-center gap-4 p-4 rounded-xl border border-line">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#fee2e2]">
                    <FileText className="w-5 h-5 text-[#dc2626]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-ink">{f}</div>
                    <div className="text-xs text-faint">PDF • 2.4 MB</div>
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
