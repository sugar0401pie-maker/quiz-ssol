// 2026-09-29: deep-report-prompt-8section-v6.md의 "1번 조립 매뉴얼"을 그대로 코드로 옮긴
// 것입니다. 섹션 1(당신의 웰니스 프로파일)은 이제 AI(gpt-6-sol)를 호출하지 않고, 이 함수가
// 고정 문장 뱅크만으로 즉시·결정론적으로 조립합니다 — 같은 점수 입력이면 항상 같은 결과라
// 캐싱도 필요 없고(결제 전 무료 미리보기와 결제 후 리포트가 100% 같은 내용을 보장), API
// 비용·대기 시간도 이 섹션만큼 아예 발생하지 않습니다.
//
// 화면이 마크다운을 렌더링하지 않으므로(다른 섹션과 동일한 규칙), 원문의 "볼드 소제목"은
// 전부 말머리 기호(•)로 표기합니다.
//
// 2026-09-30: 5개 영역 중 여러 개가 같은 점수 구간에 몰려 상태 구절이 똑같이 반복되는 문제를
// 한동안 AI가 중복 문장만 다시 써서 풀었다. 2026-10-05에 이 AI 호출과 결과 캐시(section1Cache.ts)를
// 없애고, 구간별로 미리 써둔 표현 여러 개를 번갈아 쓰는 방식(STATE_VARIANTS)으로 바꿨다 — AI가
// 다시 쓰면서 "든든" 계열 표현이 오히려 늘어나던 문제가 있었고, 이제 섹션 1은 100% 같은 입력이면
// 같은 글이라 무료 미리보기·결제 후 리포트가 항상 같다(캐시가 입력과 어긋나던 문제도 함께 사라짐).
import "server-only";
import { AXES, AXIS_KR, AXIS_ORDER, FACTOR_KR, type AxisKey, type FactorKey, type TypeCode } from "../data";
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

// 특정 하위요인을 짚지 않는 범용 문장. 그 영역의 모든 하위요인이 4.0점 이상일 때, 그리고
// (2026-10-05부터) 확정 영역이 아니면서 영역 점수가 3.0 이상인 영역에 쓴다.
const HIGH_SCORE_BANK: Record<AxisKey, string> = {
  CAR: "일하는 동안 '나답다'는 느낌이 드는 날이 많고, 성과가 기대에 못 미쳐도 그 일 하나로 나를 낮게 보지는 않는 편일 수 있어요.",
  LOV: "연락이 늦어지거나 사소하게 어긋나는 일이 있어도 크게 흔들리지 않고, 그 여유가 관계를 편안하게 만들어줄 수 있어요.",
  REL: "부담스러운 부탁엔 선을 긋고, 애매하게 어긋난 날에도 평소처럼 지낼 수 있어서 사람들과 있는 시간이 쉼이 되는 날이 많을 수 있어요.",
  SLF: "성과나 남의 반응이 흔들려도 나에 대한 믿음까지 함께 무너지지는 않는, 안정적인 바탕을 갖고 있을 수 있어요.",
  DIR: "선택 앞에서 기준이 비교적 분명해서, 결정하고 나서 뒤돌아보는 시간이 짧은 편일 수 있어요.",
};

// 2026-10-05: 영역 점수 3.0~3.9인데 확정 영역은 아닌 경우의 범용 문장. 예전엔 4.0 이상 영역과
// 같은 HIGH_SCORE_BANK를 써서 "잘 되고 있다"는 쪽으로만 읽혔다. 여기는 "대체로 괜찮지만 가끔
// 한 번 더 살피게 되는" 정도의 중립적인 톤이고, 특정 하위요인은 짚지 않는다.
const MID_SCORE_BANK: Record<AxisKey, string> = {
  CAR: "일은 큰 불편 없이 이어지지만, 퇴근길에 가끔 '이 일이 나랑 맞나' 하고 떠올리는 날도 있을 수 있어요.",
  LOV: "연애에 대한 기대와 신뢰는 대체로 자리 잡고 있지만, 관계가 한 걸음 가까워질 때면 마음을 열기 전에 잠깐 망설이게 되는 순간이 있을 수 있어요.",
  REL: "사람들과는 대체로 무난하게 지내지만, 부탁을 받으면 답하기 전에 '이걸 들어줘도 되나' 하고 한 번 더 따져보는 때가 있어요.",
  SLF: "스스로를 대체로 괜찮게 느끼지만, 칭찬이나 지적을 들은 날에는 그 말에 따라 기분이 조금씩 오르내릴 수 있어요.",
  DIR: "무엇이 중요한지는 대체로 알고 있지만, 큰 결정을 앞두면 내 기준이 맞는지 한 번 더 확인하고 싶어질 수 있어요.",
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

// 2026-09-30: 예전엔 "확정 영역만 3.00점 미만일 수 있다"고 가정하고 isConfirmedLowest로
// 분기했는데, 동점·all_high 화면에서 사용자가 "다른 영역이에요"/"기타"로 수학적 최저점이
// 아닌 축을 직접 확정할 수 있어서 이 가정이 틀렸습니다 — 그 경우 실제로 3.00점 미만인
// (확정되지 않은) 축이 "무난히 유지되고 있는" 문구를 받는 모순이 있었습니다. 점수만
// 보고 판단하도록 단순화합니다(확정 여부와 무관).
//
// 2026-10-05: 구간마다 표현을 여러 개 두고, 같은 구간 영역이 둘 이상이면 나온 순서대로 다른
// 표현을 씁니다(같은 입력이면 항상 같은 결과). "든든" 계열 단어가 한 리포트에 여러 번 겹쳐
// 부담스럽다는 피드백으로, 모든 표현에서 "든든/탄탄"을 뺐습니다 — 구간당 4~5개라 5개 영역이
// 한 구간에 몰려도 같은 표현이 반복되지 않습니다.
type StateBand = "high" | "mid" | "low";
const STATE_VARIANTS: Record<StateBand, string[]> = {
  high: [
    "충분히 채워져 있는 영역이에요",
    "안정적으로 자리 잡고 있는 영역이에요",
    "여유 있게 채워져 있는 편이에요",
    "큰 걱정 없이 잘 유지되고 있는 영역이에요",
    "비교적 넉넉하게 채워진 영역이에요",
  ],
  mid: [
    "무난히 유지되고 있는, 조금만 신경 써주면 더 좋아질 수 있는 영역이에요",
    "큰 무리 없이 이어지고 있는 영역이에요",
    "보통 이상으로 유지되고 있는 영역이에요",
    "무난한 수준으로 채워져 있는 영역이에요",
    "별다른 어려움 없이 흘러가고 있는 영역이에요",
  ],
  low: [
    "다섯 영역 중 에너지가 상대적으로 덜 채워진 곳이에요",
    "다섯 영역 가운데 충만함이 비교적 덜한 곳이에요",
    "다른 영역에 비해 마음이 덜 채워진 곳이에요",
  ],
};

function stateBand(score: number): StateBand {
  if (score >= 4.0) return "high";
  if (score >= 3.0) return "mid";
  return "low";
}

export interface SectionOneInput {
  typeCode: TypeCode;
  dessertName: string;
  userName: string;
  title: string;
  axis: AxisKey; // 확정 영역
  axisScores: Record<AxisKey, number>;
  factorScores: Record<FactorKey, number>;
}

interface AxisPart {
  axis: AxisKey;
  axisKR: string;
  score: number;
  /** STATE_VARIANTS에서 고른 상태 구절(같은 구간 영역이 여럿이면 순서대로 다른 표현). */
  state: string;
  bodySentence: string;
  positionSentence: string;
}

interface SectionOneParts {
  intro: string[];
  perAxis: AxisPart[];
  allBelow3: boolean;
  closing: string[];
}

function buildSectionOneParts(input: SectionOneInput): SectionOneParts {
  const { typeCode, dessertName, userName, title, axis: confirmedAxis, axisScores, factorScores } = input;

  const intro = [
    // 2026-10-01: 오각형 그래프 바로 다음에 — "이 그래프가 무엇을 보여주고, 더 자세한 내용은
    // 어디서 보는지"를 먼저 짚어줍니다(사장님 피드백, 기존 "가장 크게 나눠지는 5개 기준"
    // 표현을 이 리포트에서 이미 쓰고 있는 "다섯 영역" 용어로 다듬음). 심층 리포트 본문에서도
    // 이 문장 바로 다음에 실제로 하위요인별 평균 대비 그래프(lib/reportV3/averageComparison.ts)가
    // 나오니, "확인하실 수 있어요"가 곧바로 이어지는 자연스러운 전환이 됩니다.
    `웰니스 프로파일은 다섯 영역 사이에서 가장 뚜렷하게 나타나는 경향 차이를 중심으로 보여드려요. 하위요인별 자세한 설명과, 전체 평균 대비 ${userName} ${title}님의 차이는 심층 리포트에서 확인하실 수 있어요.`,
    "이 자가진단은 심리상담 전문가가 직접 고안한 자기평가도구입니다. 아래 다섯 영역의 해석도 전문가가 정리한 심리학 이론에 바탕을 두고 있으며, 어떤 이론인지는 이 섹션 맨 아래에서 확인하실 수 있습니다.",
    IDENTITY_BANK[typeCode] ?? `당신은 ${dessertName} 유형이에요.`,
  ];

  // 확정 영역을 뺀 나머지 4개 영역끼리만 순위를 매깁니다(점수 내림차순, 동점이면 고정
  // 순서). 확정 영역이 수학적으로 가장 낮은 점수가 아닌 경우(동점·all_high 화면에서
  // 사용자가 다른 영역을 직접 고른 경우)에도 나머지 4개는 항상 1~4위 안에 들어오도록
  // 보장합니다 — 예전엔 5개 전체로 순위를 매겨서, 이런 경우 확정 영역이 아닌 다른 영역이
  // 5위를 받아 RANK_BANK[5](정의 없음 → "undefined" 문자열)가 노출되는 버그가 있었습니다.
  const otherAxes = AXIS_ORDER.filter((a) => a !== confirmedAxis);
  const rankOrder = [...otherAxes].sort((a, b) => axisScores[b] - axisScores[a] || AXIS_ORDER.indexOf(a) - AXIS_ORDER.indexOf(b));
  const rankOf: Partial<Record<AxisKey, number>> = {};
  rankOrder.forEach((a, i) => (rankOf[a] = i + 1));

  const allBelow3 = AXIS_ORDER.every((a) => axisScores[a] < 3.0);

  const bandSeen: Record<StateBand, number> = { high: 0, mid: 0, low: 0 };
  const perAxis: AxisPart[] = AXIS_ORDER.map((axis) => {
    const axisKR = AXIS_KR[axis];
    const score = axisScores[axis];
    const isConfirmed = axis === confirmedAxis;
    const band = stateBand(score);
    const variants = STATE_VARIANTS[band];
    const state = variants[bandSeen[band]++ % variants.length];

    const factors = AXES[axis];
    let lowestFactor = factors[0];
    for (const f of factors) if (factorScores[f] < factorScores[lowestFactor]) lowestFactor = f;
    const lowestScore = factorScores[lowestFactor];

    // 2026-10-05 (JunSeok 인계서 6장 "고점수 영역에도 최저 하위요인 장면을 붙이던 방식" 정리):
    // 예전엔 영역 점수와 무관하게 그 안의 최저 하위요인이 4.0 미만이면 항상 "특히 ~이어서"
    // 장면을 붙여서, 영역 자체는 든든한데(예: 4.0) 하위요인 하나가 3점대라는 이유로 약점처럼
    // 읽히는 모순이 있었다. 이제 구간 기준(3.0)에 맞춰, 확정 영역이거나 영역 점수 자체가 3.0
    // 미만일 때만 특정 하위요인 장면을 짚는다. 나머지는 하위요인을 짚지 않는 범용 문장을
    // 쓴다 — 4.0 이상이면 HIGH_SCORE_BANK, 3.0~3.9면 중립적인 MID_SCORE_BANK. 디테일은 그
    // 영역을 직접 고른 사람(확정 영역)과 실제로 약한 영역에만 남긴다.
    let bodySentence: string;
    const needsDrilldown = isConfirmed || score < 3.0;
    if (needsDrilldown && lowestScore < 4.0) {
      const factorKR = FACTOR_KR[lowestFactor];
      bodySentence = `특히 ${factorKR}${I_GA(factorKR)} ${fmtScore(lowestScore)}점이어서, ${SCENE_SEED_A[lowestFactor]}`;
    } else {
      bodySentence = band === "high" ? HIGH_SCORE_BANK[axis] : MID_SCORE_BANK[axis];
    }
    const positionSentence = isConfirmed
      ? "이 리포트가 가장 자세히 들여다볼 곳이 바로 여기입니다."
      : RANK_BANK[rankOf[axis] ?? 3] ?? "다섯 영역 중 한 자리를 차지하고 있습니다."; // 방어적 기본값(정상 흐름에선 항상 1~4위 중 하나)

    return { axis, axisKR, score, state, bodySentence, positionSentence };
  });

  const theory = BASE_KNOWLEDGE[typeCode].relatedTheory;
  const closing = ["이 리포트는 심리상담 전문가가 정리한 아래 이론을 바탕으로 해석되었습니다.", `관련 이론: ${theory}`];

  return { intro, perAxis, allBelow3, closing };
}

function renderSection1({ intro, perAxis, allBelow3, closing }: SectionOneParts): string[] {
  const paragraphs: string[] = [...intro];

  perAxis.forEach(({ axisKR, score, state, bodySentence, positionSentence }, idx) => {
    paragraphs.push(`• ${axisKR} ${fmtScore(score)}점`);
    // 2026-09-29: "• 진로 2.67점" 소제목에 이미 점수가 있으니, 바로 아래 문장에서 점수를
    // 또 반복하지 않습니다(사장님 피드백 — 중복 노출).
    paragraphs.push(`${axisKR}${EUN_NEUN(axisKR)} ${state}. ${MEANING_BANK[perAxis[idx].axis]}`);
    paragraphs.push(`${bodySentence} ${positionSentence}`);

    if (idx === perAxis.length - 1 && allBelow3) paragraphs.push(EXPERT_REFERRAL);
  });

  paragraphs.push(...closing);
  return paragraphs;
}

/** 섹션 1(당신의 웰니스 프로파일)을 AI 없이 고정 문장 뱅크로 조립합니다. */
export function assembleSection1(input: SectionOneInput): string[] {
  return renderSection1(buildSectionOneParts(input));
}
