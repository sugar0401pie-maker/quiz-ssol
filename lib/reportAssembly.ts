// final-ssol-wellness-v2-master-spec.md 8장 — 유료 심층 리포트 조립 엔진.
// **중요**: 이 리포트는 LLM(OpenAI 등) API를 호출하지 않습니다. 점수 조건에 따라 미리 정해진
// 문장 뱅크에서 문장을 고르고 조립하는 결정론적(deterministic) 시스템입니다. 같은 점수 조합이면
// 항상 같은 문장이 나옵니다. 여기에 AI 생성 코드를 추가하지 마세요(스펙 11장 4번 규칙).
import {
  AXES,
  AXIS_KR,
  BRIDGE_FACTORS,
  BRIDGE_TARGETS,
  FACTOR_KR,
  FACTORS,
  SHARED_PAIR,
  groupOf,
  type AxisKey,
  type CopingSubKey,
  type FactorKey,
  type ModeKey,
} from "./data";
import { EUL_REUL, EUN_NEUN, EURO_RO, EY, GWA_WA, I_GA, IRASEO_RASEO } from "./josa";
import { groupSentencesIntoParagraphs } from "./paragraphSplit";
import { fmtScore } from "./scoring";
import type { Part1Answers, Part2Answers } from "./scoring";

// ---- 고유 요인: 주도 요인 문장 / 분기 문장 ----
interface LeadTable {
  lead: string;
  branch?: Record<string, string> | null;
  branch3?: Record<string, string>;
  extra?: string;
}

const UNIQUE_LEAD: Partial<Record<FactorKey, LeadTable>> = {
  job_fit: {
    lead: "지금 하는 일이 나와 맞는지, 이대로 이어가도 될지에 대한 확신이 약한 상태예요. 커리어 점수를 끌어내린 건 일 그 자체와의 맞음이에요.",
    branch: null,
  },
  partner_fit: {
    lead: "앞으로의 연애를 떠올릴 때 기대보다 물음표가 더 커요.",
    branch: {
      P03: "앞으로의 연애를 생각해도 기대가 잘 생기지 않아요.",
      P04: "나에게 맞는 상대가 어떤 사람인지가 아직 흐릿해요.",
    },
  },
  attachment: {
    lead: "연애 안에서 마음이 편안하게 머물기 어려운 부분이 있어요.",
    branch: {
      P05: "상대에게 마음을 열고 기대는 게 편하지 않은 쪽이에요.",
      P06: "상대의 마음이 변할까 신경 쓰이는 순간이 많은 쪽이에요.",
    },
  },
  boundary: {
    lead: "관계 안에서 내 선을 지키는 게 요즘 어려운 상태예요.",
    branch: {
      P07: "어디까지 맞춰줘야 하는지 기준 자체가 흐릿해요.",
      P08: "기준은 있어도, 부담스러운 부탁을 거절하는 게 쉽지 않아요.",
    },
  },
  global_worth: {
    lead: "조건과 상관없이 나를 괜찮게 느끼는 바탕이 요즘 얇은 상태예요.",
    branch: null,
  },
  values: {
    lead: "무엇이 나에게 중요한지, 선택할 때 무엇을 기준으로 삼을지가 흐릿한 상태예요.",
    branch: null,
  },
};

// ---- 다리 요인: 주도 요인 문장 / 분기 문장 ----
const BRIDGE_LEAD: Partial<Record<FactorKey, LeadTable>> = {
  meaning: {
    lead: "하루하루나 지금 하는 일이 무엇을 위한 것인지, 의미를 느끼기 어려운 상태예요.",
    branch: {
      P14: "특히 지금 하는 일이 결국 무엇을 위한 건지가 잘 보이지 않아요.",
      P13: "특히 일상 자체가 의미 있게 느껴지지 않아요.",
    },
  },
  tension_tol: {
    lead: "관계에 풀리지 않은 게 남아 있을 때, 그 상태를 안고 평소처럼 지내기가 어려운 편이에요.",
    branch: {
      P15: "애매한 감정이 남아 있으면 다른 일에 집중이 잘 안 돼요.",
      P16: "다툰 뒤 완전히 풀리기 전까지는 함께 무언가를 하기가 어려워요.",
    },
    extra: "이 질문들은 연인뿐 아니라 관계 전반에 대한 것이라, 연애와 관계 점수에 함께 반영돼요.",
  },
  competence_cw: {
    lead: "성과가 나를 평가하는 잣대와 가깝게 붙어 있어요.",
    branch: {
      P18: "원했던 성과를 내지 못하면 내 가치까지 낮아지는 것처럼 느껴져요.",
      P17: "그 잣대가 다른 사람에게도 향해서, 내 기준에 못 미치는 모습을 보면 유독 답답해져요.",
    },
  },
  approval_cw: {
    lead: "다른 사람의 반응이 나를 느끼는 방식과 가깝게 연결되어 있어요.",
    branch3: {
      P19: "주변 사람들이 나를 어떻게 볼지에 따라 기분이 흔들려요.",
      P20: "좋은 모습만 보여야 한다는 부담이 있어요.",
      P21: "누군가 실망하면 나를 대하는 태도도 함께 차가워지기 쉬워요.",
    },
  },
};

// 2026-09-25: 문장이 죽 이어져 있어 읽기 힘들다는 피드백 — 문항(섹션)당 몇 개 문단으로
// 나눕니다(4~5문장마다, 또는 "반면/그런데/하지만" 같은 전환 접속사가 나오면 새 문단).
// 문장 내용·순서는 그대로 두고 표시 방식만 바꾸는 것이라 스펙 11장 1번 규칙(문구를 임의로
// 다듬지 않는다)에 어긋나지 않습니다.
function toParagraphs(parts: string[], maxSentences = 3): string[] {
  return groupSentencesIntoParagraphs(parts, maxSentences);
}

function otherAxisOf(bridgeFactor: string, axis: AxisKey): AxisKey {
  const targets = BRIDGE_TARGETS[bridgeFactor];
  return targets.find((a) => a !== axis)!;
}

function highestFactorOf(axis: AxisKey, factorScores: Record<FactorKey, number>): FactorKey {
  const facs = AXES[axis];
  let best = facs[0];
  for (const f of facs) if (factorScores[f] > factorScores[best]) best = f;
  return best;
}

// ============================================================
// 2. 주 고민 영역 해부
// ============================================================
export interface Section2Result {
  text: string[];
  leadFactor: FactorKey;
  connectedAxis: AxisKey | null;
}

export function buildSection2(
  confirmedAxis: AxisKey,
  factorScores: Record<FactorKey, number>,
  axisScores: Record<AxisKey, number>,
  rawAnswers: Part1Answers
): Section2Result {
  const axisScore = axisScores[confirmedAxis];
  const facs = AXES[confirmedAxis];
  const leadFactor = facs.reduce((a, b) => (factorScores[b] < factorScores[a] ? b : a));
  const leadTied = facs.filter((f) => Math.abs(factorScores[f] - factorScores[leadFactor]) < 1e-9);

  const parts: string[] = [];

  const axisKR = AXIS_KR[confirmedAxis];
  const leadKR = FACTOR_KR[leadFactor];
  if (axisScore < 3.0) {
    parts.push(
      `오각형에서 가장 안쪽으로 들어온 꼭짓점은 ${axisKR}(${fmtScore(axisScore)})${EY(axisKR)}. ` +
        `${axisKR} 점수는 ${facs.length}가지 요인으로 이루어져 있는데, 그중 가장 낮은 건 ${leadKR}(${fmtScore(factorScores[leadFactor])})${EY(leadKR)}.`
    );
  } else {
    const sc = fmtScore(axisScore);
    parts.push(
      `${axisKR}${I_GA(axisKR)} 오각형에서 가장 안쪽이긴 하지만, 점수 자체는 ${sc}${EURO_RO(sc)} 보통 이상이에요. 다른 영역보다 상대적으로 에너지가 덜 채워진 곳 정도로 보면 돼요.`
    );
  }

  const usedBridgeInfo: FactorKey[] = [];
  for (const lf of leadTied) {
    const table = BRIDGE_FACTORS.has(lf) ? BRIDGE_LEAD[lf] : UNIQUE_LEAD[lf];
    if (!table) continue;
    parts.push(table.lead);

    const ids = FACTORS[lf];
    if (table.branch3) {
      let minId = ids[0];
      for (const id of ids) if (rawAnswers[id] < rawAnswers[minId]) minId = id;
      parts.push(table.branch3[minId]);
    } else if (table.branch) {
      const [idA, idB] = ids;
      const vA = rawAnswers[idA];
      const vB = rawAnswers[idB];
      if (Math.abs(vA - vB) >= 1) {
        const lowerId = vA < vB ? idA : idB;
        parts.push(table.branch[lowerId]);
      } else {
        parts.push(table.branch[idA] + " " + table.branch[idB]);
      }
    }
    if (table.extra) parts.push(table.extra);

    if (BRIDGE_FACTORS.has(lf)) usedBridgeInfo.push(lf);
  }

  // 특수 문장
  if (confirmedAxis === "CAR" && leadTied.includes("meaning") && factorScores.job_fit >= 3.0) {
    parts.push(
      "흥미로운 점은, 일 자체는 나와 맞는 편이라고 답하셨다는 거예요. 일이 문제라기보다 일에서 의미를 찾지 못하는 게 커리어 점수로 드러난 것에 가까워요."
    );
  }
  if (
    confirmedAxis === "SLF" &&
    (leadTied.includes("competence_cw") || leadTied.includes("approval_cw")) &&
    factorScores.global_worth >= 3.0
  ) {
    parts.push("평소엔 나를 괜찮게 느끼는 편이지만, 성과나 다른 사람의 반응이 흔들릴 때 그 느낌도 함께 흔들릴 수 있어요.");
  }

  // 연결 영역 문장
  let connectedAxisUsed: AxisKey | null = null;
  for (const lf of usedBridgeInfo) {
    const other = otherAxisOf(lf, confirmedAxis);
    connectedAxisUsed = other;
    const otherScore = axisScores[other];
    const lfKR = FACTOR_KR[lf];
    const otherKR = AXIS_KR[other];
    if (otherScore < 3.0) {
      const sc = fmtScore(otherScore);
      parts.push(
        `${lfKR}${EUN_NEUN(lfKR)} ${otherKR} 점수에도 함께 들어가는 요인이에요. ${otherKR} 점수도 ${sc}${EURO_RO(sc)} 함께 낮아서, 두 영역의 고민이 같은 뿌리를 공유하고 있을 수 있어요.`
      );
    } else {
      const bestFac = highestFactorOf(other, factorScores);
      const bestFacKR = FACTOR_KR[bestFac];
      const sc = fmtScore(otherScore);
      parts.push(
        `${lfKR}${EUN_NEUN(lfKR)} ${otherKR} 점수에도 들어가지만, ${otherKR}${EUN_NEUN(otherKR)} ${sc}${EURO_RO(sc)} 비교적 괜찮게 유지되고 있어요. ${otherKR}의 다른 요인인 ${bestFacKR}${I_GA(bestFacKR)} 받쳐주고 있기 때문이에요.`
      );
    }
  }

  // 동반 요인 문장
  const companions = facs.filter((f) => !leadTied.includes(f) && factorScores[f] < 3.0);
  for (const c of companions) {
    const sc = fmtScore(factorScores[c]);
    parts.push(`${FACTOR_KR[c]}도 ${sc}${EURO_RO(sc)} 함께 낮아서, 이 영역에서는 한 가지보다 여러 부분이 같이 무거운 상태예요.`);
  }

  return { text: toParagraphs(parts), leadFactor: leadTied[0], connectedAxis: connectedAxisUsed };
}

// ============================================================
// 3. 프로파일 모양
// ============================================================
export function buildSection3(
  axisScores: Record<AxisKey, number>,
  factorScores: Record<FactorKey, number>,
  section2LeadFactor: FactorKey,
  section2ConnectedAxis: AxisKey | null
): string | null {
  const low = (Object.keys(axisScores) as AxisKey[]).filter((a) => axisScores[a] < 3.0);
  const k = low.length;

  if (k === 0) {
    const lowest = (Object.keys(axisScores) as AxisKey[]).reduce((a, b) => (axisScores[b] < axisScores[a] ? b : a));
    const sc = fmtScore(axisScores[lowest]);
    return `모든 영역이 보통 이상이에요. 가장 낮은 ${AXIS_KR[lowest]}도 ${sc}${IRASEO_RASEO(sc)}, 전반적으로 균형이 잡힌 시기예요.`;
  }
  if (k === 1) {
    return `고민이 ${AXIS_KR[low[0]]} 한 곳에 모여 있는 시기예요. 다른 영역은 모두 보통 이상이에요.`;
  }
  if (k === 2) {
    const shared = SHARED_PAIR.find((sp) => sp.pair.every((a) => low.includes(a)));
    if (shared) {
      const alreadySaid =
        section2ConnectedAxis && shared.pair.includes(section2ConnectedAxis) && shared.factor === section2LeadFactor;
      if (alreadySaid) return null;
      const a1 = AXIS_KR[shared.pair[0]];
      const a2 = AXIS_KR[shared.pair[1]];
      const fk = FACTOR_KR[shared.factor];
      return `${a1}${GWA_WA(a1)} ${a2} 두 곳이 함께 무거워요. 두 영역은 ${fk}${EUL_REUL(fk)} 공유해서, 같은 뿌리에서 온 고민일 수 있어요.`;
    }
    const b1 = AXIS_KR[low[0]];
    const b2 = AXIS_KR[low[1]];
    return `${b1}${GWA_WA(b1)} ${b2} 두 곳이 함께 무거워요. 두 영역은 공유하는 요인이 없어서, 서로 다른 두 고민이 한꺼번에 온 시기로 볼 수 있어요.`;
  }
  if (k >= 3 && k <= 4) {
    const candidates = Object.keys(BRIDGE_TARGETS)
      .map((bf) => {
        const targets = BRIDGE_TARGETS[bf];
        const coverage = targets.filter((a) => low.includes(a)).length;
        return { bf: bf as FactorKey, coverage, targets };
      })
      .filter((c) => c.coverage >= 1);
    if (candidates.length === 0) return null;

    let best = candidates.reduce((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage > a.coverage ? b : a;
      return factorScores[b.bf] < factorScores[a.bf] ? b : a;
    });
    if (best.bf === section2LeadFactor && candidates.length > 1) {
      const alt = candidates.filter((c) => c.bf !== section2LeadFactor);
      best = alt.reduce((a, b) => {
        if (b.coverage !== a.coverage) return b.coverage > a.coverage ? b : a;
        return factorScores[b.bf] < factorScores[a.bf] ? b : a;
      });
    }
    return `여러 영역이 동시에 무거운 시기예요. 이럴 땐 영역마다 따로 보기보다, 여러 영역에 함께 걸린 ${FACTOR_KR[best.bf]}부터 살펴보는 게 도움이 될 수 있어요.`;
  }
  if (k === 5) {
    return "다섯 영역 모두 보통보다 낮아요. 요즘 전반적으로 버거운 시기일 수 있어요. 혼자 정리하기보다 믿을 만한 사람이나 전문가와 함께 살펴보는 걸 권해요.";
  }
  return null;
}

// ============================================================
// 4. 대처 상세
// ============================================================
const MODE_IMBALANCE: Record<ModeKey, { A: string; B: string; subA: CopingSubKey; subB: CopingSubKey }> = {
  primary: {
    A: "직접 계획하고 실행하는 쪽으로 기울어 있고, 누군가에게 털어놓거나 조언을 구하는 건 상대적으로 적어요. 혼자 해결하는 쪽이에요.",
    B: "누군가에게 털어놓고 조언을 구하는 쪽으로 기울어 있고, 직접 계획하고 실행하는 건 상대적으로 적어요.",
    subA: "problem_solving",
    subB: "support",
  },
  secondary: {
    A: "상황을 다르게 해석하고 배울 점을 찾는 쪽으로 기울어 있고, 바꿀 수 없는 걸 그대로 두는 건 상대적으로 적어요.",
    B: "바꿀 수 없는 건 받아들이고 기대를 조정하는 쪽으로 기울어 있고, 상황을 새롭게 해석하는 건 상대적으로 적어요.",
    subA: "reframing",
    subB: "acceptance",
  },
  disengage: {
    A: "고민을 머릿속에서 밀어두는 쪽이에요. 관련된 상황을 피하거나 시도를 멈추는 데까지는 가지 않았어요.",
    B: "관련된 사람이나 상황을 피하거나, 시도를 멈추는 쪽으로 기울어 있어요.",
    subA: "cog_avoid",
    subB: "beh_avoid",
  },
};
const MODE_KR_LOCAL: Record<ModeKey, string> = { primary: "1차통제", secondary: "2차통제", disengage: "이탈" };

export function buildSection4(modeScores: Record<ModeKey, number>, subScores: Record<CopingSubKey, number>): string[] {
  const order = (Object.keys(modeScores) as ModeKey[]).sort((a, b) => modeScores[b] - modeScores[a]);
  const [top, second] = order;
  const parts: string[] = [];
  const topKR = MODE_KR_LOCAL[top];
  const secondKR = MODE_KR_LOCAL[second];
  parts.push(`${topKR}${EUL_REUL(topKR)} 가장 많이 써요(${fmtScore(modeScores[top])}). 그다음은 ${secondKR}(${fmtScore(modeScores[second])})${EY(secondKR)}.`);

  const applicable = order.filter((m) => m === top || modeScores[m] >= 3.0);
  for (const m of applicable) {
    const conf = MODE_IMBALANCE[m];
    const diff = subScores[conf.subA] - subScores[conf.subB];
    if (Math.abs(diff) >= 1.0) {
      parts.push(diff > 0 ? conf.A : conf.B);
    } else {
      parts.push("두 방식을 고르게 써요.");
    }
  }

  const widthCount = Object.values(modeScores).filter((v) => v >= 3.0).length;
  const widthNames = order.filter((m) => modeScores[m] >= 3.0).map((m) => MODE_KR_LOCAL[m]);
  let widthLine: string;
  if (widthCount === 0) widthLine = "이 고민에 대해 어떤 방식도 자주 쓰진 않아요. 특별히 무언가를 하고 있지는 않은 상태에 가까워요.";
  else if (widthCount === 1) widthLine = "한 가지 방식에 주로 기대고 있어요.";
  else if (widthCount === 2) widthLine = `${widthNames[0]}${GWA_WA(widthNames[0])} ${widthNames[1]}${EUL_REUL(widthNames[1])} 함께 쓰고 있어요.`;
  else widthLine = "세 가지 방식을 모두 자주 써요.";
  parts.push(widthLine);

  return toParagraphs(parts, 2);
}

// ============================================================
// 5. 고민과 대처의 궁합
// ============================================================
const FIT_SENTENCES: Record<string, string> = {
  "G1-primary": "이 고민은 직접 움직여서 바뀔 여지가 큰 편인데, 실제로 직접 해결하는 방식을 가장 많이 쓰고 있어요. 고민의 성격과 잘 맞는 방식이에요.",
  "G1-secondary": "받아들이고 다르게 보는 힘이 있어요. 다만 이 고민은 상황을 직접 바꿔서 달라질 여지도 큰 편이라, 작은 행동 하나를 더해보는 것도 방법이 될 수 있어요.",
  "G1-disengage": "지금은 이 고민과 거리를 두고 있어요. 이 고민은 직접 움직였을 때 바뀔 여지가 큰 편이라, 여유가 생기면 작은 행동부터 시작해볼 수 있어요.",
  "G2-primary": "직접 찾아 나서는 방식을 많이 써요. 이 고민은 움직여서 달라지는 부분과 관점이 바뀌어야 풀리는 부분이 섞여 있어서, 다르게 바라보는 방식을 함께 쓰면 도움이 될 수 있어요.",
  "G2-secondary": "받아들이고 다르게 바라보는 방식을 많이 써요. 이 고민은 관점만큼 직접 탐색하는 행동으로도 달라지는 부분이 있어서, 그 방식을 함께 쓰면 도움이 될 수 있어요.",
  "G2-disengage": "지금은 이 고민과 거리를 두고 있어요. 이 고민은 직접 탐색하는 것과 관점을 바꾸는 것, 두 방향 모두로 풀릴 수 있는 종류예요.",
  "G3-primary": "직접 해결하려는 힘이 있어요. 다만 이 고민은 상황보다 내 마음의 반응이 핵심인 경우가 많아서, 애써 풀려는데 잘 안 풀리는 느낌이 들 수 있어요. 다르게 바라보거나 받아들이는 방식이 도움이 될 때가 많아요.",
  "G3-secondary": "이 고민은 내 마음의 반응이 핵심인 경우가 많은데, 실제로 다르게 바라보고 받아들이는 방식을 가장 많이 쓰고 있어요. 고민의 성격과 잘 맞는 방식이에요.",
  "G3-disengage": "지금은 이 고민과 거리를 두고 있어요. 이 고민은 피하기보다 불편함을 잠시 그대로 두고 바라볼 때 조금씩 가벼워지는 경우가 많아요.",
  "G4-primary": "직접 해결하려는 힘이 있어요. 다만 이 고민은 성과나 다른 사람의 반응에 내 가치가 걸려 있는 문제라, 더 잘하거나 더 맞춰주는 방식으로 풀려고 하면 오히려 그 조건이 더 단단해질 수 있어요.",
  "G4-primary-approval": '도움을 구하는 힘은 큰 자원이에요. 다만 그 도움이 "나 괜찮지?"를 확인받는 쪽으로만 흐르면, 괜찮다는 느낌이 계속 다른 사람에게 달려 있게 될 수 있어요.',
  "G4-secondary": "다르게 바라보는 방식을 많이 쓰고 있어요. 이 고민은 성과나 반응과 나 자신을 조금 떼어놓고 볼 때 가벼워지는 경우가 많아서, 잘 맞는 방식이에요.",
  "G4-disengage": "지금은 거리를 두고 있어요. 평가가 걸린 상황을 피하면 당장은 편하지만, 괜찮다는 느낌은 여전히 그 조건에 묶여 있을 수 있어요.",
};

export function buildSection5(
  leadFactor: FactorKey,
  primaryMode: ModeKey,
  subScores: Record<CopingSubKey, number>
): { text: string | null; comboKey: string | null } {
  const group = groupOf(leadFactor);
  if (!group) return { text: null, comboKey: null };
  let key = `${group}-${primaryMode}`;
  if (
    group === "G4" &&
    primaryMode === "primary" &&
    subScores.support - subScores.problem_solving >= 1.0 &&
    leadFactor === "approval_cw"
  ) {
    key = "G4-primary-approval";
  }
  const text = FIT_SENTENCES[key] || FIT_SENTENCES[`${group}-${primaryMode}`];
  return { text: text ?? null, comboKey: `${group}×${primaryMode}` };
}

// ============================================================
// 6. 특수 플래그
// ============================================================
export function buildSection6(
  confirmedAxis: AxisKey,
  subScores: Record<CopingSubKey, number>,
  rawPart2: Part2Answers,
  factorScores: Record<FactorKey, number>
): string[] {
  const flags: string[] = [];
  if (subScores.acceptance >= 4.0 && rawPart2.Q11 >= 4) {
    flags.push("받아들인다고 느끼지만, 실은 손을 놓은 쪽에 가까울 수 있어요.");
  }
  if (["LOV", "REL"].includes(confirmedAxis) && factorScores.tension_tol < 3.0 && rawPart2.Q12 >= 4) {
    flags.push("관계의 애매함이 견디기 어려워서, 그 상황 자체를 피하게 되는 흐름일 수 있어요.");
  }
  if (
    factorScores.global_worth > 3.0 &&
    (factorScores.competence_cw < 3.0 || factorScores.approval_cw < 3.0) &&
    confirmedAxis !== "SLF"
  ) {
    flags.push("평소엔 나를 괜찮게 느끼는 편이지만, 성과나 다른 사람의 반응이 흔들릴 때 그 느낌도 함께 흔들릴 수 있어요.");
  }
  return flags;
}

// ============================================================
// 7. 이번 주 제안
// ============================================================
const SUGGESTIONS: Record<string, string> = {
  "G1×primary": "지금 방식을 유지하되, 이번 주엔 그 방식이 잘 통한 순간을 하나 기록해보기",
  "G3×secondary": "지금 방식을 유지하되, 이번 주엔 그 방식이 잘 통한 순간을 하나 기록해보기",
  "G4×secondary": "지금 방식을 유지하되, 이번 주엔 그 방식이 잘 통한 순간을 하나 기록해보기",
  "G1×secondary": "이 고민과 관련해 10분 안에 할 수 있는 행동 하나를 정해서 해보기",
  "G1×disengage": "이 고민과 관련해 10분 안에 할 수 있는 행동 하나를 정해서 해보기",
  "G2×secondary": "이 고민과 관련해 10분 안에 할 수 있는 행동 하나를 정해서 해보기",
  "G2×primary": "이 고민을 친한 친구가 겪고 있다면 뭐라고 말해줄지 적어보기",
  "G3×primary": "이 고민을 친한 친구가 겪고 있다면 뭐라고 말해줄지 적어보기",
  "G3×disengage": "그 불편함이 올라올 때 1분만 피하지 않고, 몸 어디에서 느껴지는지 살펴보기",
  "G2×disengage": "그 불편함이 올라올 때 1분만 피하지 않고, 몸 어디에서 느껴지는지 살펴보기",
  "G4×primary": "결과와 상관없이, 이번 주 내가 들인 노력 하나를 스스로 인정해보기",
  "G4×disengage": "결과와 상관없이, 이번 주 내가 들인 노력 하나를 스스로 인정해보기",
};
export function buildSection7(comboKey: string | null): string | null {
  return comboKey ? SUGGESTIONS[comboKey] ?? null : null;
}

// ============================================================
// 전체 리포트 조립
// ============================================================
export interface AssembledReport {
  section2: string[];
  section3: string | null;
  section4: string[];
  section5: string | null;
  section6: string[];
  section7: string | null;
}

export function assembleReport(
  confirmedAxis: AxisKey,
  confirmedMode: ModeKey,
  factorScores: Record<FactorKey, number>,
  axisScores: Record<AxisKey, number>,
  subScores: Record<CopingSubKey, number>,
  modeScores: Record<ModeKey, number>,
  part1Answers: Part1Answers,
  part2Answers: Part2Answers
): AssembledReport {
  const s2 = buildSection2(confirmedAxis, factorScores, axisScores, part1Answers);
  const s3 = buildSection3(axisScores, factorScores, s2.leadFactor, s2.connectedAxis);
  const s4 = buildSection4(modeScores, subScores);
  const s5 = buildSection5(s2.leadFactor, confirmedMode, subScores);
  const s6 = buildSection6(confirmedAxis, subScores, part2Answers, factorScores);
  const s7 = buildSection7(s5.comboKey);
  return { section2: s2.text, section3: s3, section4: s4, section5: s5.text, section6: s6, section7: s7 };
}
