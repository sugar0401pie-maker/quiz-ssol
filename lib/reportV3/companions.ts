// 2026-09-28: server_logic_v3.py를 그대로 TypeScript로 포팅한 것입니다. 값은 전부 본인의
// 점수와 확정 유형만으로 결정되고, 무작위는 없습니다. (인계서 5장 "궁합 선택 규칙" 참고)
import { AXIS_KR, DESSERT, GROUPS, MODE_KR, type AxisKey, type FactorKey, type ModeKey, type TypeCode } from "../data";

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

// 2026-09-28: v6 프롬프트/샘플 반영 — 궁합 상대를 동행형·이웃형·대조형 각 2명(또는 1~2명)이
// 아니라 카테고리당 정확히 1명만 다루도록 단순화. 순위/정렬 로직은 그대로 두고 1위만 취합니다.

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

/** 동행형: 같은 영역, 다른 대처방식 1명 — 주도요인 그룹의 대처 순위에서 가장 앞선 상대. */
export function companions(axis: AxisKey, mode: ModeKey, group: string): CompanionType {
  const rank = GROUP_RANK[group] ?? GROUP_RANK.G2;
  const m = rank.filter((k) => k !== mode)[0];
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
}

/** 이웃형: 사슬에서 인접한 영역 중 다리요인 점수가 가장 낮은(=가장 강하게 이어진) 1명. */
export function neighbors(axis: AxisKey, mode: ModeKey, f: Record<FactorKey, number>): NeighborType {
  const i = CHAIN.indexOf(axis);
  const adj = [i - 1, i + 1].filter((j) => j >= 0 && j < CHAIN.length).map((j) => CHAIN[j]);
  adj.sort((a, b) => {
    const fa = f[bridgeFactor(axis, a)];
    const fb = f[bridgeFactor(axis, b)];
    if (Math.abs(fa - fb) > 1e-9) return fa - fb; // 다리요인 점수 낮은 쪽 우선
    return PRIORITY.indexOf(a) - PRIORITY.indexOf(b); // 동점이면 고정 순서
  });
  const d = adj[0];
  const type = `${d}-${mode}` as TypeCode;
  const bf = bridgeFactor(axis, d);
  return { type, dessert: DESSERT[type].name, axis: AXIS_KR[d], mode: MODE_KR[mode], bridgeFactor: FACTOR_KR_LOCAL[bf] };
}

// neighbors()에서만 쓰는 다리요인 한글명 — data.ts의 FACTOR_KR과 값이 같지만, 순환 import를
// 피하려고 여기서 직접 import했습니다.
import { FACTOR_KR as FACTOR_KR_LOCAL } from "../data";

/** 대조형: 사슬에서 가장 먼 영역·가장 먼 대처방식 중 1명. */
export function contrasts(axis: AxisKey, mode: ModeKey): ContrastType {
  const i = CHAIN.indexOf(axis);
  const cands = CHAIN.filter((d) => Math.abs(CHAIN.indexOf(d) - i) >= 2);
  // 2026-09-28: 동점(자기(SLF)만 인생·연애 양끝과 거리 2로 동률) 처리 순서를 PRIORITY
  // 오름차순(인생 우선)에서 사슬 뒤쪽(연애 쪽) 우선으로 뒤집었습니다 — server_logic_v3.py의
  // PRIORITY 순서를 그대로 따르면 인생이 이겨야 하지만, JunSeok이 직접 쓴 자기 3유형
  // 샘플(바스크·마들렌·카스텔라) 전부가 예외 없이 연애 쪽을 대조형으로 골라, 원본 스크립트의
  // 동점 처리에 반영 안 된 실수로 보고 샘플 쪽(연애 우선)을 기준으로 맞췄습니다.
  cands.sort((a, b) => {
    const da = Math.abs(CHAIN.indexOf(a) - i);
    const db = Math.abs(CHAIN.indexOf(b) - i);
    if (da !== db) return db - da; // 거리가 먼 쪽 우선
    return CHAIN.indexOf(b) - CHAIN.indexOf(a); // 동점이면 사슬 뒤쪽(연애 방향) 우선
  });
  const farMode: ModeKey = mode === "disengage" ? "primary" : "disengage";
  const d = cands[0];
  const type = `${d}-${farMode}` as TypeCode;
  return { type, dessert: DESSERT[type].name, axis: AXIS_KR[d], mode: MODE_KR[farMode] };
}
