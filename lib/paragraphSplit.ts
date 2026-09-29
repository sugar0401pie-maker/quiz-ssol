// 2026-09-25: "문장이 길고 문단 구분이 안 된다"는 피드백 — 4~5문장마다, 또는 "반면/그런데/
// 하지만/다만/혹은/흥미로운 건" 같은 전환 접속사로 문장이 시작될 때마다 새 문단으로 끊습니다.
// AI가 생성한 리포트 본문(및 15유형 템플릿)에 공통으로 적용하는 후처리기입니다.
const PARAGRAPH_TRIGGERS = ["반면", "그런데", "하지만", "다만", "혹은", "흥미로운 건", "흥미로운 점은"];

function splitSentences(text: string): string[] {
  // "3.33" 같은 소수점 숫자를 문장 구분자로 착각하지 않도록 잠시 보호합니다.
  const protectedText = text.replace(/(\d)\.(\d)/g, "$1<DOT>$2");
  const parts = protectedText.split(/(?<=[.!?])\s+/);
  return parts.map((p) => p.replace(/<DOT>/g, ".").trim()).filter(Boolean);
}

function startsWithTrigger(sentence: string): boolean {
  return PARAGRAPH_TRIGGERS.some((t) => sentence.startsWith(t));
}

/** 이미 문장 단위로 쪼개진 배열(예: 결정론적 조립 엔진의 parts)을 문단 배열로 묶습니다. */
export function groupSentencesIntoParagraphs(sentences: string[], maxSentences = 5): string[] {
  const groups: string[] = [];
  let current: string[] = [];
  for (const s of sentences) {
    if (current.length > 0 && (current.length >= maxSentences || startsWithTrigger(s))) {
      groups.push(current.join(" "));
      current = [s];
    } else {
      current.push(s);
    }
  }
  if (current.length > 0) groups.push(current.join(" "));
  return groups;
}

function regroupParagraph(paragraph: string, maxSentences = 5): string[] {
  return groupSentencesIntoParagraphs(splitSentences(paragraph), maxSentences);
}

/** 문단 배열(또는 문단 하나짜리 긴 문자열)을 받아, 위 규칙대로 다시 나눈 문단 배열을 돌려줍니다. */
export function splitIntoParagraphs(paragraphs: string[] | string, maxSentences = 5): string[] {
  const list = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  const out: string[] = [];
  for (const p of list) {
    if (p) out.push(...regroupParagraph(p, maxSentences));
  }
  return out;
}

// 2026-09-29: "말머리(•) 소제목이 새 문단으로 안 끊기고 바로 다음 문장에 붙어버린다"는
// 피드백 — AI가 소제목 줄 뒤에 빈 줄(\n\n) 대신 줄바꿈(\n) 하나만 쓰는 경우가 있어서,
// splitSentences가 마침표 없는 그 줄을 다음 문장에 이어 붙여버렸습니다. 마크다운을
// 문단으로 쪼개기 전에, 말머리 줄 앞뒤에 항상 빈 줄이 있도록 강제로 정리합니다.
export function normalizeBulletParagraphBreaks(markdown: string): string {
  return markdown
    .replace(/[ \t]*\n?[ \t]*•/g, "\n\n•") // 말머리 앞: 항상 빈 줄
    .replace(/(•[^\n]*)\n(?!\n)/g, "$1\n\n"); // 말머리 줄 뒤: 항상 빈 줄(이미 빈 줄이면 그대로 둠)
}
