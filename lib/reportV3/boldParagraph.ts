// 2026-09-30: components/ReportParagraph.tsx(화면, React)와 lib/reportV3/emailHtml.ts
// (이메일, 문자열 HTML)가 "•로 시작하는 소제목 줄"과 "첫째,/둘째,... 서수 접두어"를
// 굵게 표시하는 같은 규칙을 각자 정규식으로 따로 들고 있었습니다 — 규칙이 바뀌면
// (실제로 이번 세션에서 규칙 17이 추가되며 한 번 바뀌었습니다) 한쪽만 고치고 다른 쪽을
// 깜빡하기 쉬운 구조였습니다. 판정 로직만 이 파일 하나로 모으고, 실제 렌더링(React
// <strong> vs HTML 문자열)은 각자 담당합니다.
export const ORDINAL_PREFIX = /^(첫째|둘째|셋째|넷째|다섯째),/;
export const BULLET_LINE = /^•/;

export interface BoldSplit {
  /** 굵게 표시할 부분. 굵게 표시할 게 없으면 빈 문자열입니다. */
  boldText: string;
  /** boldText 뒤에 이어지는 나머지 텍스트(전체를 굵게 표시하는 경우 빈 문자열). */
  restText: string;
}

/**
 * forceBold(두괄식 요약 문단처럼 위치로 정해지는 경우)이거나 "•"로 시작하면 문단
 * 전체를, "첫째,"류 서수로 시작하면 그 접두어만 굵게 표시하도록 판정합니다.
 */
export function splitBoldParagraph(text: string, forceBold = false): BoldSplit {
  if (forceBold || BULLET_LINE.test(text)) return { boldText: text, restText: "" };
  const m = text.match(ORDINAL_PREFIX);
  if (m) return { boldText: m[0], restText: text.slice(m[0].length) };
  return { boldText: "", restText: text };
}
