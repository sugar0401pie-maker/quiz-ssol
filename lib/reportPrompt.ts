// 2026-09-25: v3deep-report-prompt-and-example.md 1장의 시스템 프롬프트를, "0에서부터 생성"이
// 아니라 "15types-full-reports.md의 대표 시나리오 템플릿을 이 사용자의 실제 점수·응답에 맞게
// 조정"하는 방식으로 재구성했습니다. 사용자 말씀대로 "15개 템플릿은 유형을 대표하는 척도에
// 맞춰진 것이고, 실제 검사자별 결과가 조금씩 다를 때 그 차이를 반영해 조금씩 수정"하는 역할을
// AI가 맡습니다 — 완전히 새로 쓰는 게 아니라 편집(adaptation)에 가까운 과제라, 결과가 템플릿의
// 톤·구조를 벗어날 위험이 낮고 비용도 적게 듭니다.
import { AXIS_KR, FACTOR_KR, MODE_KR, PART1_ITEMS, PART2_ITEMS, type AxisKey, type FactorKey, type ModeKey, type TypeCode } from "./data";
import { fmtScore } from "./scoring";
import { type ReportTemplate } from "./reportTemplates";

export interface ReportPromptInput {
  typeCode: TypeCode;
  dessertName: string;
  confirmedAxis: AxisKey;
  confirmedMode: ModeKey;
  axisScores: Record<AxisKey, number>;
  factorScores: Record<FactorKey, number>;
  modeScores: Record<ModeKey, number>;
  part1Answers: Record<string, number>;
  part2Answers: Record<string, number>;
  template: ReportTemplate;
}

const LIKERT_KR: Record<number, string> = { 1: "전혀 아니다", 2: "아니다", 3: "보통이다", 4: "그렇다", 5: "매우 그렇다" };

// 2026-09-26: 리포트에 사용자의 실제 응답을 3~4개 인용하기 위해, 응답 중 "눈에 띄는" 것 —
// 1점/5점처럼 양 끝을 고른 문항 — 을 골라 AI에게 후보로 넘깁니다. 3점(보통)에서 멀수록 우선.
export function notableAnswers(p1: Record<string, number>, p2: Record<string, number>, limit = 8) {
  const rows = [
    ...Object.entries(p1).map(([id, v]) => ({ id, v, t: PART1_ITEMS[id]?.t })),
    ...Object.entries(p2).map(([id, v]) => ({ id, v, t: PART2_ITEMS[id]?.t })),
  ].filter((r) => r.t && Math.abs(r.v - 3) >= 1);
  rows.sort((a, b) => Math.abs(b.v - 3) - Math.abs(a.v - 3) || a.id.localeCompare(b.id));
  return rows.slice(0, limit).map((r) => `- [${r.id}] "${r.t}" → ${r.v}점 (${LIKERT_KR[r.v]})`);
}

const AXIS_ORDER: AxisKey[] = ["CAR", "LOV", "REL", "SLF", "DIR"];
const MODE_ORDER: ModeKey[] = ["primary", "secondary", "disengage"];

function templateAsMarkdown(t: ReportTemplate): string {
  const sec = (title: string, paras: string[]) =>
    paras.length ? `### ${title}\n\n${paras.join("\n\n")}\n` : `### ${title}\n\n*(해당 없음)*\n`;
  return [
    sec("2. 주 고민 영역 해부", t.section2),
    sec("3. 프로파일 모양", t.section3),
    sec("4. 대처 상세", t.section4),
    sec("5. 고민과 대처의 궁합", t.section5),
    sec("6. 특수 플래그", t.section6),
    sec("7. 이번 주, 조금 더 편안해지기", t.section7),
  ].join("\n");
}

export function buildSystemPrompt(): string {
  return `당신은 쏠 웰니스 하우스(Ssol Wellness House)의 웰니스 유형 분석 AI입니다.
아래 <template_report>는 같은 유형(디저트)을 대표하는 점수 시나리오로 미리 작성해둔 심층
리포트입니다. 당신의 역할은 이 템플릿을 그대로 베끼는 게 아니라, <실제 사용자 데이터>에 맞게
구체적인 점수·문항 인용·설명을 다시 맞춰 쓰는 것입니다. 템플릿의 구조(섹션 순서), 톤, 문단
길이, 접근 방식은 최대한 유지하되, 숫자와 근거 문장은 실제 데이터를 따라야 합니다.

## 배경 지식 (분류 체계)

**5개 생활영역** — 점수는 "그 영역이 얼마나 건강하게 채워져 있는가"를 뜻하며 높을수록
좋습니다(1.0~5.0). 점수가 가장 낮은 영역이 주 고민 영역입니다.
- CAR(커리어) / LOV(연애) / REL(관계) / SLF(나 자신) / DIR(삶의 방향)

**10개 하위요인** (영역 점수 = 하위요인 평균의 평균). 4개는 "다리 요인"으로 두 영역에 동시에
걸쳐 있습니다 — 의미(CAR·DIR) / 관계 긴장 감내력(LOV·REL) / 유능함 기반 자기가치(CAR·SLF) /
인정 기반 자기가치(REL·SLF).

**3가지 대처방식** (Compas 모델). 1차통제·2차통제는 둘 다 건강하며 우열이 없습니다. 이탈은
오래 지속될 때만 조심스럽게 짚습니다.
- 1차통제(직접 바꾸기) / 2차통제(받아들이고 다르게 보기) / 이탈(거리두기)

## 톤 & 원칙

- 존댓말, 판단 없는 관찰자 톤. 따뜻하고 긍정적인 어투를 기본으로 합니다.
- 전체 문장의 절반 정도는 "~입니다/~습니다"체로, 나머지 절반은 "~예요/~해요"체로 섞어
  씁니다. 한 문단 전체가 한쪽 종결어미로만 반복되지 않게 합니다.
- 절대 의료적·정신과적 진단 용어를 쓰지 않습니다.
- 1차통제·2차통제·이탈 사이에 우열을 암시하지 않습니다(이탈은 오래 지속될 때만 조심스럽게).
- 사용자의 실제 인생 사실(가족사, 트라우마, 구체적 사건)을 단정적으로 추측하지 않습니다.
- 결핍·문제·부정적 뉘앙스로만 읽히는 표현을 쓰지 않습니다.
- 점수·유형명 뒤 조사(을/를, 이에요/예요, 은/는 등)가 받침에 맞게 자연스럽게 붙도록 씁니다.
- 각 문단은 4~5문장을 넘지 않게 하고, "반면/그런데/하지만/다만/혹은"처럼 전환이 있는 지점에서는
  새 문단으로 나눠주세요.
- 6번 섹션(특수 플래그)은 아래 <실제 사용자 데이터>의 specialFlags가 비어있으면 반드시
  "*(해당 없음)*"만 씁니다 — 조건에 없는 플래그를 지어내지 마세요.
- <notable_answers>에는 사용자가 실제로 강하게(1점·5점 등) 답한 문항이 있습니다. 리포트 전체에서
  3~4개만 골라, 해당 섹션의 맥락에 자연스럽게 녹여 인용하세요("'…'라는 문항에 '매우 그렇다'고
  답하셨어요"처럼). 한 섹션에 몰아 쓰지 말고 여러 섹션에 나눠 쓰며, 문항 번호(P01 등)는 쓰지
  않습니다. 인용은 응답 사실만 짚고, 그 이유나 사연을 단정하지 마세요. 역문항(예: "고민된다"에
  높은 점수)은 뜻을 뒤집어 오해하지 않게 주의하세요.
- <template_report>에 있는 문장을 토씨 하나 안 틀리고 그대로 베끼지 말고, 실제 데이터에 맞게
  다시 표현하세요. 단, 실제 점수·응답이 템플릿과 거의 같다면 템플릿을 거의 그대로 써도
  괜찮습니다 — 억지로 다르게 쓸 필요는 없습니다.

## 출력 구조 (마크다운 헤더 사용, 6개 섹션 — 1번 오각형은 이미 별도로 무료 제공되므로 제외)

### 2. 주 고민 영역 해부
### 3. 프로파일 모양
### 4. 대처 상세
### 5. 고민과 대처의 궁합
### 6. 특수 플래그
### 7. 이번 주, 조금 더 편안해지기

각 섹션 헤더는 정확히 위 형식("### N. 제목")을 지켜주세요 — 파싱에 사용됩니다.`;
}

export function buildUserPrompt(input: ReportPromptInput): string {
  const { typeCode, dessertName, confirmedAxis, confirmedMode, axisScores, factorScores, modeScores, part1Answers, part2Answers, template } = input;

  const axisLines = AXIS_ORDER.map((a) => `${AXIS_KR[a]}: ${fmtScore(axisScores[a])}${a === confirmedAxis ? " ← 확정" : ""}`).join(
    " / "
  );
  const modeLines = MODE_ORDER.map(
    (m) => `${MODE_KR[m]}: ${fmtScore(modeScores[m])}${m === confirmedMode ? " ← 확정" : ""}`
  ).join(" / ");
  const factorLines = (Object.keys(factorScores) as FactorKey[])
    .map((f) => `${FACTOR_KR[f]}: ${fmtScore(factorScores[f])}`)
    .join(" / ");

  return `<template_report type="${template.name} (${typeCode}, 대표 시나리오)">
${templateAsMarkdown(template)}
</template_report>

<실제 사용자 데이터>
유형: ${dessertName} (${typeCode})
5개 영역 점수: ${axisLines}
전체 하위요인 점수: ${factorLines}
3개 대처방식 점수: ${modeLines}
specialFlags: (서버가 별도로 판정한 조건부 문장이 있으면 여기 채워짐 — 없으면 6번 섹션은
"*(해당 없음)*"만 쓰세요)
</실제 사용자 데이터>

<notable_answers>
${notableAnswers(part1Answers, part2Answers).join("\n") || "(눈에 띄는 응답 없음 — 인용하지 않아도 됩니다)"}
</notable_answers>

위 템플릿을 참고해서, 이 사용자의 실제 데이터에 맞는 2~7번 섹션을 작성해주세요.`;
}
