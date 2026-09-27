import type { Metadata } from "next";
import { Gaegu, Noto_Sans_KR } from "next/font/google";
import KakaoInit from "@/components/KakaoInit";
import { QuizProvider } from "@/lib/QuizContext";
import "./globals.css";

// Gaegu: 유형 이름(궁합 카드 포함)에만 사용 / Noto Sans KR: 그 외 모든 텍스트
const gaegu = Gaegu({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-gaegu", display: "swap" });
const noto = Noto_Sans_KR({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: "티파티에 초대받은 내가 디저트?! · 쏠 웰니스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${gaegu.variable} ${noto.variable}`}>
      <body>
        <KakaoInit />
        <QuizProvider>
          <div className="app">
            {children}
            <div className="brand-footer">
              <a href="https://ssolwellnesshouse.com" target="_blank" rel="noopener noreferrer">
                by 쏠 웰니스 하우스
              </a>
              <p className="tiny" style={{ margin: "6px 0 0" }}>
                <a href="/legal#privacy">개인정보처리방침</a> · <a href="/legal#terms">이용약관</a>
              </p>
              <p className="tiny" style={{ margin: "4px 0 0" }}>
                쏠 웰니스 하우스 · 대표 김준석 · 사업자등록번호 572-07-03549
                <br />
                서울시 마포구 독막로 100 4층 408호 · 연락처 010-2835-2263
              </p>
            </div>
          </div>
        </QuizProvider>
      </body>
    </html>
  );
}
