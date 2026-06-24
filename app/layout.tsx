import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: 'גמ"ח זכרון אהרן',
  description: 'מערכת ניהול גמ"ח זכרון אהרן',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
