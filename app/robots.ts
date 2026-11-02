import type { MetadataRoute } from "next";
import { DISALLOWED_PATHS, SITE_URL } from "@/lib/seo";

// 2026-11-02: 검색 로봇 안내. 공개 페이지(홈·약관·방침)는 허용하고, 응시 진행·결과·결제·로그인·공유 관련과 API는 막습니다
// (막은 경로의 화면에는 noindex 메타도 같이 넣어 두었습니다 — 각 폴더의 layout.tsx).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
