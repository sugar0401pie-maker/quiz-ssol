import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/seo";

// 2026-11-02: 로그인 없이 보이는 공개 문서 — 검색에 나와도 되는 페이지(app/sitemap.ts에 포함).
export const metadata: Metadata = {
  title: "민감정보 처리방침 · " + SITE_NAME,
  alternates: { canonical: "/privacy/sensitive" },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
