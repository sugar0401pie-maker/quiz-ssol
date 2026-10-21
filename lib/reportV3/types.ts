// 2026-09-29: generate.ts(서버 전용, "server-only")와 클라이언트 화면
// (app/result/report/view/page.tsx)이 리포트 조립 결과의 모양을 각자 따로 선언하던 걸
// 하나로 합쳤습니다 — 이 파일은 "server-only"가 아니라서 클라이언트 컴포넌트에서도
// 타입만 안전하게 가져다 쓸 수 있습니다.
/**
 * 2026-10-21: 섹션별로 "굵게 보여줄 문장"의 위치([문단 번호, 문장 번호]). 문장 번호는 lib/reportV3/highlight.ts의
 * splitSentencePieces 기준입니다. 리포트 생성 끝에 AI가 요약·결론 문장을 고른 결과이고, 없으면(예전 리포트) 화면이 규칙으로 대신합니다.
 */
export type SectionHighlights = Partial<Record<"section2" | "section3" | "section4" | "section5" | "section6" | "section7" | "section8", [number, number][]>>;

export interface GeneratedSectionsV3 {
  section1: string[];
  section2: string[];
  section3: string[];
  section4: string[];
  section5: string[];
  section6: string[];
  section7: string[];
  section8: string[];
  highlights?: SectionHighlights;
}
