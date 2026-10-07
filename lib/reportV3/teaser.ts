// 2026-10-07: 결제 전 "블러 미리보기"(app/result/report/page.tsx → components/ReportTeaser.tsx)에 쓰는 문장을
// 서버에서 만듭니다. 목표는 "스크롤하면 내 리포트 내용이 이어지는 것처럼 보이되, 읽으려면 결제"입니다.
//
// 원칙(중요 — 보안):
// - 결제해야 볼 수 있는 AI 본문은 이 시점에 아예 존재하지 않으며(결제 후 생성), 여기서도 만들지 않습니다.
// - "선명하게" 보여주는 문장(clear)은 AI 없이 점수만으로 정해지는 확정 문장(JunSeok 원문·유형 설명·궁합 소개)의 앞부분
//   1~2문장뿐입니다. 이 앞부분은 무료로 공개해도 되는 맛보기로 정한 것입니다.
// - "블러" 부분(blur)은 실제 내용이 아니라, 같은 길이로 맞춘 일반적인 자리표시 문장입니다. CSS 블러는 개발자도구로
//   풀 수 있으므로, 가린 곳에 진짜 유료 내용을 넣으면 안 됩니다.
import { AXES, AXIS_KR, FACTOR_KR, type AxisKey, type FactorKey } from "../data";
import { EY } from "../josa";
import { fmtScore } from "../scoring";
import { BASE_KNOWLEDGE } from "./baseKnowledge";
import { buildJunseokDraft, splitSentences } from "./junseokDraft";
import type { ReportV3Input } from "./prompt";
import { assembleSection6Relationships } from "./section6Assembler";
import { sectionTitlesForAxis, SECTION_TITLES } from "./uiSections";

export interface TeaserSection {
  num: number;
  title: string;
  /** 선명하게 보이는 문단(없을 수 있음). */
  clear: string[];
  /** 블러로 가려 보이는 자리표시 문단. */
  blur: string[];
}

// JunSeok sentence_bank.py의 S2_LEAD / S2_COMPOSE — 섹션 2의 맨 앞 두 문장(주도요인 설명)입니다.
const S2_LEAD: Record<FactorKey, string> = {
  job_fit: "지금 하는 일이 나와 잘 맞는지, 이 길을 계속 가도 될지에 대한 확신이 약한 상태예요.",
  partner_fit: "앞으로의 연애를 떠올릴 때 기대보다 물음표가 더 큰 상태예요.",
  attachment: "연애 안에서 마음을 편안하게 내려놓기 어려운 부분이 있어요.",
  boundary: "관계 안에서 내 것을 지키는 게 요즘 버거운 상태예요.",
  global_worth: "조건과 무관하게 나를 괜찮게 느끼는 바탕이 요즘 옅어져 있는 상태예요.",
  values: "나에게 무엇이 중요한지, 내게 중요한 결정을 내리는 기준이 무엇인지가 명확하지 않은 상태예요.",
  meaning: "하루하루 지낼 때나 지금 하는 일이 무엇을 위한 것인지 의미를 느끼기 어려워하는 상태예요.",
  tension_tol: "관계에 풀리지 않은 감정이 남아 있을 때, 그 상태를 안고 평소처럼 지내기가 어려운 편이에요.",
  competence_cw: "얼마나 잘 해냈는지가 나를 평가하는 잣대와 가깝게 붙어 있는 상태예요.",
  approval_cw: "다른 사람의 반응이 내가 스스로를 바라보는 방식에 영향을 많이 주는 상태예요.",
};

// 블러 자리표시 문장 — 어떤 리포트에도 들어갈 수 있는 일반적인 문장이라 실제 내용을 담지 않습니다.
const FILLER = [
  "이 부분에서는 점수와 응답을 함께 살펴보면서, 하루 속에서 어떤 모습으로 나타나는지 풀어서 설명해요.",
  "같은 상황에서도 사람마다 떠올리는 장면이 조금씩 달라서, 구체적인 장면과 함께 짚어드려요.",
  "그 마음이 왜 그렇게 움직이는지 쉬운 말로 풀어보고, 그럴 때 도움이 되는 방향도 이어서 이야기해요.",
  "잠깐 숨을 고르고 지금의 나를 있는 그대로 바라보면, 생각보다 많은 힌트가 눈에 들어올 거예요.",
  "작은 선택 하나하나에도 나만의 기준이 묻어 있다는 걸, 실제 응답을 예로 들며 확인해봐요.",
  "비슷한 고민을 다른 방식으로 다루는 사람들의 모습과 견주어보면, 내 방식이 더 선명하게 보여요.",
  "여기서 이어지는 내용을 읽고 나면, 이번 주에 바로 해볼 수 있는 구체적인 한 걸음이 정리돼요.",
  "정답을 찾으려 하기보다 나에게 맞는 속도를 찾는 데 초점을 맞춰서 이야기를 이어가요.",
];

function filler(paragraphs: number, offset: number): string[] {
  const out: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    const sents = [0, 1, 2].map((s) => FILLER[(offset + p * 3 + s) % FILLER.length]);
    out.push(sents.join(" "));
  }
  return out;
}

// splitSentences()는 문장 사이 마침표를 떼어내므로, 다시 붙여서 문장이 이어 붙어 보이지 않게 한다.
const firstSentences = (text: string, n: number) =>
  splitSentences(text)
    .slice(0, n)
    .map((t) => (/[.!?]$/.test(t) ? t : t + "."))
    .join(" ");

export function buildReportTeaser(input: ReportV3Input): TeaserSection[] {
  const { sectionTitle3, sectionTitle4, sectionTitle5 } = sectionTitlesForAxis(input.axis);
  const titles = [SECTION_TITLES[1], sectionTitle3, sectionTitle4, sectionTitle5, SECTION_TITLES[5], SECTION_TITLES[6], SECTION_TITLES[7]];
  const nums = [2, 3, 4, 5, 6, 7, 8];

  const draft = buildJunseokDraft(input);
  const bk = BASE_KNOWLEDGE[input.typeCode];

  // 섹션 2: 확정 영역의 주도요인(가장 낮은 하위요인)을 설명하는 두 문장.
  const lead = input.leadFactors[0];
  const axisBody = input.axis === ("SLF" as AxisKey) ? "자기 영역" : AXIS_KR[input.axis];
  const leadLabel = `${FACTOR_KR[lead]}(${fmtScore(input.factorScores[lead])}점)`;
  const s2Clear = `${axisBody} 점수는 ${AXES[input.axis].length}가지 요인으로 이루어져 있는데, 그중 가장 낮은 건 ${leadLabel}${EY(FACTOR_KR[lead])}. ${S2_LEAD[lead]}`;

  // 섹션 6: 서버가 AI 없이 조립하는 궁합 소개의 첫 문단.
  const s6 = assembleSection6Relationships(input.axis, input.mode, input.companions, input.neighbors, input.contrasts);

  const clears: string[][] = [
    [s2Clear], // 2
    [firstSentences(draft.s3Personality, 2)], // 3
    [], // 4
    [firstSentences(bk.domainStyle, 2)], // 5
    s6.length ? [s6[0]] : [], // 6
    [firstSentences(draft.s7Direction, 2)], // 7
    [], // 8
  ];

  return titles.map((title, i) => ({
    num: nums[i],
    title,
    clear: clears[i].filter(Boolean),
    blur: filler(2, i * 2),
  }));
}
