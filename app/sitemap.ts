import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// 2026-11-02: 검색 엔진에 알려줄 공개 페이지만(로그인 없이 보이는 정적 페이지). 결과·리포트·응답·결제 등 개인 데이터 경로는 넣지 않습니다.
const LEGAL_UPDATED = new Date("2026-10-16"); // 약관·방침 시행일

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/legal`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy/sensitive`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
