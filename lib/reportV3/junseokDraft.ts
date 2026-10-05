// 2026-10-05 (시험 버전): JunSeok이 보낸 sentence_bank.py / report_builder.py의 섹션 3·7 문장과
// 선택 로직을 그대로 옮겼습니다. AI가 쓰는 리포트에서도 JunSeok이 쓴 문장을 먼저 쓰게 하려고,
// 서버가 이 사람 점수에 맞는 JunSeok 문장을 미리 골라 "뼈대 초안"으로 AI에게 넘기고(prompt.ts의
// <junseok_draft>), 생성 후에는 그 문장이 그대로 들어갔는지 확인해서 빠졌으면 서버가 끼워 넣습니다.
//
// 이 프로젝트의 표기에 맞춘 부분: 대처방식 이름은 "1차 통제(용기형)"처럼 원래 용어를 앞세워 쓰고
// (규칙 16), 점수는 소수 첫째 자리(fmtScore), "자기"는 본문에서 "자기 영역"으로 씁니다.
import { AXIS_KR, MODE_KR, type AxisKey, type ModeKey } from "../data";
import { annotateMode } from "./modeAnnotation";
import { BASE_KNOWLEDGE } from "./baseKnowledge";
import { fmtScore } from "../scoring";
import type { ReportV3Input } from "./prompt";

// 용기형·평온형·유보형은 모두 "형"(받침 ㅇ)으로 끝나서, 이름 뒤 조사는 항상 받침 있는 쪽입니다.
const NAME = (m: ModeKey) => annotateMode(MODE_KR[m]);

const S3_LABELS =
  "고민을 다루는 방식은 크게 세 가지로 나눠볼 수 있어요. 1차 통제(용기형)은 환경에 적극적으로 개입해 문제를 해결하는 방식이에요. " +
  "2차 통제(평온형)은 내 안의 관점, 기대, 신념 등을 조정해 문제를 해결하는 방식이고요. " +
  "이탈(유보형)은 문제로부터 물리적, 정서적, 인지적인 거리를 두는 방식이에요.";

const S3_DISENGAGE =
  "지금은 이 방식이 지친 마음을 지켜주는 역할을 하고 있어요. 다만 이 고민 앞에서 주로 쓰는 방식이 이탈(유보형)이라면, " +
  "그 거리가 오래 굳어질수록 다른 선택지가 점점 안 보이게 될 수 있어요.";

// JunSeok S7(그룹 × 대처방식). {ax}는 영역 이름(자기는 "자기 영역"). 이름 표기는 아래 annotate()가 바꿉니다.
const S7: Record<string, string> = {
  "G1,primary": "지금 마음이 쓰이는 {ax} 고민은 문제에 적극적으로 대처할 때 상황이 바뀔 여지가 큰 편이에요. 그리고 당신은 실제로 1차통제를 제일 자주 쓰고 있어서, 고민의 이런 특성과 당신의 대처방식이 잘 맞물려 있어요. 다만 혼자 다 해결하려 하기보다 믿을 만한 사람을 찾아 조언을 구하는 것도 1차통제 접근의 일부라는 걸 기억해두세요. 함께할 사람이 있을 때 지치지 않고 목표까지 나아갈 수 있을 거예요.",
  "G1,secondary": "당신은 2차통제를 통해 상황을 다르게 바라보고 또 수용하는 힘을 갖고 있어요. 이 힘 덕분에 상황이 흔들려도 중심을 지킬 수 있어요. 다만 {ax} 관련 고민은 상황을 적극적으로 바꾸려 할 때 달라질 여지도 큰 편이에요. 그래서 지금의 관점에 더해 작은 행동 하나를 추가해보는 걸 권해요. 마음을 다스리는 힘과 환경을 바꾸는 힘이 함께할 때, 이 영역에서 더 빨리 충만해질 수 있어요.",
  "G1,disengage": "지금 당신은 {ax} 관련 고민에 잠시 거리를 두고 있어요. 이런 대처는 지친 마음을 쉬게 해주는 역할을 해요. 다만 이 고민은 적극적으로 문제해결을 시도할 때 바뀔 여지가 큰 편이라, 거리를 두는 시간이 길어질수록 상황을 바꿀 수 있는 기회와도 멀어질 수 있어요. 큰 결심이 아니어도 괜찮아요. 여유가 생길 때 조금씩만 거리를 좁혀 보세요.",
  "G2,primary": "당신은 1차통제 접근으로 직접 찾아 나서고 부딪히며 답을 만들어가는 걸 선호해요. 이 실행력은 {ax} 관련 고민에서 길을 찾는 데 큰 힘이 돼요. 다만 이 영역은 행동력으로 달라지는 부분과 관점을 바꾸면서 풀리는 고민이 함께 있어요. 그래서 열심히 노력해도 실마리가 안 보일 땐 잠시 멈춰서 내가 진짜 원하는 건 뭔지 스스로에게 물어보는 시간이 도움이 될 수 있어요. 환경을 바꾸는 힘에 마음을 다스리는 힘이 더해지면 더 온전한 나만의 답을 찾을 수 있을 거예요.",
  "G2,secondary": "당신은 2차통제 접근으로 지금의 상황을 바라보는 방식을 바꾸며 문제를 해결하는 스타일이에요. 당장 답이 보이지 않아도 조급해하지 않는 이 여유는 큰 자원이에요. 다만 이 고민은 행동력으로 달라질 여지도 커요. 그래서 마음속으로 정리한 생각과 함께 작은 경험 하나로 그 생각을 확인해보는 걸 권해요. 생각과 경험이 서로를 비춰줄 때 흐릿하던 방향이 더욱 선명해질 수 있어요.",
  "G2,disengage": "당신은 {ax} 관련 고민에 거리를 두는 스타일이에요. 답이 보이지 않는 질문 앞에서 한숨 돌리는 건 자연스러운 대처죠. 다만 이 고민은 적극적으로 문제해결하는 시도와 관점을 바꿔보는 것처럼 다가갈 길이 생각보다 여러 가지예요. 그런데 거리를 두는 시간이 길어질수록 그 길들이 점점 보이기 어려워질 수 있어요. 그러므로 둘 중 마음 끌리는 쪽을 골라 가볍게 고민에 다가가보세요.",
  "G3,primary": "당신은 1차통제 접근으로 고민에 적극적으로 개입하는 스타일이에요. 다만 {ax} 관련 고민은 상황 자체보다 그 상황을 대하는 내 마음을 이해하는 게 핵심인 경우가 많아요. 그래서 적극적으로 상황을 바꾸려 할수록 오히려 잘 안 풀린다는 느낌이 들 수 있어요. 이럴 땐 지금 느끼는 불편함을 있는 그대로 바라보는 2차통제 접근이 도움이 될 수 있어요. 환경을 바꾸는 힘에 마음을 다스리는 힘이 더해지면, 이 영역에서 한결 충만해질 수 있을 거예요.",
  "G3,secondary": "지금 마음이 쓰이는 {ax} 고민은 상황 자체보다 내 마음의 반응이 핵심인 경우가 많아요. 그리고 당신은 실제로 2차통제를 제일 자주 쓰고 있어서, 고민의 이런 특성과 당신의 대처방식이 잘 맞물려 있어요. 다만 수용하는 것과 참고 넘기는 것은 다르다는 걸 기억해두세요. 불편한 마음을 알아차린 뒤, 필요할 땐 이를 표현하거나 행동으로 옮기는 것까지가 진짜 수용이거든요.",
  "G3,disengage": "지금 당신은 {ax} 관련 고민에 잠시 거리를 두고 있어요. 불편한 마음에서 잠시 떨어져 있으면 당장은 숨이 쉬어지는 게 사실이에요. 다만 이 고민은 피할수록 더 무겁게 느껴지고, 반대로 불편함을 있는 그대로 느껴볼 때 조금씩 가벼워지는 경우가 많아요. 처음부터 오랫동안 마주할 필요는 없어요. 아주 잠깐씩 그 마음에 머물러 보는 것부터 시작해보세요.",
  "G4,primary": "당신은 1차통제 접근으로 고민을 적극적으로 해결하려는 스타일이에요. 다만 {ax} 관련 고민은 성과나 다른 사람의 반응에 내 가치가 조건화되어 있는 경우가 많아요. 그래서 더 잘 해내거나 상대에게 더 맞춰주는 방식으로 풀려고 하면, 잠깐은 괜찮아질 수 있어도 '잘해야만 나는 괜찮아'는 조건은 오히려 더 단단해질 수 있어요. 그러니 앞으로는 결과와 상관없이 나를 수용하는 2차통제 접근을 조금씩 더해보는 걸 권해요. 성과를 일구는 힘이 나를 몰아붙이는 데가 아니라 응원하는 데 쓰일 때, 이 영역에서 더 충만해질 수 있을 거예요.",
  "G4,primary_support": "당신은 고민이 생기면 믿을 만한 사람에게 털어놓고 조언을 구하는 스타일이에요. 이건 분명 큰 자원이에요. 다만 {ax} 관련 고민은 다른 사람의 반응에 내 가치가 걸려 있는 경우가 많아서, 그 도움이 '나 괜찮지?'를 확인받는 쪽으로만 흐르면 그 느낌이 계속 남에게 달려 있게 될 수 있어요. 그래서 다른 사람의 말을 듣기 전에 스스로에게 먼저 '괜찮아'라고 말해보는 연습을 권해요. 남이 주는 긍정과 내가 주는 따뜻함이 함께할 때, 이 영역은 훨씬 충만해질 수 있어요.",
  "G4,secondary": "지금 마음이 쓰이는 {ax} 관련 고민은 성과나 다른 사람의 반응과 나 자신을 떼어놓고 보려 할 때 마음이 가벼워지는 경우가 많아요. 그리고 당신은 실제로 2차통제를 제일 자주 쓰고 있어서, 고민의 이런 특성과 당신의 대처방식이 잘 맞물려 있어요. 다만 다독임이 정말 바뀌고 싶은 부분까지 긍정하는 데 쓰이고 있진 않은지 가끔 살펴보세요. 나를 있는 그대로 받아들이는 힘과 원하는 방향으로 나아가는 힘은 양립할 수 있어요.",
  "G4,disengage": "지금 당신은 {ax} 관련 고민과 잠시 거리를 두고 있어요. 나에 대한 평가가 걸려 있는 상황을 피하면 당장은 마음이 편해지는 게 사실이에요. 다만 피하는 동안에도 '잘해야만 돼'라는 조건 자체는 그대로 남아 있을 수 있어요. 그래서 거리를 두는 것만으로는 이 영역에서 충만함을 되찾기 어려울 수 있어요. 아주 조금씩, 결과와 나를 분리하여 바라보는 연습을 시작해보세요.",
};

// JunSeok 원문의 "1차통제/2차통제/이탈"을 이 프로젝트 표기("1차 통제(용기형)" 등)로 바꿉니다.
// "1차통제를"처럼 조사가 바로 붙은 곳은 받침 있는 쪽("을")으로 맞춥니다.
function annotate(text: string): string {
  return text
    .replace(/(1차통제|2차통제)를/g, "$1을")
    .replace(/1차통제/g, NAME("primary"))
    .replace(/2차통제/g, NAME("secondary"));
}

const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;

function gapSentence(input: ReportV3Input): string {
  const mode = input.mode;
  const scores = input.modeScores;
  const order = (["primary", "secondary", "disengage"] as ModeKey[]).sort((a, b) => scores[b] - scores[a]);
  const second = order.find((m) => m !== mode)!;
  const tie = Math.abs(scores[mode] - scores[second]) < 1e-9;
  const d = Math.round((r1(scores[mode]) - r1(scores[second])) * 10) / 10;
  const M = NAME(mode);
  const M2 = NAME(second);
  const ms = `${fmtScore(scores[mode])}점`;
  const m2s = `${fmtScore(scores[second])}점`;
  if (tie) {
    return `${M}과 ${M2}의 점수가 같으며, 둘 중 내가 더 선호하는 방식으로 ${M}을 골라주셨어요. 이 고민 앞에서 두 방식을 비슷한 비율로 사용하는 편이에요.`;
  }
  if (d >= 1.0) {
    return `당신은 ${M} 점수가 ${ms}으로, 그다음으로 높은 ${M2} ${m2s}보다 ${d.toFixed(1)}점 높아요. 이 고민 앞에서는 ${M} 접근을 꽤 뚜렷하게 선호하는 편이에요.`;
  }
  if (d >= 0.5) {
    return `당신은 ${M} 점수가 ${ms}으로, 그다음으로 높은 ${M2} ${m2s}보다 ${d.toFixed(1)}점 높아요. ${M2}도 함께 쓰지만, 이 고민 앞에서는 ${M} 접근을 좀 더 선호하는 편이에요.`;
  }
  return `당신은 ${M} ${ms}과 ${M2} ${m2s}의 점수가 거의 비슷해요. 이 고민 앞에서 두 방식을 비슷한 비율로 사용하는 편이에요.`;
}

export interface JunseokDraft {
  /** 섹션 3 문단 A — base_knowledge 성격적 특징(JunSeok 원문 그대로). */
  s3Personality: string;
  /** 섹션 3 문단 B — 세 방식 풀이 + 점수 차이 문장(+ 유보형이면 추가 문장). */
  s3Methods: string;
  /** 섹션 7 — 주도요인 그룹 × 대처방식에 맞는 방향 문단. */
  s7Direction: string;
}

export function buildJunseokDraft(input: ReportV3Input): JunseokDraft {
  const ax = input.axis === ("SLF" as AxisKey) ? "자기 영역" : AXIS_KR[input.axis];

  const methodParts = [S3_LABELS, gapSentence(input)];
  if (input.mode === "disengage") methodParts.push(S3_DISENGAGE);

  let key = `${input.leadGroup},${input.mode}`;
  const sub = input.copingSubScores;
  if (
    input.mode === "primary" &&
    input.leadGroup === "G4" &&
    input.leadFactors.includes("approval_cw") &&
    (sub.support ?? 0) - (sub.problem_solving ?? 0) >= 1.0
  ) {
    key = "G4,primary_support";
  }
  const s7 = (S7[key] ?? S7[`G2,${input.mode}`]).replace(/\{ax\}/g, ax);

  return {
    s3Personality: BASE_KNOWLEDGE[input.typeCode].personality,
    s3Methods: methodParts.join(" "),
    s7Direction: annotate(s7),
  };
}

// 따옴표·공백 차이는 같은 문장으로 봅니다(AI가 인용부호를 바꿔 써도 "그대로"로 인정).
const loose = (t: string) => t.replace(/[\s"'“”‘’]/g, "");

/** 문단(여러 문장)을 문장 단위로 쪼갭니다 — 보존율 측정과 누락 판정에 씁니다. */
export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[요죠다])\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface EnforceReport {
  block: string;
  retained: number;
  total: number;
  insertedWhole: boolean;
}

/**
 * 생성 결과에 JunSeok 문장이 얼마나 그대로 남았는지 세고, 한 문단의 문장이 절반 이상 빠졌으면
 * 그 문단을 서버가 정해진 자리에 그대로 끼워 넣습니다(AI가 슬쩍 바꿔 써도 JunSeok 문장은 반드시 들어가도록).
 */
export function enforceJunseokDraft(
  sections: { section3: string[]; section7: string[] },
  draft: JunseokDraft
): { sections: { section3: string[]; section7: string[] }; reports: EnforceReport[] } {
  const reports: EnforceReport[] = [];
  const out = { section3: [...sections.section3], section7: [...sections.section7] };

  const check = (key: "section3" | "section7", block: string, label: string, insertAt: number) => {
    const sents = splitSentences(block);
    const hay = loose(out[key].join(""));
    const retained = sents.filter((s) => hay.includes(loose(s))).length;
    let insertedWhole = false;
    if (retained < Math.ceil(sents.length / 2)) {
      out[key].splice(Math.min(insertAt, out[key].length), 0, block);
      insertedWhole = true;
    }
    reports.push({ block: label, retained, total: sents.length, insertedWhole });
  };

  check("section3", draft.s3Personality, "섹션3 문단A(성격적 특징)", 1);
  check("section3", draft.s3Methods, "섹션3 문단B(방식 풀이·점수 비교)", 3);
  check("section7", draft.s7Direction, "섹션7 방향 문단", 1);
  return { sections: out, reports };
}
