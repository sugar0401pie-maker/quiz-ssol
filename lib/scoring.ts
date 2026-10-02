// final-ssol-wellness-v2-master-spec.md 5.2 — 채점 로직. 스펙의 "그대로 사용" 코드를 그대로
// 옮겼습니다. 무작위 선택은 어디에도 쓰지 않습니다 — 동점은 전부 사용자 확인 화면으로 처리합니다
// (스펙 11장 2번 규칙).
import {
  AXES,
  AXIS_ORDER,
  COPING_SUB,
  FACTORS,
  MODES,
  MODE_ORDER,
  REVERSED,
  type AxisKey,
  type CopingSubKey,
  type FactorKey,
  type ModeKey,
  type TypeCode,
} from "./data";

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
// 2026-10-02 규칙 갱신(JunSeok 인계서 표기 통일 — "4.0점, 3.8점"처럼 소수 첫째 자리로
// 고정): 예전엔 둘째 자리까지 쓰고 뒤의 0을 잘라서 "5.00→5", "3.33→3.33"처럼 자릿수가
// 들쭉날쭉했는데, 이제 항상 소수 첫째 자리 하나만 보여줍니다(5.0, 3.3, 3.8). "점"을 붙이지
// 않고 숫자만 반환 — 호출부에서 그동안 해온 대로 "점"을 붙입니다.
export function fmtScore(x: number): string {
  return x.toFixed(1);
}

export type Part1Answers = Record<string, number>; // {P01: 1..5, ...}
export type Part2Answers = Record<string, number>; // {Q01: 1..5, ...}

// 응답 누락 시 중립값(3)으로 방어 처리 (스펙 11장 5번 규칙)
function itemScore(r: Part1Answers, id: string): number {
  const v = r[id] == null ? 3 : r[id];
  return REVERSED.has(id) ? 6 - v : v;
}

export interface ScorePart1Result {
  factorScores: Record<FactorKey, number>;
  axisScores: Record<AxisKey, number>;
  mode: "single" | "tie" | "all_high";
  options: AxisKey[];
}

// 2026-09-29: "이스터에그" 히든 결과 — 5개 영역 점수가 전부 극단값(5.00 또는 1.00)이면
// 15유형 체계를 벗어난 특별 결과를 보여줍니다(심층 리포트 없음). 긍정 문항 전부 5점·역채점
// 문항 전부 1점으로 답하면(=실제 반영 점수가 전부 5) axisScores가 모두 정확히 5.00이 되고,
// 반대로 다 1점으로 답하면 모두 정확히 1.00이 됩니다(동일한 값의 평균은 항상 그 값 그대로라
// 부동소수점 오차가 없습니다 — 그래도 방어적으로 작은 허용오차를 둡니다).
export type SpecialResultKey = "cake" | "biscotti";

export function detectSpecialResult(axisScores: Record<AxisKey, number>): SpecialResultKey | null {
  const vals = Object.values(axisScores);
  if (vals.every((v) => Math.abs(v - 5) < 0.005)) return "cake";
  if (vals.every((v) => Math.abs(v - 1) < 0.005)) return "biscotti";
  return null;
}

export function scorePart1(r: Part1Answers): ScorePart1Result {
  const f = {} as Record<FactorKey, number>;
  for (const [factor, ids] of Object.entries(FACTORS) as [FactorKey, string[]][]) {
    f[factor] = mean(ids.map((id) => itemScore(r, id)));
  }
  const a = {} as Record<AxisKey, number>;
  for (const [axis, facs] of Object.entries(AXES) as [AxisKey, FactorKey[]][]) {
    a[axis] = mean(facs.map((fac) => f[fac]));
  }
  const low = Math.min(...Object.values(a));
  let mode: ScorePart1Result["mode"];
  let options: AxisKey[];
  if (low >= 4.0) {
    mode = "all_high";
    options = [...AXIS_ORDER];
  } else {
    options = AXIS_ORDER.filter((k) => Math.abs(a[k] - low) < 1e-9);
    mode = options.length > 1 ? "tie" : "single";
  }
  return { factorScores: f, axisScores: a, mode, options };
}

export interface ScorePart2Result {
  subScores: Record<CopingSubKey, number>;
  modeScores: Record<ModeKey, number>;
  leaders: ModeKey[];
}

// no reverse scoring in part 2
export function scorePart2(r2: Part2Answers): ScorePart2Result {
  const s = {} as Record<CopingSubKey, number>;
  for (const [sub, ids] of Object.entries(COPING_SUB) as [CopingSubKey, string[]][]) {
    s[sub] = mean(ids.map((id) => (r2[id] == null ? 3 : r2[id])));
  }
  const m = {} as Record<ModeKey, number>;
  for (const [mode, subs] of Object.entries(MODES) as [ModeKey, CopingSubKey[]][]) {
    m[mode] = mean(subs.map((sub) => s[sub]));
  }
  const top = Math.max(...Object.values(m));
  const leaders = MODE_ORDER.filter((k) => Math.abs(m[k] - top) < 1e-9);
  return { subScores: s, modeScores: m, leaders };
}

export function typeCode(confirmedAxis: AxisKey, copingMode: ModeKey): TypeCode {
  return `${confirmedAxis}-${copingMode}` as TypeCode;
}

// ============================================================
// 최종 결과 형태 — 화면 간 전달·DB 저장에 사용
// ============================================================
export interface QuizResultV2 {
  part1Answers: Part1Answers;
  part2Answers: Part2Answers;
  factorScores: Record<FactorKey, number>;
  axisScores: Record<AxisKey, number>;
  confirmedAxis: AxisKey;
  subScores: Record<CopingSubKey, number>;
  modeScores: Record<ModeKey, number>;
  confirmedMode: ModeKey;
  typeCode: TypeCode;
}
