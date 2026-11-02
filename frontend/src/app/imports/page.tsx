"use client";


import { AccessState, LoadingState } from "@/components/data-states";
import { useRole } from "@/lib/role-context";
import { useDocumentTitle } from "@/lib/list-tools";

import ImportSection from "./_components/ImportSection";
import ExportSection from "./_components/ExportSection";
import { Breadcrumb } from "@/components/breadcrumb";

export default function ImportsPage() {
  useDocumentTitle("นำเข้าและส่งออกข้อมูล");

  const { role, status: session } = useRole();

  const isManager =
    session === "authenticated" &&
    (role === "staff" || role === "admin");

  // กำลังตรวจสอบ Session
  if (session === "loading") {
    return (
      <div className="p-6">
        <LoadingState />
      </div>
    );
  }

  // ยังไม่ได้เข้าสู่ระบบ
  if (session !== "authenticated") {
    return (
      <div className="p-6">
        <AccessState status={401} />
      </div>
    );
  }

  // จำกัดเฉพาะ Staff และ Admin
  if (!isManager) {
    return (
      <div className="p-6">
        <AccessState status={403} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-xl) p-6">

      {/* Page Header */}
      <div className="mb-6">
        <Breadcrumb items={[{ label: "หน้าหลัก", href: "/" }, { label: "นำเข้าและส่งออกข้อมูล" }]} />

        <h1 className="font-display text-2xl font-bold text-ink">
          นำเข้าและส่งออกข้อมูล
        </h1>

        <p className="mt-1 text-sm text-faint">
          สำหรับเจ้าหน้าที่และผู้ดูแลระบบ • รองรับ CSV / XLSX
        </p>
      </div>

      {/* Import Feature */}
      <ImportSection />

      {/* Export Feature */}
      <ExportSection />

    </div>
  );
}