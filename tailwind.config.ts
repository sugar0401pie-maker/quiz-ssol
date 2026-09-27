import type { Config } from "tailwindcss";

// 색상 토큰: 실제 값(라이트/다크)은 app/globals.css 의 CSS 변수에 정의되어 있고,
// 여기서는 그 변수를 Tailwind color 토큰으로 노출합니다.
// 주의: --white 는 다크모드에서 어두운 카드색으로 바뀌므로 Tailwind 기본 `white` 를 덮어쓰지 않도록 `surface` 로 등록했습니다.
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "var(--navy)", // 포인트 색 (버튼, 유형 이름, 큰 헤드라인)
        "navy-soft": "var(--navy-soft)",
        sky: "var(--sky)",
        "sky-bg": "var(--sky-bg)", // 전체 배경, 카드 대비용 크림색
        surface: "var(--white)", // 카드/입력 배경
        ink: "var(--ink)", // 본문 읽기용 진한 텍스트
        text2: "var(--text2)",
        text3: "var(--text3)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: ["var(--font-noto)", "Noto Sans KR", "sans-serif"],
        gaegu: ["var(--font-gaegu)", "Gaegu", "sans-serif"], // 유형 이름 전용
      },
    },
  },
  plugins: [],
};
export default config;
