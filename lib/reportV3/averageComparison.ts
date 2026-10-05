import { AXES, FACTOR_KR, type AxisKey, type FactorKey } from "../data";
import { EUL_REUL, I_GA } from "../josa";
import { fmtScore } from "../scoring";
import { leadFactors } from "./companions";
import { FACTOR_AVERAGE_V1 } from "./factorAverages";

// 2026-10-01: 심층보고서 결제자 전용 — 섹션 1 바로 아래, 섹션 2가 시작되기 전에 넣는
// "하위요인별 평균 대비 내 위치" 블록의 설명 문단입니다. AI를 부르지 않고 점수 차이만으로
// 결정론적으로 조립합니다(섹션 1과 같은 방식) — 사실관계(몇 점 차이)를 전달하는 글이라 AI의
// 창작이 필요 없고, 같은 입력이면 항상 같은 문장이 나오는 편이 안전합니다.
//
// ⚠ average는 아직 "같은 유형 평균"이 아니라 "15유형 전체 평균"입니다(factorAverages.ts
// 참고) — 이 사실을 문구에서 반드시 밝혀야 합니다(README 체크리스트).
//
// ⚠ 2026-10-01 사장님 피드백 1: "전체 유형 대비 평균인 만큼 본인의 성향이나 특성을 보여줄
// 뿐, 능력별로 좋고 나쁜 것을 나타내는 게 절대 아니라는 것"을 반드시 강조할 것 — 차이가
// 있을 때도 없을 때도 이 문구는 항상 들어갑니다(아래 intro 문단).
//
// ⚠ 2026-10-01 사장님 피드백 2: 이 그래프가 "왜 이 유형으로 나왔는지"를 보여주는 그래프라는
// 점도 설명할 것(예: 바스크 치즈케이크는 유능함 기반 자기가치가 평균보다 낮은 편인데, 이게
// 확정 영역을 정하게 된 이유). 그래서 "가장 차이가 큰 하위요인"을 아무거나 고르지 않고,
// 반드시 확정 영역(confirmedAxis)의 주도요인(leadFactors — companions.ts와 같은 정의,
// 그 축 안에서 가장 낮은 하위요인)을 기준으로 설명합니다 — 이래야 "이 차이가 바로 이 유형이
// 된 이유"라는 말이 항상 사실과 맞습니다.

const DEVIATION_THRESHOLD = 0.8; // 이 이상 벌어지면 "많이 차이난다"로 취급

// 하위요인이 평균보다 낮게/높게 나왔을 때 각각 무슨 뜻인지(JunSeok S2_LEAD의 낮은 쪽 문장과 같은 결).
const FACTOR_DIRECTION_MEANING: Record<FactorKey, { low: string; high: string }> = {
  job_fit: { low: "지금 하는 일이 나와 맞는지 확신이 덜한 편이라는 뜻이에요.", high: "지금 하는 일이 나와 잘 맞는다고 느끼는 편이라는 뜻이에요." },
  partner_fit: { low: "앞으로의 연애에 기대보다 물음표가 더 큰 편이라는 뜻이에요.", high: "앞으로의 연애에 기대가 크고 어떤 상대가 맞는지도 비교적 분명한 편이라는 뜻이에요." },
  attachment: { low: "연애에서 마음을 내려놓고 기대는 일이 조금 더 조심스러운 편이라는 뜻이에요.", high: "연애에서 마음을 열고 기대는 일이 비교적 편안한 편이라는 뜻이에요." },
  boundary: { low: "관계에서 내 선을 지키는 일이 조금 더 버거운 편이라는 뜻이에요.", high: "관계에서 내 선을 지키고 거절하는 일이 비교적 편안한 편이라는 뜻이에요." },
  global_worth: { low: "조건과 상관없이 나를 괜찮게 느끼는 바탕이 조금 더 옅은 편이라는 뜻이에요.", high: "조건과 상관없이 나를 괜찮게 느끼는 바탕이 비교적 두터운 편이라는 뜻이에요." },
  values: { low: "내게 중요한 것과 선택의 기준이 아직 덜 선명한 편이라는 뜻이에요.", high: "내게 중요한 것과 선택의 기준이 비교적 선명한 편이라는 뜻이에요." },
  meaning: { low: "하루와 지금 하는 일에서 의미를 느끼기가 조금 더 어려운 편이라는 뜻이에요.", high: "하루와 지금 하는 일에서 의미를 비교적 잘 느끼는 편이라는 뜻이에요." },
  tension_tol: { low: "관계에 풀리지 않은 감정이 남으면 평소처럼 지내기가 조금 더 어려운 편이라는 뜻이에요.", high: "관계에 풀리지 않은 감정이 남아도 평소처럼 지내기가 비교적 수월한 편이라는 뜻이에요." },
  competence_cw: { low: "얼마나 잘 해냈는지가 나를 평가하는 잣대와 가깝게 붙어 있는 편이라는 뜻이에요.", high: "얼마나 잘 해냈는지와 나를 평가하는 잣대가 비교적 떨어져 있는 편이라는 뜻이에요." },
  approval_cw: { low: "다른 사람의 반응이 내가 나를 바라보는 방식에 영향을 많이 주는 편이라는 뜻이에요.", high: "다른 사람의 반응에도 내가 나를 바라보는 방식이 비교적 덜 흔들리는 편이라는 뜻이에요." },
};

export interface AverageComparisonResult {
  /** 그래프 위에 들어가는 설명 문단(항상 포함). */
  intro: string[];
  /** 그래프 아래 들어가는 말머리 문단(차이가 크게 날 때만, 없으면 빈 배열). */
  deviationNote: string[];
}

export function buildAverageComparisonText(
  nickname: string,
  title: string,
  factorScores: Record<FactorKey, number>,
  confirmedAxis: AxisKey,
  axisKR: string,
  dessertName: string
): AverageComparisonResult {
  const who = title ? `${nickname} ${title}님` : `${nickname}님`;

  // 확정 영역의 주도요인(동점이면 첫 번째) — "왜 이 유형이 나왔는지"의 실제 근거입니다.
  const [leadFactor] = leadFactors(factorScores, AXES[confirmedAxis]);
  const leadLabel = FACTOR_KR[leadFactor];
  const leadIndividual = factorScores[leadFactor];
  const leadAverage = FACTOR_AVERAGE_V1[leadFactor];
  const leadDiff = leadIndividual - leadAverage;
  const leadDirectionAdj = leadDiff < 0 ? "낮은" : "높은"; // "~ 편"에 붙는 관형형

  const intro = [
    `${who}의 테스트 결과를 전체 유형별 평균과 대비하면 다음과 같습니다.`,
    `아래 수치는 같은 디저트 유형을 고른 사람들만의 평균이 아니라, 15개 유형 전체의 하위요인별 평균을 기준으로 한 거예요. 평균보다 높거나 낮다고 해서 능력이 더 좋거나 나쁘다는 뜻이 아니라, ${nickname}님만의 성향과 특성을 보여주는 지표일 뿐이니 그렇게 봐주세요.`,
    `이 그래프는 ${nickname}님이 왜 ${dessertName} 유형으로 나왔는지를 설명해주는 그래프이기도 해요. ${dessertName} 유형은 ${leadLabel}${I_GA(leadLabel)} 전체 평균보다 ${leadDirectionAdj} 편인데, 바로 이 지점이 ${axisKR}${EUL_REUL(axisKR)} 가장 신경 쓰이는 영역으로 확정하게 된 이유예요.`,
  ];

  // 2026-10-05: 주도요인 한 줄뿐이던 말머리를 "평균과 가장 다르게 나온 지점 1~2개"까지 늘리고,
  // "좋고 나쁨이 아니라 ○○님만의 특징" 마무리 문장은 말머리들 뒤에 한 번만 나오도록 뺐다.
  // 각 줄은 어느 쪽으로 다른지(낮게/높게)에 맞는 뜻 풀이를 붙인다 — 같은 요인이라도 점수가 높을 때와
  // 낮을 때 뜻이 반대라서(특히 유능함·인정 기반은 점수가 높을수록 조건에 덜 묶인다는 뜻) 방향을 꼭 구분한다.
  const bullet = (f: FactorKey, diff: number) => {
    const label = FACTOR_KR[f];
    const dir = diff < 0 ? "낮게" : "높게";
    const meaning = FACTOR_DIRECTION_MEANING[f][diff < 0 ? "low" : "high"];
    return `• ${label}${I_GA(label)} 전체 평균보다 ${fmtScore(Math.abs(diff))}점 더 ${dir} 나타나요. ${meaning}`;
  };

  const notes: string[] = [];
  if (Math.abs(leadDiff) >= DEVIATION_THRESHOLD) notes.push(bullet(leadFactor, leadDiff));
  const others = (Object.keys(factorScores) as FactorKey[])
    .filter((f) => f !== leadFactor)
    .map((f) => ({ f, diff: factorScores[f] - FACTOR_AVERAGE_V1[f] }))
    .filter(({ diff }) => Math.abs(diff) >= DEVIATION_THRESHOLD)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 2);
  others.forEach(({ f, diff }) => notes.push(bullet(f, diff)));

  const deviationNote = notes.length
    ? [...notes, `이번에도 마찬가지로 좋고 나쁨이 아니라 ${nickname}님만의 특징으로 봐주시면 됩니다.`]
    : [];

  return { intro, deviationNote };
}
