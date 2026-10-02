// 2026-09-29: section6_assembler.py를 TypeScript로 포팅했습니다. companions()/neighbors()/
// contrasts()가 만드는 조합은 방향까지 구분해도 92가지뿐이라(동행 38+이웃 24+대조 30,
// build_report_input.py로 실측), AI를 부르지 않고 "상대 유형 소개(15개, 재사용) + 관계
// 커넥터(모드·fit_context·다리요인 기준, 소수) + 축별 장면(5개, 재사용)" 조각을 조합해서
// 문장을 만듭니다. 섹션 1처럼 같은 입력이면 항상 같은 결과입니다.
//
// 원본 파이썬과 다르게 포팅한 부분(사장님 확인):
// - "**볼드**" 대신 "•" 말머리를 씁니다 — 화면이 마크다운을 렌더링하지 않아서 별표가
//   그대로 노출되는 문제 때문에, 이 프로젝트는 전부 "•" 표기로 통일했습니다(규칙 15).
// - 대처방식 이름에 "1차 통제(용기형)"처럼 원어를 앞세우고 괄호로 병기합니다(규칙 16,
//   modeAnnotation.ts — 2026-10-02 순서 변경).
// - "나와 다른 사람과 잘 지내는 법"(대조형을 떠올리며 쓰는 행동 조언 3가지)은 원본 파이썬엔
//   없지만(제거됨), 이 프로젝트는 AI가 계속 쓰도록 유지하기로 했습니다 — 그래서 이 함수는
//   그 부분을 만들지 않고, prompt.ts가 AI에게 그 부분만 "### 6." 헤더로 쓰게 하고
//   generate.ts에서 이 함수의 결과 뒤에 이어 붙입니다.
import { AXIS_KR, type AxisKey, type ModeKey, type TypeCode } from "../data";
import type { CompanionType, ContrastType, FitContext, NeighborType } from "./companions";
import { EUN_NEUN, GWA_WA, I_GA } from "../josa";
import { annotateMode } from "./modeAnnotation";

// 1) 15유형 "상대 소개" — 3인칭, base_knowledge 성격적 특징의 디저트 비유를 살린 1문장 요약.
//    동행/이웃/대조 어디서든 재사용합니다.
const INTRO: Record<TypeCode, string> = {
  "CAR-primary": "진하게 눌러 담은 디저트처럼, 불확실함을 오래 곱씹기보다 실행으로 바꾸는 사람",
  "CAR-secondary": "커피가 시트에 스며들듯, 불확실함을 시간을 들여 천천히 소화하는 사람",
  "CAR-disengage": "뜨거운 걸 차갑게 식히듯, 뜨거운 고민을 의도적으로 식혀 거리를 두는 사람",
  "LOV-primary": "딸기를 하나씩 쌓아 올리듯, 관계를 기다리지 않고 직접 가꾸는 사람",
  "LOV-secondary": "새콤함을 크림이 감싸듯, 관계의 날카로운 순간을 다르게 바라보며 누그러뜨리는 사람",
  "LOV-disengage": "스쳐 지나가듯 녹는 디저트처럼, 무거운 감정을 붙잡기보다 시원하게 흘려보내는 사람",
  "REL-primary": "한 겹씩 쌓아 올리듯, 관계의 선을 기다리지 않고 스스로 세워가는 사람",
  "REL-secondary": "매끈한 겉과 부드러운 속을 함께 가진 디저트처럼, 유연해 보여도 안쪽엔 자기 기준이 있는 사람",
  "REL-disengage": "가볍고 바삭하게 부서지는 디저트처럼, 무거운 순간엔 살짝 물러서서 스스로를 지키는 사람",
  "SLF-primary": "거칠게 태운 표면을 그대로 드러내는 디저트처럼, 꾸미기보다 실제로 해내며 스스로를 채우는 사람",
  "SLF-secondary": "익숙한 틀 안에서 편안하게 구워지는 디저트처럼, 나 자신을 있는 그대로 다독이는 데 익숙한 사람",
  "SLF-disengage": "담백하고 균일한 디저트처럼, 나에 대한 질문을 붙잡기보다 잔잔히 흘려보내는 사람",
  "DIR-primary": "익숙한 결 위에 새 풍미를 더하듯, 방향이 궁금해지면 새로운 경험으로 결을 만들어가는 사람",
  "DIR-secondary": "새콤함을 부드러운 머랭이 감싸듯, 방향에 대한 날카로운 물음을 부드럽게 다시 읽어내는 사람",
  "DIR-disengage": "정해진 배열 없이 과일을 얹은 디저트처럼, 방향을 하나로 정하지 않고 그때그때 끌리는 대로 흘러가는 사람",
};

// 2) 대처방식 철학 한 줄
const MODE_PHIL: Record<ModeKey, string> = {
  primary: "고민이 생기면 상황 자체를 직접 바꾸려고 움직이는 쪽",
  secondary: "고민이 생기면 마음을 먼저 다독이고 다르게 바라보려는 쪽",
  disengage: "고민이 생기면 잠시 그 일과 거리를 두려는 쪽",
};

// 3) 축별 장면 배경
const AXIS_SCENE: Record<AxisKey, string> = {
  CAR: "직장에서 방향이 흔들리는 순간",
  LOV: "연애나 만남을 떠올리는 순간",
  REL: "친구·지인과의 관계가 애매해지는 순간",
  SLF: "혼자 나 자신을 돌아보는 순간",
  DIR: "삶의 방향을 고민하는 순간",
};

// 4) 동행형 커넥터 (fit_context별)
const COMPANION_CONNECTOR: Record<FitContext, (kw: { them: string; themE: string; themEun: string; themI: string }) => string> = {
  partner_fits_better: (kw) =>
    `이 고민의 성격상 ${kw.them}의 방식이 더 힘을 발휘하는 편이라, 곁에 있으면 지금 당신에게 아직 덜 쓰이는 도구를 자연스럽게 보여줄 수 있어요(더 낫다는 뜻이 아니라, 이 고민에 잘 맞는 방식을 가졌다는 뜻이에요).`,
  i_fit_better: (kw) => `이 고민엔 당신의 방식이 잘 맞는 편이라, 당신이 ${kw.themE} 힘이 되어줄 수 있는 사이예요.`,
  no_difference: () => `이 고민은 두 방식이 함께 필요해서, 서로 비어 있는 곳을 채워주는 사이예요.`,
};
const COMPANION_CONNECTOR_SHORT: Record<FitContext, (kw: { them: string }) => string> = {
  partner_fits_better: (kw) => `이 고민엔 ${kw.them}의 방식이 조금 더 힘을 발휘하는 편이에요.`,
  i_fit_better: () => `이 고민엔 당신의 방식이 잘 맞는 편이라, 당신이 힘이 되어줄 수 있어요.`,
  no_difference: () => `이 고민은 두 방식이 함께 필요해서, 서로의 빈 곳을 채워줄 수 있어요.`,
};
const COMPANION_SCENE: Record<FitContext, (kw: { themEun: string; themI: string; axisScene: string }) => string> = {
  partner_fits_better: (kw) => `예를 들어 ${kw.axisScene}에 당신이 막막해하면, ${kw.themEun} 다른 각도나 여유를 먼저 건넬 수 있어요.`,
  i_fit_better: (kw) => `예를 들어 ${kw.themI} ${kw.axisScene}에 머뭇거리면, 당신은 지금 해볼 수 있는 작은 걸음을 함께 찾아줄 수 있어요.`,
  no_difference: (kw) => `예를 들어 ${kw.axisScene}에 한쪽이 먼저 움직이면 다른 쪽이 관점을 보태는 식으로, 자연스럽게 역할이 나뉠 수 있어요.`,
};

// 5) 이웃형 커넥터
const neighborConnector = (bridge: string, themGwa: string) =>
  `다른 영역이지만 이어지는 고리는 ${bridge}예요. 고민의 영역은 달라도 같은 대처방식을 쓰고 있어서, ${themGwa}는 설명을 많이 보태지 않아도 "무슨 말인지 아는" 사이가 될 수 있어요.`;
const neighborScene = (bridge: string, themEge: string) =>
  `예를 들어 당신이 ${bridge} 때문에 마음이 무거운 날, ${themEge} 그 얘기를 꺼내면 영역은 달라도 비슷하게 겪어본 사람이라 긴 설명 없이도 고개를 끄덕여 줄 수 있어요.`;

// 6) 대조형 — 모드쌍 3가지(항상 이 셋 중 하나: 내 모드가 primary/secondary면 상대는
//    disengage, 내 모드가 disengage면 상대는 primary — contrasts()의 far_mode 로직 참고)
const CONTRAST_SCENE: Record<string, (kw: { themEun: string; axisScene: string }) => string> = {
  "primary,disengage": (kw) =>
    `예를 들어 당신이 ${kw.axisScene}에 바로 움직이려 할 때, ${kw.themEun} "꼭 지금 정해야 해?" 하고 되물을 수 있어요. 처음엔 그 여유가 느긋하게 느껴져도, 서두르지 않아도 무너지지 않는 모습을 곁에서 보는 것 자체가 배움이 될 수 있어요.`,
  "secondary,disengage": (kw) =>
    `예를 들어 당신이 ${kw.axisScene}을 다르게 읽어보려 할 때, ${kw.themEun} 그 생각 자체를 잠시 접어둘 수 있어요. 처음엔 그 담백함이 낯설어도, 다시 읽지 않아도 하루가 굴러간다는 걸 곁에서 보는 것이 마음에 여유를 줄 수 있어요.`,
  "disengage,primary": (kw) =>
    `예를 들어 당신이 ${kw.axisScene}에서 한 발 물러날 때, ${kw.themEun} "그럼 일단 해보자"며 바로 움직일 수 있어요. 처음엔 그 속도가 부담스러워도, 부딪혀도 생각보다 괜찮았던 순간이 있다는 걸 곁에서 보는 것이 작은 문을 열어줄 수 있어요.`,
};

function modeCodeOf(type: TypeCode): ModeKey {
  return type.split("-")[1] as ModeKey;
}

/** 반환: [소제목 줄("• 디저트명(영역 × 대처방식)"), 본문 문단] */
function renderCompanion(myAxis: AxisKey, item: CompanionType, idx: number): [string, string] {
  const them = item.dessert;
  const ctx = item.fitContext;
  const heading = `• ${them}(${item.axis} × ${annotateMode(item.mode)})`;
  const kw = { them, themE: `${them}에게`, themEun: `${them}${EUN_NEUN(them)}`, themI: `${them}${I_GA(them)}` };
  if (idx === 0) {
    const intro = `${kw.themEun} ${INTRO[item.type]}이에요.`;
    const conn = COMPANION_CONNECTOR[ctx](kw);
    const scene = COMPANION_SCENE[ctx]({ ...kw, axisScene: AXIS_SCENE[myAxis] });
    return [heading, `${intro} ${conn} ${scene}`];
  }
  return [heading, COMPANION_CONNECTOR_SHORT[ctx](kw)];
}

function renderNeighbor(item: NeighborType, idx: number): [string, string] {
  const them = item.dessert;
  const heading = `• ${them}(${item.axis} × ${annotateMode(item.mode)})`;
  const themGwa = `${them}${GWA_WA(them)}`;
  const conn = neighborConnector(item.bridgeFactor, themGwa);
  if (idx === 0) {
    const scene = neighborScene(item.bridgeFactor, `${them}에게`);
    return [heading, `${conn} ${scene}`];
  }
  return [heading, conn];
}

function renderContrast(myAxis: AxisKey, myMode: ModeKey, item: ContrastType, idx: number): [string, string] {
  const them = item.dessert;
  const theirMode = modeCodeOf(item.type);
  const heading = `• ${them}(${item.axis} × ${annotateMode(item.mode)})`;
  const themEun = `${them}${EUN_NEUN(them)}`;
  const myPhil = MODE_PHIL[myMode];
  const theirPhil = MODE_PHIL[theirMode];
  if (idx === 0) {
    const conn = `당신은 "${myPhil}"이라면, ${themEun} "${theirPhil}"이에요.`;
    const sceneFn = CONTRAST_SCENE[`${myMode},${theirMode}`];
    const scene = sceneFn({ themEun, axisScene: AXIS_SCENE[myAxis] });
    return [heading, `${conn} ${scene}`];
  }
  return [heading, `여기서도 당신은 "${myPhil}", ${themEun} "${theirPhil}"이에요.`];
}

/**
 * 섹션 6의 "결이 통하는 사람들 / 고민이 이어진 사람들 / 새로운 관점을 주는 사람들"
 * 부분만 조립합니다(AI 없이, 결정론적). "나와 다른 사람과 잘 지내는 법"(행동 조언
 * 3가지)은 포함하지 않습니다 — 그 부분은 계속 AI가 씁니다(generate.ts에서 이어 붙임).
 */
export function assembleSection6Relationships(
  axis: AxisKey,
  mode: ModeKey,
  companions: CompanionType[],
  neighbors: NeighborType[],
  contrasts: ContrastType[]
): string[] {
  const axisKR = AXIS_KR[axis];
  const paragraphs: string[] = [];

  paragraphs.push("서로 고민하는 영역이 다를 뿐이지, 성격 자체가 다르다거나 결이 안 맞는다는 뜻은 아니에요.");

  paragraphs.push("• 결이 통하는 사람들");
  paragraphs.push(`같은 ${axisKR} 고민을 다른 방식으로 다루는 사람들이라, 설명 없이도 통하는 부분이 있어요.`);
  companions.forEach((c, i) => paragraphs.push(...renderCompanion(axis, c, i)));

  paragraphs.push("• 고민이 이어진 사람들");
  neighbors.forEach((n, i) => paragraphs.push(...renderNeighbor(n, i)));

  paragraphs.push("• 새로운 관점을 주는 사람들");
  paragraphs.push("고민의 영역도 방식도 멀어서 낯설 수 있지만, 그래서 배울 게 있어요.");
  contrasts.forEach((c, i) => paragraphs.push(...renderContrast(axis, mode, c, i)));

  return paragraphs;
}
