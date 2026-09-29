// 2026-09-29: build_report_input.py(2026-09-29 수정본)를 그대로 TypeScript로 포팅했습니다.
// 값은 전부 본인의 점수와 확정 유형만으로 결정되고, 무작위는 없습니다.
// 이전엔(2026-09-28) 궁합 상대를 카테고리당 1명으로 단순화했었는데, 이번에 원래 설계대로
// 동행형 2명·이웃형 1~2명·대조형 2명을 전부 반환하도록 되돌렸습니다(deep-report-prompt-8section-v6.md
// 6번 섹션이 이 인원수에 맞춰 다시 작성됨). 대조형 동점 처리도 build_report_input.py의
// PRIORITY 순서를 그대로 따르도록 되돌렸습니다 — 이제 2명을 다 보여주므로(예: 자기(SLF)의
// 두 후보는 인생·연애 둘 다 항상 포함됨) 예전에 발견했던 "누가 1명으로 뽑히는가" 동점 버그가
// 애초에 발생하지 않습니다.
import { AXIS_KR, DESSERT, GROUPS, MODE_KR, type AxisKey, type FactorKey, type ModeKey, type TypeCode } from "../data";
import { FACTOR_KR as FACTOR_KR_LOCAL } from "../data";

// 그룹별 대처방식 순위. 유보형은 항상 3위. G2는 용기·평온 우열 없음(관례상 용기형 앞).
const GROUP_RANK: Record<string, ModeKey[]> = {
  G1: ["primary", "secondary", "disengage"],
  G2: ["primary", "secondary", "disengage"], // 1·2위 우열 없음
  G3: ["secondary", "primary", "disengage"],
  G4: ["secondary", "primary", "disengage"],
};

// 도메인 사슬: 인생 — 진로 — 자기 — 관계 — 연애
const CHAIN: AxisKey[] = ["DIR", "CAR", "SLF", "REL", "LOV"];
const BRIDGE: Record<string, FactorKey> = {
  "DIR,CAR": "meaning",
  "CAR,SLF": "competence_cw",
  "SLF,REL": "approval_cw",
  "REL,LOV": "tension_tol",
};
function bridgeFactor(a: AxisKey, b: AxisKey): FactorKey {
  const key = [a, b].sort().join(",");
  const found = Object.entries(BRIDGE).find(([k]) => k.split(",").sort().join(",") === key);
  if (!found) throw new Error(`인접하지 않은 영역 쌍: ${a}, ${b}`);
  return found[1];
}
// 내부 전용 동점 처리 순서 — 유저에게 절대 노출하지 않음
const PRIORITY: AxisKey[] = ["DIR", "SLF", "REL", "LOV", "CAR"];

export type FitContext = "partner_fits_better" | "i_fit_better" | "no_difference";

export interface CompanionType {
  type: TypeCode;
  dessert: string;
  axis: string;
  mode: string;
  fitContext: FitContext;
}
export interface NeighborType {
  type: TypeCode;
  dessert: string;
  axis: string;
  mode: string;
  bridgeFactor: string;
}
export interface ContrastType {
  type: TypeCode;
  dessert: string;
  axis: string;
  mode: string;
}

/** 주도요인 = 확정 영역 안에서 가장 낮은 하위요인(들). 동점이면 전부 반환. */
export function leadFactors(f: Record<FactorKey, number>, axisFactors: FactorKey[]): FactorKey[] {
  const vals = axisFactors.map((k) => f[k]);
  const low = Math.min(...vals);
  return axisFactors.filter((k) => Math.abs(f[k] - low) < 1e-9);
}

/** 주도요인이 속한 그룹. 동점이고 그룹이 다르면 G2(둘 다 필요한 유형)로 처리. */
export function leadGroup(leads: FactorKey[]): string {
  const groups = new Set(
    leads.map((k) => Object.entries(GROUPS).find(([, factors]) => factors.includes(k))?.[0] ?? "G2")
  );
  return groups.size === 1 ? [...groups][0] : "G2";
}

/** 동행형: 같은 영역, 다른 대처방식 2명 — 주도요인 그룹의 대처 순위 순서 그대로(첫 번째가 더 앞선 순위). */
export function companions(axis: AxisKey, mode: ModeKey, group: string): CompanionType[] {
  const rank = GROUP_RANK[group] ?? GROUP_RANK.G2;
  const others = rank.filter((m) => m !== mode);
  return others.map((m) => {
    let fitContext: FitContext;
    if (group === "G2" && m !== "disengage" && mode !== "disengage") {
      fitContext = "no_difference"; // 이 고민엔 두 방식 모두 필요
    } else if (rank.indexOf(m) < rank.indexOf(mode)) {
      fitContext = "partner_fits_better"; // 이 고민의 성격상 상대 방식이 더 힘을 발휘
    } else {
      fitContext = "i_fit_better";
    }
    const type = `${axis}-${m}` as TypeCode;
    return { type, dessert: DESSERT[type].name, axis: AXIS_KR[axis], mode: MODE_KR[m], fitContext };
  });
}

/** 이웃형: 사슬에서 인접한 영역들(사슬 끝이면 1명, 중간이면 2명), 다리요인 점수 낮은 순. */
export function neighbors(axis: AxisKey, mode: ModeKey, f: Record<FactorKey, number>): NeighborType[] {
  const i = CHAIN.indexOf(axis);
  const adj = [i - 1, i + 1].filter((j) => j >= 0 && j < CHAIN.length).map((j) => CHAIN[j]);
  adj.sort((a, b) => {
    const fa = f[bridgeFactor(axis, a)];
    const fb = f[bridgeFactor(axis, b)];
    if (Math.abs(fa - fb) > 1e-9) return fa - fb; // 다리요인 점수 낮은 쪽 우선
    return PRIORITY.indexOf(a) - PRIORITY.indexOf(b); // 동점이면 고정 순서
  });
  return adj.map((d) => {
    const type = `${d}-${mode}` as TypeCode;
    const bf = bridgeFactor(axis, d);
    return { type, dessert: DESSERT[type].name, axis: AXIS_KR[d], mode: MODE_KR[mode], bridgeFactor: FACTOR_KR_LOCAL[bf] };
  });
}

/** 대조형: 사슬에서 가장 먼 영역 2개(가장 먼 대처방식). */
export function contrasts(axis: AxisKey, mode: ModeKey): ContrastType[] {
  const i = CHAIN.indexOf(axis);
  const cands = CHAIN.filter((d) => Math.abs(CHAIN.indexOf(d) - i) >= 2);
  cands.sort((a, b) => {
    const da = Math.abs(CHAIN.indexOf(a) - i);
    const db = Math.abs(CHAIN.indexOf(b) - i);
    if (da !== db) return db - da; // 거리가 먼 쪽 우선
    return PRIORITY.indexOf(a) - PRIORITY.indexOf(b); // 동점이면 고정 순서(build_report_input.py 그대로)
  });
  const farMode: ModeKey = mode === "disengage" ? "primary" : "disengage";
  return cands.slice(0, 2).map((d) => {
    const type = `${d}-${farMode}` as TypeCode;
    return { type, dessert: DESSERT[type].name, axis: AXIS_KR[d], mode: MODE_KR[farMode] };
  });
}
