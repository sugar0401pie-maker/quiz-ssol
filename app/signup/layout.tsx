import { NOINDEX } from "@/lib/seo";

// 2026-11-02: 검색 결과에 나오면 안 되는 화면 — robots.txt로도 막아 두었고(app/robots.ts) 메타로도 noindex를 건다.
export const metadata = NOINDEX;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
