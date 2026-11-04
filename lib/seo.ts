import type { Metadata } from "next";

// 2026-11-02: 검색 노출(SEO) 기본 설정 — 사이트 주소·제목·설명을 한 곳에서 관리하고 robots·sitemap·메타데이터가 같이 씁니다.
export const SITE_URL = "https://quiz.ssolwellnesshouse.com";
export const SITE_NAME = "쏠 웰니스 하우스";
// 2026-11-04: 사이트와 연관된 채널(네이버 '사이트 연관 채널' 구조화 데이터의 sameAs). 채널이 바뀌면 여기만 고칩니다.
export const SITE_CHANNELS = [
  "https://www.instagram.com/ssol.wellness/",
  "https://x.com/in_the_maas",
  "https://www.threads.com/@ssol.wellnesshousemkt",
  "https://www.linkedin.com/company/ssol-wellness-house/",
];
export const SITE_TITLE = "티파티에 초대받은 내가 디저트?! · 쏠 웰니스"; // 기존 제목 유지
export const SITE_DESCRIPTION =
  "전문 심리상담사가 만든 자기이해 웰니스 테스트. 지금의 고민 영역과 대처 방식을 디저트 유형으로 알아보세요. 진단·치료를 대신하지 않습니다.";

/** 검색 결과에 나오면 안 되는 페이지(테스트 진행·결과·결제·로그인·공유 등)에 쓰는 메타데이터. */
export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

/** robots.txt에서 크롤링을 막는 경로 — 실제 라우트 이름(app/ 폴더)과 맞춰 둡니다. 폴더가 늘어나면 여기에 추가하세요. */
export const DISALLOWED_PATHS = [
  "/api/", // 서버 API 전부(결제·결과 저장·리포트 생성 등)
  "/auth/", // 로그인 후 돌아오는 처리 화면
  "/quiz/", // 응시 진행(문항·확인 화면)
  "/start", // 응시 시작(닉네임·호칭 입력)
  "/result", // 결과·리포트·결제(/result/1~11, /result/report/…)
  "/login",
  "/signup",
  "/reset-password",
  "/history", // 지난 테스트 결과
  "/match", // 결과 기반 궁합 화면
  "/test", // 내부 확인용 화면
];
