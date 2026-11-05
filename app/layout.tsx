import type { Metadata } from "next";
import { Gaegu, Noto_Sans_KR } from "next/font/google";
import AuthFooterLink from "@/components/AuthFooterLink";
import AttributionCapture from "@/components/AttributionCapture";
import GuestClaim from "@/components/GuestClaim";
import KakaoInit from "@/components/KakaoInit";
import { QuizProvider } from "@/lib/QuizContext";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

// Gaegu: 유형 이름(궁합 카드 포함)에만 사용 / Noto Sans KR: 그 외 모든 텍스트
const gaegu = Gaegu({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-gaegu", display: "swap" });
const noto = Noto_Sans_KR({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-noto", display: "swap" });

// 2026-11-02: 검색·공유 미리보기 기본 정보. canonical·openGraph.url은 페이지마다 달라서 공개 페이지가 각자 정합니다(홈: app/page.tsx).
// 결과·결제 등 비공개 화면은 각 폴더 layout.tsx에서 noindex로 덮어씁니다.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  robots: { index: true, follow: true },
  // Bing 웹마스터·네이버 서치어드바이저 사이트 소유 확인 — 확인 후에도 지우면 안 됩니다.
  verification: { other: { "msvalidate.01": "5F7F74F02C08FB70A6A250B0DB0A7ADF", "naver-site-verification": "5745801edc0cdfb62153a2c410c9fc743f8d73e6" } },
  openGraph: { type: "website", title: SITE_TITLE, description: SITE_DESCRIPTION, siteName: SITE_NAME, locale: "ko_KR" },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${gaegu.variable} ${noto.variable}`}>
      <body>
        <KakaoInit />
        <GuestClaim />
        <AttributionCapture />
        <QuizProvider>
          <div className="app">
            {children}
            <AuthFooterLink />
            <div className="brand-footer">
              <a href="https://ssolwellnesshouse.com" target="_blank" rel="noopener noreferrer">
                by 쏠 웰니스 하우스
              </a>
              <p className="tiny" style={{ margin: "6px 0 0" }}>
                <a href="/legal#privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a> ·{" "}
                <a href="/legal#terms" target="_blank" rel="noopener noreferrer">이용약관</a>
              </p>
              <p className="tiny" style={{ margin: "6px 0 0" }}>
                <a href="/about">이 테스트 자세히 보기</a> · <a href="/types">디저트 15유형 보기</a>
              </p>
              <p className="tiny" style={{ margin: "4px 0 0" }}>
                쏠 웰니스 하우스 · 대표 김준석 · 사업자등록번호 572-07-03549 · 통신판매업신고번호 2026-서울마포-2770
                <br />
                서울시 마포구 독막로 100 4층 408호 · 연락처 010-2835-2263 · contact@ssolwellness.com
              </p>
            </div>
          </div>
        </QuizProvider>
      </body>
    </html>
  );
}
