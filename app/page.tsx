import type { Metadata } from "next";
import IntroClient from "@/components/IntroClient";
import { SITE_CHANNELS, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-11-02: 홈의 검색용 정보(canonical·공유 미리보기 주소). 화면 본문은 components/IntroClient.tsx(클라이언트)로 옮겼습니다.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION, siteName: SITE_NAME, locale: "ko_KR" },
};

// 네이버 '사이트 연관 채널': 루트 페이지의 구조화 데이터(Organization + sameAs). 화면에는 보이지 않습니다.
const organizationJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  sameAs: SITE_CHANNELS,
}).replace(/</g, "\\u003c");

export default function IntroPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
      <IntroClient />
    </>
  );
}
