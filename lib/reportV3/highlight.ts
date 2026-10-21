// 2026-10-21: 3~10장(웰니스 프로파일부터 끝까지) 글이 길게 이어져서, "요약·결론·권유"에 해당하는 문장을 굵게 보이게 합니다.
// AI가 쓰는 글에는 표시를 넣지 않고(규칙 15: 마크다운 금지) 화면에서 문장 단위로 판정합니다 — 이미 저장된 리포트에도 바로 적용되고,
// 같은 글이면 항상 같은 결과가 나옵니다. 이미 굵게 처리되는 것(두괄식 첫 문단, • 소제목 줄, "첫째," 같은 서수 문단)은 건드리지 않습니다.
//
// 굵게 하는 문장(문단당 최대 1문장, 문단의 두 번째 문장부터):
//  1) 결론 연결어로 시작: 결국 / 그래서 / 따라서 / 즉 / 이처럼
//  2) 권유로 끝남: ~해보세요 / ~보세요 / ~해 보세요
//  3) 영역 요약: "다섯 영역 중 … 자리입니다" (웰니스 프로파일 각 영역의 순위 문장)
//  4) 핵심 지목: "가장 자세히 들여다볼 곳", "핵심은", "가장 중요한"
const CONCLUSION_START = /^(결국|그래서|따라서|즉|이처럼)[ ,]/;
const ADVICE_END = /(해보세요|해 보세요|보세요|해보셔도 좋아요)[.!]?["”’']?$/;
const AREA_SUMMARY = /다섯 영역 (중|가운데)[^.]*자리입니다\.?$/;
const KEY_PHRASE = /(가장 자세히 들여다볼 곳|핵심은|가장 중요한)/;

export interface HighlightPart {
  text: string;
  bold: boolean;
}

/**
 * 문단을 문장 조각으로 나눕니다(서버가 문장을 고를 때와 화면이 굵게 할 때 같은 번호를 쓰도록 이 함수 하나만 씁니다).
 * 조각을 이어 붙이면 원문과 똑같고, 문장 사이 공백은 다음 조각 앞에 붙어 있습니다. 소수점(1.5점)처럼 마침표 뒤에 공백이
 * 없는 곳은 자르지 않습니다.
 */
export function splitSentencePieces(text: string): string[] {
  return text.split(/(?<=[.!?])(?=\s)/);
}

/** 문장 번호(splitSentencePieces 기준)로 지정한 문장들을 굵게 하는 조각 목록으로 만듭니다. 번호가 범위 밖이면 무시합니다. */
export function highlightBySentenceIndex(paragraph: string, indices: number[]): HighlightPart[] {
  const pieces = splitSentencePieces(paragraph);
  const want = new Set(indices.filter((i) => Number.isInteger(i) && i >= 0 && i < pieces.length));
  if (want.size === 0) return [{ text: paragraph, bold: false }];
  const parts: HighlightPart[] = [];
  const push = (text: string, bold: boolean) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last && last.bold === bold) last.text += text;
    else parts.push({ text, bold });
  };
  pieces.forEach((piece, i) => {
    if (!want.has(i)) return push(piece, false);
    const lead = piece.match(/^\s*/)?.[0] ?? ""; // 굵은 글씨가 공백으로 시작하지 않게 공백은 밖으로
    push(lead, false);
    push(piece.slice(lead.length), true);
  });
  return parts;
}

function isKeySentence(sentence: string): boolean {
  const s = sentence.trim();
  if (s.length < 8) return false;
  return CONCLUSION_START.test(s) || ADVICE_END.test(s) || AREA_SUMMARY.test(s) || KEY_PHRASE.test(s);
}

/**
 * 문단을 (굵게 아님 / 굵게) 조각으로 나눕니다. 굵게 할 문장이 없으면 [{text, bold:false}] 한 조각입니다.
 * 한 문장짜리 문단은 건드리지 않습니다(문단 전체가 굵게 되면 오히려 강조가 사라져서).
 */
export function highlightKeySentence(paragraph: string): HighlightPart[] {
  const pieces = splitSentencePieces(paragraph);
  if (pieces.length < 2) return [{ text: paragraph, bold: false }];
  let pick = -1;
  for (let i = 1; i < pieces.length; i++) {
    if (isKeySentence(pieces[i])) {
      pick = i;
      break;
    }
  }
  if (pick < 0) return [{ text: paragraph, bold: false }];
  const before = pieces.slice(0, pick).join("");
  // 문장 앞 공백은 굵게 밖으로 빼서 굵은 글씨가 공백으로 시작하지 않게 합니다.
  const lead = pieces[pick].match(/^\s*/)?.[0] ?? "";
  const boldText = pieces[pick].slice(lead.length);
  const after = pieces.slice(pick + 1).join("");
  const parts: HighlightPart[] = [];
  const pre = before + lead;
  if (pre) parts.push({ text: pre, bold: false });
  parts.push({ text: boldText, bold: true });
  if (after) parts.push({ text: after, bold: false });
  return parts;
}
