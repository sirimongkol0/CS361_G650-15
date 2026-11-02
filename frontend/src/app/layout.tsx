import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { RoleProvider } from "@/lib/role-context";

export const metadata: Metadata = {
  title: "CSTU | PCSMS",
  description:
    "ระบบข้อมูลความร่วมมือของ CSTU ระดับปริญญาตรี มหาวิทยาลัยธรรมศาสตร์ ศูนย์รังสิต",
};

// Self-hosted at build time, so the browser never calls Google. Sarabun is not a
// variable font, so every weight the UI uses (font-medium … font-extrabold) is listed.
const sarabun = Sarabun({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body className="bg-paper text-ink flex flex-col min-h-screen">
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
