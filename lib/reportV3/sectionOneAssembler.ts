// 2026-09-29: deep-report-prompt-8section-v6.md의 "1번 조립 매뉴얼"을 그대로 코드로 옮긴
// 것입니다. 섹션 1(당신의 웰니스 프로파일)은 이제 AI(gpt-6-sol)를 호출하지 않고, 이 함수가
// 고정 문장 뱅크만으로 즉시·결정론적으로 조립합니다 — 같은 점수 입력이면 항상 같은 결과라
// 캐싱도 필요 없고(결제 전 무료 미리보기와 결제 후 리포트가 100% 같은 내용을 보장), API
// 비용·대기 시간도 이 섹션만큼 아예 발생하지 않습니다.
//
// 화면이 마크다운을 렌더링하지 않으므로(다른 섹션과 동일한 규칙), 원문의 "볼드 소제목"은
// 전부 말머리 기호(•)로 표기합니다.
import { AXIS_KR, AXIS_ORDER, FACTOR_KR, type AxisKey, type FactorKey, type TypeCode } from "../data";
import { EUN_NEUN, I_GA } from "../josa";
import { fmtScore } from "../scoring";
import { BASE_KNOWLEDGE } from "./baseKnowledge";
import { SCENE_SEED_A } from "./sceneSeeds";

const IDENTITY_BANK: Record<TypeCode, string> = {
  "CAR-primary": "당신은 에스프레소 브라우니 유형이에요. 진하고 밀도 있게 눌러 담은 디저트처럼, 불확실함을 오래 곱씹기보다 실행으로 눌러 담아 바꾸는 쪽입니다.",
  "CAR-secondary": "당신은 티라미수 유형이에요. 커피가 시트에 천천히 스며들듯, 불확실함을 급하게 밀어내지 않고 시간을 들여 소화하는 쪽입니다.",
  "CAR-disengage": "당신은 아포가토 유형이에요. 뜨거운 에스프레소를 차가운 아이스크림에 부어 온도를 낮추듯, 뜨거운 고민을 의도적으로 식혀 거리를 두는 쪽입니다.",
  "LOV-primary": "당신은 딸기 쇼트케이크 유형이에요. 신선한 딸기를 하나씩 골라 쌓아 올리듯, 관계를 저절로 좋아지길 기다리지 않고 직접 가꾸는 쪽입니다.",
  "LOV-secondary": "당신은 베리 치즈케이크 유형이에요. 새콤한 베리를 크리미한 치즈가 부드럽게 감싸안듯, 관계의 날카로운 순간을 다르게 바라보며 누그러뜨리는 쪽입니다.",
  "LOV-disengage": "당신은 베리 소르베 유형이에요. 차갑게 스쳐 지나가듯 녹아 사라지는 디저트처럼, 관계의 무거운 감정을 붙잡기보다 시원하게 식혀 흘려보내는 쪽입니다.",
  "REL-primary": "당신은 밀푀유 유형이에요. 한 겹 한 겹 직접 쌓아 올려 만들어지는 디저트처럼, 관계의 선도 저절로 생기길 기다리기보다 스스로 하나씩 세워가는 쪽입니다.",
  "REL-secondary": "당신은 딸기마카롱 유형이에요. 매끈한 겉면 안에 부드러운 필링을 품은 디저트처럼, 겉으로는 유연하지만 안쪽에는 나름의 기준을 잘 지니고 있는 쪽입니다.",
  "REL-disengage": "당신은 머랭쿠키 유형이에요. 가볍고 바삭하게 부서지는 디저트처럼, 관계의 무거운 순간을 오래 견디기보다 살짝 물러서서 스스로를 지키는 쪽입니다.",
  "SLF-primary": "당신은 바스크 치즈케이크 유형이에요. 일부러 매끈하게 다듬지 않고 거칠게 태운 표면을 그대로 드러내는 디저트처럼, 꾸며 보이기보다 실제로 무언가를 해내며 스스로를 채워가는 쪽입니다.",
  "SLF-secondary": "당신은 마들렌 유형이에요. 익숙한 조개 모양 틀 안에서 편안하게 구워지는 디저트처럼, 나 자신을 있는 그대로의 모습 안에서 다독이는 데 익숙한 쪽입니다.",
  "SLF-disengage": "당신은 카스텔라 유형이에요. 담백하고 균일한 결을 지닌 특별한 자극 없는 디저트처럼, 나 자신에 대한 질문을 붙잡고 씨름하기보다 잔잔하게 흘려보내는 쪽입니다.",
  "DIR-primary": "당신은 피스타치오 크루아상 유형이에요. 익숙한 크루아상의 결 위에 새로운 풍미를 더해 만들어지는 디저트처럼, 방향이 궁금해지면 새로운 경험과 대화로 결을 만들어 가는 쪽입니다.",
  "DIR-secondary": "당신은 레몬 머랭 타르트 유형이에요. 새콤한 레몬을 부드러운 머랭으로 감싸 균형을 맞추는 디저트처럼, 방향에 대한 날카로운 물음을 부드럽게 다시 읽어 내는 쪽입니다.",
  "DIR-disengage": "당신은 프루트 타르트 유형이에요. 여러 과일을 정해진 배열 없이 자유롭게 얹어 만드는 디저트처럼, 방향을 하나로 정하지 않은 채 그때그때 끌리는 대로 흘러가는 쪽입니다.",
};

const MEANING_BANK: Record<AxisKey, string> = {
  CAR: "지금 일이 나와 맞는지, 하루하루의 일에서 의미와 쓸모를 느끼는지를 보는 영역입니다.",
  LOV: "지금 또는 앞으로의 연애에 대한 기대와 신뢰가 어느 정도인지를 보는 영역입니다.",
  REL: "친구·지인·가족 사이에서 내 자리를 얼마나 편안하게 느끼는지를 보는 영역입니다.",
  SLF: "조건 없이 스스로를 얼마나 괜찮다고 느끼는지를 보는 영역입니다.",
  DIR: "무엇이 중요한지, 하루가 어떤 방향으로 이어지는지에 대한 감각이 얼마나 선명한지를 보는 영역입니다.",
};

// 그 영역의 모든 하위요인이 4.00점 이상일 때(전부 튼튼할 때) 쓰는 문장.
const HIGH_SCORE_BANK: Record<AxisKey, string> = {
  CAR: "일하는 동안 '나답다'는 느낌이 드는 날이 많고, 성과가 기대에 못 미쳐도 그 일 하나로 나를 낮게 보지는 않는 편일 수 있어요.",
  LOV: "연락이 늦어지거나 사소하게 어긋나는 일이 있어도 크게 흔들리지 않고, 그 여유가 관계를 편안하게 만들어줄 수 있어요.",
  REL: "부담스러운 부탁엔 선을 긋고, 애매하게 어긋난 날에도 평소처럼 지낼 수 있어서 사람들과 있는 시간이 쉼이 되는 날이 많을 수 있어요.",
  SLF: "성과나 남의 반응이 흔들려도 나에 대한 믿음까지 함께 무너지지는 않는, 비교적 탄탄한 바탕을 갖고 있을 수 있어요.",
  DIR: "선택 앞에서 기준이 비교적 분명해서, 결정하고 나서 뒤돌아보는 시간이 짧은 편일 수 있어요.",
};

// 확정(가장 낮은) 영역을 뺀 나머지 4개 영역의 순위(1~4위, 점수 내림차순) → 문장.
const RANK_BANK: Record<number, string> = {
  1: "다섯 영역 중 가장 높은 자리입니다.",
  2: "다섯 영역 중 두 번째로 높은 자리입니다.",
  3: "다섯 영역 중 가운데 자리입니다.",
  4: "다섯 영역 중 두 번째로 낮은 자리입니다.",
};

const EXPERT_REFERRAL =
  "다섯 영역 모두 에너지가 많이 소진된 상태로 보여요. 이 테스트는 진단이 아니지만, 이렇게 여러 영역이 동시에 무거울 때는 혼자 붙잡고 있기보다 가까운 상담 전문가나 정신건강의학과 전문의와 이야기 나눠보시는 것도 좋은 방법이 될 수 있어요.";

const AXES_FOR_DOMAIN: Record<AxisKey, FactorKey[]> = {
  CAR: ["job_fit", "meaning", "competence_cw"],
  LOV: ["partner_fit", "attachment", "tension_tol"],
  REL: ["boundary", "tension_tol", "approval_cw"],
  SLF: ["global_worth", "competence_cw", "approval_cw"],
  DIR: ["values", "meaning"],
};

function scoreStateClause(score: number, isConfirmedLowest: boolean): string {
  if (score >= 4.0) return "든든하게 채워져 있는 영역이에요";
  if (score >= 3.0) return "무난히 유지되고 있는, 살짝 신경 써주면 더 든든해질 수 있는 영역이에요";
  // 확정 영역만 3.00점 미만일 수 있습니다(규칙상 3.00 미만은 최대 하나).
  if (isConfirmedLowest) return "다섯 영역 중 에너지가 상대적으로 덜 채워진 곳이에요";
  return "무난히 유지되고 있는, 살짝 신경 써주면 더 든든해질 수 있는 영역이에요";
}

export interface SectionOneInput {
  typeCode: TypeCode;
  dessertName: string;
  axis: AxisKey; // 확정 영역
  axisScores: Record<AxisKey, number>;
  factorScores: Record<FactorKey, number>;
}

/** 섹션 1(당신의 웰니스 프로파일)을 AI 없이 고정 문장 뱅크로 조립합니다. */
export function assembleSection1(input: SectionOneInput): string[] {
  const { typeCode, dessertName, axis: confirmedAxis, axisScores, factorScores } = input;
  const paragraphs: string[] = [];

  paragraphs.push(IDENTITY_BANK[typeCode] ?? `당신은 ${dessertName} 유형이에요.`);
  paragraphs.push(
    "이 자가진단은 심리상담 전문가가 직접 고안한 자기평가도구예요. 아래 다섯 영역의 해석도 전문가가 정리한 심리학 이론에 바탕을 두고 있고, 어떤 이론인지는 이 섹션 맨 아래에서 확인하실 수 있어요."
  );

  // 확정 영역을 뺀 나머지 4개 영역의 순위(점수 내림차순, 동점이면 고정 순서로 결정론 유지).
  const rankOrder = [...AXIS_ORDER].sort((a, b) => axisScores[b] - axisScores[a] || AXIS_ORDER.indexOf(a) - AXIS_ORDER.indexOf(b));
  const rankOf: Partial<Record<AxisKey, number>> = {};
  rankOrder.forEach((a, i) => (rankOf[a] = i + 1));

  const allBelow3 = AXIS_ORDER.every((a) => axisScores[a] < 3.0);

  AXIS_ORDER.forEach((axis, idx) => {
    const axisKR = AXIS_KR[axis];
    const score = axisScores[axis];
    const isConfirmed = axis === confirmedAxis;

    paragraphs.push(`• ${axisKR} ${fmtScore(score)}점`);

    const state = scoreStateClause(score, isConfirmed);
    paragraphs.push(`${axisKR}${EUN_NEUN(axisKR)} ${fmtScore(score)}점으로, ${state}. ${MEANING_BANK[axis]}`);

    // 그 영역 하위요인 중 가장 낮은 것 하나(동점이면 배경지식 나열 순서상 먼저 나오는 것).
    const factors = AXES_FOR_DOMAIN[axis];
    let lowestFactor = factors[0];
    for (const f of factors) if (factorScores[f] < factorScores[lowestFactor]) lowestFactor = f;
    const lowestScore = factorScores[lowestFactor];

    let bodySentence: string;
    if (lowestScore < 4.0) {
      const factorKR = FACTOR_KR[lowestFactor];
      bodySentence = `특히 ${factorKR}${I_GA(factorKR)} ${fmtScore(lowestScore)}점이어서, ${SCENE_SEED_A[lowestFactor]}`;
    } else {
      bodySentence = HIGH_SCORE_BANK[axis];
    }
    const positionSentence = isConfirmed ? "이 리포트가 가장 자세히 들여다볼 곳이 바로 여기입니다." : RANK_BANK[rankOf[axis] ?? 3];
    paragraphs.push(`${bodySentence} ${positionSentence}`);

    const isLastDomain = idx === AXIS_ORDER.length - 1;
    if (isLastDomain && allBelow3) paragraphs.push(EXPERT_REFERRAL);
  });

  const theory = BASE_KNOWLEDGE[typeCode].relatedTheory;
  paragraphs.push("이 리포트는 심리상담 전문가가 정리한 아래 이론을 바탕으로 해석되었습니다.");
  paragraphs.push(`관련 이론: ${theory}`);

  return paragraphs;
}
