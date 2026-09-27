// final-ssol-wellness-v2-master-spec.md 7장 — 한글 음절의 받침(종성) 유무를 판정해 조사를
// 자동으로 붙이는 유틸리티. 문장 템플릿 안에서 영역명·요인명·유형명·숫자 뒤에 조사가 붙는
// 자리는 반드시 이 함수를 통해서만 결정합니다 — 하드코딩 금지(스펙 11장 3번 규칙).

// 숫자를 한국어로 읽었을 때(영,일,이,삼,사,오,육,칠,팔,구) 받침이 있는지 여부.
// 점수 표기(예: "2.0", "3.33")는 항상 이 마지막 숫자로 조사가 정해진다.
const DIGIT_BATCHIM: Record<string, boolean> = {
  "0": true, "1": true, "2": false, "3": true, "4": false,
  "5": false, "6": true, "7": true, "8": true, "9": false,
};

export function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1);
  if (ch in DIGIT_BATCHIM) return DIGIT_BATCHIM[ch];
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절도 숫자도 아니면 받침 없음으로 처리
  return (code - 0xac00) % 28 !== 0;
}

export function josa(word: string, pair: [string, string]): string {
  const [withBatchim, withoutBatchim] = pair;
  return hasBatchim(word) ? withBatchim : withoutBatchim;
}

// 자주 쓰는 쌍
export const EY = (w: string) => josa(w, ["이에요", "예요"]);
export const EUN_NEUN = (w: string) => josa(w, ["은", "는"]);
export const EUL_REUL = (w: string) => josa(w, ["을", "를"]);
export const I_GA = (w: string) => josa(w, ["이", "가"]);
export const GWA_WA = (w: string) => josa(w, ["과", "와"]);
export const EURO_RO = (w: string) => josa(w, ["으로", "로"]);
export const IRASEO_RASEO = (w: string) => josa(w, ["이라서", "라서"]);

// "단어(부가정보)조사" 형태를 만들 때: 조사는 단어 기준으로 계산하고, 괄호는 그 사이에 삽입
export function withParen(word: string, extra: string, josaFn: (w: string) => string): string {
  return `${word}(${extra})${josaFn(word)}`;
}
