// 2026-09-29: generate.ts(서버 전용, "server-only")와 클라이언트 화면
// (app/result/report/view/page.tsx)이 리포트 조립 결과의 모양을 각자 따로 선언하던 걸
// 하나로 합쳤습니다 — 이 파일은 "server-only"가 아니라서 클라이언트 컴포넌트에서도
// 타입만 안전하게 가져다 쓸 수 있습니다.
export interface GeneratedSectionsV3 {
  section1: string[];
  section2: string[];
  section3: string[];
  section4: string[];
  section5: string[];
  section6: string[];
  section7: string[];
  section8: string[];
}
