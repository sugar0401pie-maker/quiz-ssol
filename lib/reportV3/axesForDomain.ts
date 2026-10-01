import type { AxisKey, FactorKey } from "../data";

// 2026-10-01: sectionOneAssembler.ts와 app/test/page.tsx에 각각 따로 있던 걸 하나로 합쳤습니다
// (lib/radarGeometry.ts를 공용으로 뺀 것과 같은 이유 — 따로 두면 숫자가 어긋날 위험이 있습니다).
// 영역(axis)별로 "그 영역의 점수를 구성하는 하위요인 3개(또는 2개)" 매핑입니다. 확정 영역
// 안에서 가장 낮은 하위요인이 곧 "주도요인"이고, 이게 유형의 성격 서술(base_knowledge)과
// lib/reportV3/averageComparison.ts의 "왜 이 유형이 나왔는지" 설명의 근거가 됩니다.
export const AXES_FOR_DOMAIN: Record<AxisKey, FactorKey[]> = {
  CAR: ["job_fit", "meaning", "competence_cw"],
  LOV: ["partner_fit", "attachment", "tension_tol"],
  REL: ["boundary", "tension_tol", "approval_cw"],
  SLF: ["global_worth", "competence_cw", "approval_cw"],
  DIR: ["values", "meaning"],
};
