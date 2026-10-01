import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
      <h1 className="text-6xl font-extrabold font-display text-crimson mb-4">404</h1>
      <h2 className="text-2xl font-bold text-ink mb-4">ไม่พบหน้าที่ต้องการ</h2>
      <p className="text-faint mb-8">
        หน้านี้อาจไม่มีอยู่หรือถูกย้ายไปแล้ว
      </p>
      <Link href="/dashboard/public" className="btn btn-primary px-6 py-3">
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
