// 2026-09-28: system_prompt_v3.md 섹션 1("당신의 웰니스 프로파일")은 JunSeok이 쓴 10개 문단을
// 점수만 갈아끼워 그대로 쓰는 구조라, AI를 부르지 않고 결정론적으로 조립합니다. 무료로 즉시
// 제공되는 화면이라 비용이 들지 않는 쪽이 맞습니다(기존 1번 무료 정책과 동일한 이유).
import { AXIS_KR, AXIS_ORDER, DESSERT, type AxisKey, type TypeCode } from "../data";
import { fmtScore } from "../scoring";

const ABOVE: Record<AxisKey, (score: string) => string> = {
  CAR: (s) =>
    `진로는 ${s}점으로, 보통보다 조금 더 충만한 수준에 있어요. 지금 하는 일이 내가 추구하는 바와 크게 벗어나지 않고, 그 안에서 자신만의 보람을 느끼고 있다는 뜻이에요. 특별한 마음의 저항 없이 직장 일과를 시작하고, 맡은 일을 처리하면서 무리 없이 흘러가는 시간이 많을 거예요.`,
  LOV: (s) =>
    `연애는 ${s}점으로 안정적인 축에 속해요. 파트너와의 관계나 앞으로의 연애를 떠올렸을 때 기대나 신뢰가 비교적 잘 자리 잡고 있다는 뜻이에요. 연애관계 속에서 특별한 노력 없이도 자연스럽게 편안함을 느끼고, 상대에게 마음을 여는 데도 크게 어려움을 느끼지 않을 가능성이 높아요.`,
  REL: (s) =>
    `관계는 ${s}점으로 충만한 수준에 있어요. 친구나 직장동료, 가족 등과의 관계에서 대체로 신뢰와 안정을 느끼고 있다는 뜻이에요. 일상에서 부탁을 주고 받는 일이나 갈등을 비교적 무난하게 해결하는 경우가 많을 거예요.`,
  SLF: (s) =>
    `자기는 ${s}점으로 충만한 수준이에요. 조건 없이도 자신을 괜찮게 느끼는 감각이 비교적 잘 작동하고 있다는 뜻이에요. 실수를 하거나 성과가 기대에 못 미쳤던 날에도 나 자신에 대한 기본적인 믿음까진 흔들리지는 않을 가능성이 높아요.`,
  DIR: (s) =>
    `인생은 ${s}점으로 충만한 편이에요. 나에게 무엇이 중요한지, 하루하루가 어떤 의미로 꿰어지고 있는지 비교적 선명하게 잡혀 있다는 뜻이에요. 크고 작은 선택 앞에서 나름의 기준을 가지고 판단을 내리는 경우가 많을 거예요.`,
};

const BELOW: Record<AxisKey, (score: string) => string> = {
  CAR: (s) =>
    `진로는 ${s}점으로, 현재 직장이나 진로가 나와 맞는지에 대한 확신이 서지 않는 상태예요. 일 자체가 싫다기보단 이 일이 나에게 어떤 의미가 있는지, 이 방향성이 과연 괜찮을지에 대한 풀리지 않는 의문이 남아있다는 뜻에 가까워요. 직장에서의 하루하루는 그럭저럭 흘러가더라도 문득 '내가 이걸 왜 하고 있지' 싶은 순간이 자주 찾아올 수 있어요.`,
  LOV: (s) =>
    `연애는 ${s}점으로, 파트너와의 관계나 앞으로의 연애를 떠올렸을 때 신뢰나 기대보다 풀어야 할 숙제가 더 많다고 느끼는 상태예요. 이 점수는 지금 만나는 사람이 없어서일 수도 있지만, 파트너 관계에서 편안함을 느끼는 감각 자체가 옅기 때문일 수도 있어요. 마음을 여는 데 시간이 걸리거나, 상대의 마음이 변하진 않을지 신경 쓰이는 순간이 있을 수 있어요.`,
  REL: (s) =>
    `관계는 ${s}점으로, 친구나 직장동료, 가족 등과의 관계에서 내 선을 지키는 게 조금 버거운 상태예요. 관계 자체가 나쁘다기보단 어디까지 맞춰주는 게 좋은지 모르겠거나 부탁을 거절하기 어려운 마음에 가까워요. 원하지 않는 부탁을 들어주고 나서 뒤늦게 불공평하다고 느끼는 순간이 올라올 수 있어요.`,
  SLF: (s) =>
    `자기는 ${s}점으로 나타났어요. 조건 없이 스스로를 괜찮게 느끼는 감각이 비교적 약하다는 뜻이에요. 특별히 잘못한 일이 없는 날에도 나는 과연 좋은 사람일까 라는 의문이 문득 떠오르는 순간이 있을 수 있어요.`,
  DIR: (s) =>
    `인생은 ${s}점으로, 나에게 무엇이 중요한지 혹은 이 하루하루들이 나에게 어떤 의미를 가지는지 잘 모르겠는 상태예요. 내 앞에 놓인 일들을 못 쳐내고 있다는 뜻이 아니라, 그 일들을 관통하는 기준이나 방향이 아직 선명하지 않다는 뜻에 가까워요. 크고 작은 선택 앞에서 무엇을 기준으로 선택을 내려야 할지 막막해지는 순간이 있을 수 있어요.`,
};

export interface DomainProfileBlock {
  label: string; // "진로 3.3점" — 볼드 소제목
  text: string;
}
export interface DomainProfile {
  scoreLine: string; // "진로 3.3점 · 연애 4.0점 · ..."
  introLine: string; // "당신은 {dessert} 타입이에요."
  blocks: DomainProfileBlock[];
  expertNotice: boolean; // 다섯 영역 모두 3.0 미만
}

export function buildDomainProfile(
  typeCode: TypeCode,
  confirmedAxis: AxisKey,
  axisScores: Record<AxisKey, number>
): DomainProfile {
  const scoreLine = AXIS_ORDER.map((a) => `${AXIS_KR[a]} ${fmtScore(axisScores[a])}점`).join(" · ");
  const introLine = `당신은 ${DESSERT[typeCode].name} 타입이에요.`;

  const blocks = AXIS_ORDER.map((a): DomainProfileBlock => {
    const score = axisScores[a];
    const disp = fmtScore(score);
    const isAbove = score >= 3.0;
    const body = (isAbove ? ABOVE[a] : BELOW[a])(disp);
    let closing: string;
    if (a === confirmedAxis) {
      closing = "지금 이 리포트가 가장 자세히 들여다볼 지점이에요.";
    } else if (!isAbove) {
      closing = "이 부분도 살짝 챙겨주면 더 든든해질 영역이에요.";
    } else {
      closing = "지금 당신을 지탱해주는 든든한 기반 중 하나예요.";
    }
    return { label: `${AXIS_KR[a]} ${disp}점`, text: `${body} ${closing}` };
  });

  const expertNotice = AXIS_ORDER.every((a) => axisScores[a] < 3.0);
  return { scoreLine, introLine, blocks, expertNotice };
}

export const EXPERT_NOTICE_TEXT =
  "다섯 영역 모두 보통보다 낮게 나왔어요. 요즘 전반적으로 버거운 시기일 수 있어요. 혼자 정리하기보다 믿을 만한 사람이나 전문가와 함께 살펴보는 걸 권해요.";
