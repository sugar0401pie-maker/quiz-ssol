import type { FactorKey } from "../data";

// 2026-10-01: "전체 유형 평균 대비 차이_심층보고서용 그래프" 전달 문서(README) 4번 항목 기준.
// 지금은 "같은 유형(예: 바스크 치즈케이크) 평균"이 아니라 "15유형 샘플 리포트 전체를 통틀은
// 평균"입니다 — 아직 유저 데이터가 쌓이지 않아 같은 유형 표본이 없기 때문입니다.
//
// TODO(서비스 데이터 누적 후): type_key별 factor_scores를 집계하는 배치/쿼리로 교체하고,
// 표본이 최소 기준(예: 10명) 미만인 유형은 이 차트를 숨기거나 "데이터 쌓이는 중" 문구로
// 대체할 것. 교체 시 아래 라벨("15유형 평균")도 "같은 유형 평균"으로 바꿀 것
// (components/SubfactorDeviationChart.tsx, lib/reportV3/averageComparison.ts의 avgLabel).
export const FACTOR_AVERAGE_V1: Record<FactorKey, number> = {
  job_fit: 3.97,
  partner_fit: 3.97,
  attachment: 3.83,
  boundary: 3.8,
  global_worth: 3.97,
  values: 3.93,
  meaning: 3.63,
  tension_tol: 3.77,
  competence_cw: 3.63,
  approval_cw: 3.52,
};

// 차트/문구에서 훑는 순서 — README 예시 이미지와 동일한 순서(영역별로 대략 묶임).
export const FACTOR_DISPLAY_ORDER: FactorKey[] = [
  "job_fit",
  "meaning",
  "competence_cw",
  "partner_fit",
  "attachment",
  "tension_tol",
  "boundary",
  "approval_cw",
  "global_worth",
  "values",
];
