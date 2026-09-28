// final-ssol-wellness-v2-master-spec.md 기준 데이터. 문항·문구·데이터는 스펙 4장/6장/8장의
// "그대로 사용" 코드를 그대로 옮긴 것입니다 — 자구를 다듬지 마세요(스펙 11장 1번 규칙).

import { GWA_WA } from "./josa";

export type AxisKey = "CAR" | "LOV" | "REL" | "SLF" | "DIR";
export type FactorKey =
  | "job_fit" | "partner_fit" | "attachment" | "boundary" | "global_worth" | "values"
  | "meaning" | "tension_tol" | "competence_cw" | "approval_cw";
export type CopingSubKey =
  | "problem_solving" | "support" | "reframing" | "acceptance" | "cog_avoid" | "beh_avoid";
export type ModeKey = "primary" | "secondary" | "disengage";
export type TypeCode = `${AxisKey}-${ModeKey}`;
export type Gender = "female" | "male" | "none";

export type IconKey =
  // 아트 있음(12종) — 7종은 v1 뚜렷형, 5종은 v1 혼합형 일러스트를 그대로 재사용합니다
  // (v2 스펙이 "신규 8종"이라 명시한 것 중 5개는 이미 갖고 있던 파일과 이름이 같았습니다).
  | "brownie" | "tiramisu" | "millefeuille" | "macaron" | "meringue" | "castella" | "croissant"
  | "shortcake" | "berrycheesecake" | "basquecake" | "madeleine" | "lemontart"
  // 아트 없음(3종) — 디자이너 신규 발주 필요. 도착 전까지 플레이스홀더 카드로 표시합니다.
  | "affogato" | "berrysorbet" | "fruittart";

export const GENDER_TITLE: Record<Gender, string> = { female: "공주", male: "왕자", none: "공작" };

// ============================================================
// 1부 문항 (21개, 영역 건강도)
// ============================================================
export const REVERSED = new Set([
  "P01", "P04", "P06", "P07", "P10", "P12", "P14", "P15", "P17", "P18", "P19", "P20",
]);

export interface Part1Item {
  factor: FactorKey;
  t: string;
}

export const PART1_ITEMS: Record<string, Part1Item> = {
  P01: { factor: "job_fit", t: "지금 하는 일이나 진로를 이대로 이어가도 될지 고민된다." },
  P02: { factor: "job_fit", t: "지금 하는 일이 나와 잘 맞는다고 느낀다." },
  P03: { factor: "partner_fit", t: "현재 또는 미래 파트너와 앞으로의 연애를 상상하면 기대가 된다." },
  P04: { factor: "partner_fit", t: "어떤 사람이 나에게 맞는 상대인지 잘 모르겠다." },
  P05: { factor: "attachment", t: "연애할 때 나는 상대에게 마음을 열고 의지하는 게 편한 편이다." },
  P06: { factor: "attachment", t: "연애할 때 상대의 마음이 변할까 봐 신경 쓰일 때가 많다." },
  P07: { factor: "boundary", t: "다른 사람들에게 어디까지 맞춰주어야 하는지 잘 모르겠다." },
  P08: { factor: "boundary", t: "들어주기 부담스러운 부탁을 거절하는 데 어려움이 없다." },
  P09: { factor: "global_worth", t: "나는 나 자신이 꽤 괜찮은 사람이라고 느낀다." },
  P10: { factor: "global_worth", t: "지금의 나를 있는 그대로 받아들이기 어렵다고 느낄 때가 있다." },
  P11: { factor: "values", t: "내 삶에 정말 중요한 것들이 무엇인지 비교적 분명히 안다." },
  P12: { factor: "values", t: "중요한 선택 앞에서 무엇을 기준으로 삼아야 할지 잘 모르겠다." },
  P13: { factor: "meaning", t: "하루하루가 의미 있게 느껴지곤 한다." },
  P14: { factor: "meaning", t: "지금 하고 있는 일이 결국 무엇을 위한 건지 잘 모르겠다." },
  P15: { factor: "tension_tol", t: "관계에서 애매한 감정이 남아있으면 그게 풀리기 전까지는 집중이 잘 안 된다." },
  P16: { factor: "tension_tol", t: "상대와 다투고, 완전히 풀지 못한 채여도 이를 모른 척 하고 함께 대화할 수 있다." },
  P17: { factor: "competence_cw", t: "내 기준만큼 일을 해내지 못하는 사람을 보면 유독 답답하거나 화가 난다." },
  P18: { factor: "competence_cw", t: "원했던 성과를 달성하지 못하면 내 가치가 낮아지는 것 같다." },
  P19: { factor: "approval_cw", t: "직장 동료나 친구들이 나를 어떻게 생각하는지에 따라 기분이 흔들리는 편이다." },
  P20: { factor: "approval_cw", t: "사람들에게 좋은 모습만 보여야 한다는 부담을 느끼곤 한다." },
  P21: { factor: "approval_cw", t: "누군가 나에게 실망하거나 서운해 하여도 스스로에 대한 따뜻한 태도가 크게 바뀌진 않는다." },
};
export const PART1_ORDER = [
  "P01", "P03", "P07", "P09", "P11", "P13", "P15", "P17", "P19",
  "P05", "P02", "P04", "P08", "P10", "P12", "P14", "P16", "P18", "P20", "P06", "P21",
];

// ============================================================
// 2부 문항 (12개, 대처 방식)
// ============================================================
export interface Part2Item {
  sub: CopingSubKey;
  t: string;
}

export const PART2_ITEMS: Record<string, Part2Item> = {
  Q01: { sub: "problem_solving", t: "고민 해결을 위해 지금 할 수 있는 일을 실행한다." },
  Q02: { sub: "problem_solving", t: "무엇이 문제인지 따져보며 계획을 세운다." },
  Q03: { sub: "support", t: "믿을 만한 사람에게 고민을 털어놓으며 위로를 받는다." },
  Q04: { sub: "support", t: "비슷한 경험이 있는 사람이나 전문가에게 조언을 구한다." },
  Q05: { sub: "reframing", t: "같은 상황을 새로운 각도로 보며 다르게 해석할 수 있는 여지는 없는지 본다." },
  Q06: { sub: "reframing", t: "이 일에서 내가 오히려 배울 수 있는 건 없는지 생각해본다." },
  Q07: { sub: "acceptance", t: "내가 바꿀 수 없는 부분이라면 있는 그대로 받아들이려 한다." },
  Q08: { sub: "acceptance", t: "포기는 아니지만 대신 기대를 조금 낮추며 마음의 부담을 덜어낸다." },
  Q09: { sub: "cog_avoid", t: "가능한 한 그 고민을 생각하지 않으려 한다." },
  Q10: { sub: "cog_avoid", t: "'어떻게든 되겠지' 하며 일단은 미뤄둔다." },
  Q11: { sub: "beh_avoid", t: "고민을 해결하려는 시도 자체를 그만두고 그냥 손을 놓는다." },
  Q12: { sub: "beh_avoid", t: "고민을 떠올리게 하는 사람, 장소, 대화 등을 되도록 피한다." },
};
export const PART2_ORDER = ["Q01", "Q05", "Q09", "Q03", "Q07", "Q11", "Q02", "Q06", "Q10", "Q04", "Q08", "Q12"];

// 응답 척도
export const PART1_LABELS = ["전혀 아니다", "아닌 편이다", "보통이다", "그런 편이다", "매우 그렇다"] as const;
export const PART2_LABELS = ["거의 안 한다", "가끔 한다", "종종 한다", "자주 한다", "거의 항상 한다"] as const;

export const PART1_INTRO =
  "최근 한 달 동안의 나를 떠올리며, 각 문장이 나와 얼마나 비슷한지 골라주세요. 지금 일을 하고 있지 않거나 연애 중이 아니라면, 가장 최근의 경험을 떠올려 답해도 괜찮아요.";
export function part2Intro(axisKR: string): string {
  return `방금 고른 '${axisKR}'${GWA_WA(axisKR)} 관련된 고민을 떠올려 주세요. 요즘 이 고민이 떠오르거나 관련된 일이 생길 때, 나는 주로 어떻게 하고 있나요? (진로·연애를 골랐는데 지금 해당하지 않는다면, 가장 최근의 고민을 떠올려도 괜찮아요.)`;
}

// ============================================================
// 하위요인 → 영역 매핑
// ============================================================
export const FACTORS: Record<FactorKey, string[]> = {
  job_fit: ["P01", "P02"],
  partner_fit: ["P03", "P04"],
  attachment: ["P05", "P06"],
  boundary: ["P07", "P08"],
  global_worth: ["P09", "P10"],
  values: ["P11", "P12"],
  meaning: ["P13", "P14"],
  tension_tol: ["P15", "P16"],
  competence_cw: ["P17", "P18"],
  approval_cw: ["P19", "P20", "P21"],
};
export const BRIDGE_FACTORS = new Set<FactorKey>(["meaning", "tension_tol", "competence_cw", "approval_cw"]);

export const AXES: Record<AxisKey, FactorKey[]> = {
  CAR: ["job_fit", "meaning", "competence_cw"],
  LOV: ["partner_fit", "attachment", "tension_tol"],
  REL: ["boundary", "tension_tol", "approval_cw"],
  SLF: ["global_worth", "competence_cw", "approval_cw"],
  DIR: ["values", "meaning"],
};
export const AXIS_ORDER: AxisKey[] = ["CAR", "LOV", "REL", "SLF", "DIR"];
// 2026-09-28: v3 인계서 라벨 교체 — 커리어→진로, 나 자신→자기, 삶의 방향→인생 (연애·관계는 그대로).
export const AXIS_KR: Record<AxisKey, string> = { CAR: "진로", LOV: "연애", REL: "관계", SLF: "자기", DIR: "인생" };
export const AXIS_KR_JOSA_EUN: Record<AxisKey, string> = {
  CAR: "진로는", LOV: "연애는", REL: "관계는", SLF: "자기는", DIR: "인생은",
};

export const FACTOR_KR: Record<FactorKey, string> = {
  job_fit: "직무·진로 적합성", partner_fit: "파트너 적합성", attachment: "연애 애착 안정감",
  boundary: "경계 설정", global_worth: "전반적 자기가치", values: "가치 명료성",
  meaning: "의미", tension_tol: "관계 긴장 감내력",
  competence_cw: "유능함 기반 자기가치", approval_cw: "인정 기반 자기가치",
};

// ============================================================
// 대처 하위요인 → 방식 매핑
// ============================================================
export const COPING_SUB: Record<CopingSubKey, string[]> = {
  problem_solving: ["Q01", "Q02"],
  support: ["Q03", "Q04"],
  reframing: ["Q05", "Q06"],
  acceptance: ["Q07", "Q08"],
  cog_avoid: ["Q09", "Q10"],
  beh_avoid: ["Q11", "Q12"],
};
export const MODES: Record<ModeKey, CopingSubKey[]> = {
  primary: ["problem_solving", "support"],
  secondary: ["reframing", "acceptance"],
  disengage: ["cog_avoid", "beh_avoid"],
};
export const MODE_ORDER: ModeKey[] = ["primary", "secondary", "disengage"];
// 2026-09-28: v3 인계서 라벨 교체 — 1차통제/2차통제/이탈 → 용기형/평온형/유보형.
export const MODE_KR: Record<ModeKey, string> = { primary: "용기형", secondary: "평온형", disengage: "유보형" };
export const MODE_CODE: Record<ModeKey, string> = { primary: "용기형", secondary: "평온형", disengage: "유보형" };

// ============================================================
// 확인 화면 문구 (4.4, 원문 그대로)
// ============================================================
export const AXIS_CONFIRM_SINGLE = (axisKR: string) => `요즘 가장 에너지가 필요한 영역은 ${axisKR}인 것 같아요. 맞나요?`;
export const AXIS_CONFIRM_TIE = (aKR: string, bKR: string) =>
  `${aKR}와 ${bKR}가 비슷하게 에너지가 필요해 보여요. 지금 더 마음이 쓰이는 쪽은?`;
export const AXIS_CONFIRM_ALL_HIGH = "모든 영역이 비교적 잘 채워져 있어요. 그래도 요즘 하나를 더 살펴본다면?";
export const MODE_CONFIRM_QUESTION = "이 고민 앞에서 나에게 더 가까운 쪽은?";
export const MODE_CONFIRM_OPTIONS: Record<ModeKey, string> = {
  primary: "직접 움직여서 바꿔보려 한다",
  secondary: "다르게 보거나 받아들이려 한다",
  disengage: "일단 거리를 두고 지낸다",
};

// ============================================================
// 15유형 두 줄 설명 (무료 결과)
// ============================================================
// 2026-09-25: "그 마음 앞에서 직접 움직이며 채워보려는 방식을 가장 많이 써요" 같은 문장이
// 무슨 뜻인지 잘 안 와닿는다는 피드백을 반영해, 실제로 어떻게 행동하는지 구체적으로 풀어썼습니다.
export const TYPE_LINE2: Record<TypeCode, string> = {
  "CAR-primary": "고민이 생기면 정보를 찾아보고 계획을 세운 뒤 바로 실행에 옮겨요.",
  "CAR-secondary": "일 고민이 생기면 같은 상황을 다른 각도로 보려고 해요.",
  "CAR-disengage": "일 고민이 버거우면 그 생각 자체를 잠시 밀어두는 편이에요.",
  "LOV-primary": "마음이 생기면 먼저 다가가고 표현하는 편이에요.",
  "LOV-secondary": "기대만큼 안 풀려도 상황을 다르게 보려고 하는 편이에요.",
  "LOV-disengage": "연애 고민이 힘들면 그 감정과 거리를 두는 편이에요.",
  "REL-primary": "불편함이 생기면 경계를 분명히 하고 직접 조율해요.",
  "REL-secondary": "부담스러운 순간에도 기준은 지키되 다정하게 조율해요.",
  "REL-disengage": "관계가 부담스러워지면 살짝 뒤로 물러나는 편이에요.",
  "SLF-primary": "부족한 점이 보이면 바로 배우거나 시도해보는 편이에요.",
  "SLF-secondary": "부족한 점이 보여도 스스로에게 다정하게 말해주는 편이에요.",
  "SLF-disengage": "나에 대한 고민이 버거우면 조용히 거리를 두는 편이에요.",
  "DIR-primary": "방향이 흔들리면 직접 탐색하고 시도해보는 편이에요.",
  "DIR-secondary": "방향이 불확실할 땐 상황을 다른 시선으로 바라봐요.",
  "DIR-disengage": "방향을 하나로 정하지 않고 흘러가는 대로 두는 편이에요.",
};
export const TYPE_LINE1: Record<AxisKey, string> = {
  CAR: "요즘 가장 에너지가 필요한 영역은 일과 진로예요.",
  LOV: "요즘 가장 에너지가 필요한 영역은 연애예요.",
  REL: "요즘 가장 에너지가 필요한 영역은 주변 사람들과의 관계예요.",
  SLF: "요즘 가장 에너지가 필요한 영역은 자기예요.",
  DIR: "요즘 가장 에너지가 필요한 영역은 인생이에요.",
};

// 2026-09-25: 결과 화면 "당신은 이런 사람일거에요"를 5줄로 늘려달라는 요청 — TYPE_LINE1·TYPE_LINE2에
// 이어 보여줄 3줄(구체적 성향 · 이 유형의 강점 · 살짝 챙겨보면 좋을 점)입니다.
export const TYPE_TRAITS: Record<TypeCode, [string, string, string]> = {
  "CAR-primary": [
    "성과나 역할에서 나의 가치를 확인하려는 마음이 큰 편이에요.",
    "머뭇거리기보다 일단 부딪혀보는 추진력이 강점이에요.",
    "가끔은 멈춰서 지금 방향이 맞는지 점검하는 시간도 필요해요.",
  ],
  "CAR-secondary": [
    "성과가 기대에 못 미쳐도 스스로를 다그치기보다 다독이는 편이에요.",
    "조급해하지 않고 상황을 소화하는 여유가 강점이에요.",
    "생각 정리가 끝나면 작은 행동으로 옮기는 연습도 도움이 돼요.",
  ],
  "CAR-disengage": [
    "마감이나 평가 이야기가 나오면 화제를 돌리거나 미뤄두곤 해요.",
    "스스로에게 숨 돌릴 틈을 주는 건 나쁘지 않은 방법이에요.",
    "아주 작은 것 하나부터 다시 시작해보면 거리가 좁혀질 거예요.",
  ],
  "LOV-primary": [
    "관계에 문제가 생기면 피하지 않고 바로 대화를 청해요.",
    "감정을 숨기지 않는 솔직함이 이 유형의 매력이에요.",
    "상대의 속도도 함께 살피면 관계가 더 편안해질 거예요.",
  ],
  "LOV-secondary": [
    "기대치를 조정하며 스스로의 마음을 먼저 다독여요.",
    "감정에 휩쓸리지 않는 안정감이 강점이에요.",
    "정리된 마음을 상대에게도 표현해보면 관계가 더 깊어져요.",
  ],
  "LOV-disengage": [
    "연락을 줄이거나 생각 자체를 피하며 상황을 넘기곤 해요.",
    "스스로를 지키려는 자연스러운 방법이에요.",
    "믿을 만한 사람에게 마음을 조금씩 꺼내보면 좋을 거예요.",
  ],
  "REL-primary": [
    "거절할 땐 분명히 말하고 대화를 미루지 않는 편이에요.",
    "나를 지키면서도 관계를 이어가는 균형 감각이 강점이에요.",
    "가끔은 상대의 입장도 한 번 더 헤아려보면 좋아요.",
  ],
  "REL-secondary": [
    "바로 반응하기보다 생각을 정리한 뒤 부드럽게 전해요.",
    "관계도 나도 함께 지키는 균형이 강점이에요.",
    "정리된 생각을 상대에게 표현하는 연습도 도움이 될 거예요.",
  ],
  "REL-disengage": [
    "연락을 줄이거나 모임을 피하며 스스로를 보호해요.",
    "무리하지 않고 나를 지키는 방법이에요.",
    "편한 사람 한 명에게만이라도 마음을 이야기해보면 좋아요.",
  ],
  "SLF-primary": [
    "있는 그대로의 나를 적극적으로 바꿔나가려 해요.",
    "꾸미지 않고 나아가는 실행력이 이 유형의 힘이에요.",
    "가끔은 애쓰지 않아도 충분하다고 스스로에게 말해주세요.",
  ],
  "SLF-secondary": [
    "'이 정도면 나쁘지 않다'며 마음을 가라앉히곤 해요.",
    "스스로를 몰아붙이지 않는 다정함이 강점이에요.",
    "정말 바꾸고 싶은 부분 하나쯤은 작게 시도해보세요.",
  ],
  "SLF-disengage": [
    "다른 일에 몰두하며 그 생각을 미뤄두곤 해요.",
    "잠시 거리를 두는 건 자연스러운 방법이에요.",
    "하루 중 짧은 시간이라도 나를 들여다보면 좋을 거예요.",
  ],
  "DIR-primary": [
    "다양한 선택지를 직접 경험하며 방향을 좁혀가요.",
    "움직이며 답을 찾아가는 추진력이 이 유형의 힘이에요.",
    "가끔은 멈춰서 걸어온 길을 돌아보는 시간도 필요해요.",
  ],
  "DIR-secondary": [
    "조급해하지 않고 지금 시기의 의미를 찾으려 해요.",
    "흔들리지 않는 여유가 이 유형의 강점이에요.",
    "생각이 정리되면 작은 것부터 실행에 옮겨보세요.",
  ],
  "DIR-disengage": [
    "미래에 대한 질문이 나오면 자연스럽게 화제를 넘기곤 해요.",
    "유연하게 흘러가는 것도 하나의 방식이에요.",
    "이번 달 해볼 것 하나만 작게 정해보면 좋을 거예요.",
  ],
};

export const DISCLAIMER =
  "이 테스트는 최근의 고민과 그 고민을 다루는 방식을 스스로 돌아보기 위한 웰니스 콘텐츠이며, 심리검사나 의료적 진단이 아닙니다. 결과는 응답하신 시기의 상태를 반영하며 시간과 상황에 따라 달라질 수 있어요. 일상생활이 어려울 만큼 힘든 시기라면 전문 상담이나 의료기관의 도움을 받아보시길 권해요.";

// ============================================================
// 15유형 & 디저트 계열 (6장)
// ============================================================
export interface DessertFamily {
  name: string;
  desc: string;
}
export const DESSERT_FAMILY: Record<AxisKey, DessertFamily> = {
  CAR: { name: "커피 계열", desc: "일과 진로는 하루를 깨우는 카페인처럼, 우리를 각성시키고 몰아붙이는 에너지를 상징해요." },
  LOV: { name: "베리 계열", desc: "연애는 새콤달콤한 베리처럼, 설렘과 새콤함이 함께 오가는 감정의 영역이에요." },
  REL: { name: "프렌치 페이스트리 계열", desc: "관계는 정교하게 매만진 페이스트리처럼, 섬세한 균형과 거리 조절이 필요한 영역이에요." },
  SLF: { name: "담백 시트 계열", desc: "자기는 화려한 장식이 없어도 온전한 담백한 시트류처럼, 있는 그대로도 충분한 나를 상징해요." },
  DIR: { name: "타르트·페이스트리 계열", desc: "인생은 여러 재료가 하나의 결 위에 놓이는 타르트처럼, 여러 갈래를 하나의 방향으로 엮어가는 영역이에요." },
};

export interface Dessert {
  name: string;
  icon: IconKey;
  hasArt: boolean;
  why: string;
}
export const DESSERT: Record<TypeCode, Dessert> = {
  "CAR-primary": { name: "에스프레소 브라우니", icon: "brownie", hasArt: true, why: "진하고 힘 있게 밀어붙이는 브라우니처럼, 일이나 진로 고민 앞에서 몸을 먼저 움직이는 편이에요. 고민이 생기면 일단 정보를 찾아보고, 다음 스텝을 정하고, 바로 실행에 옮기는 식으로 문제를 풀어갑니다. 답을 기다리기보다 직접 만들어가는 추진력이 이 유형의 가장 큰 힘입니다. 다만 속도를 늦추고 지금 하는 일이 정말 나에게 맞는지 잠시 돌아보는 시간도 챙겨보면 좋아요." },
  "CAR-secondary": { name: "티라미수", icon: "tiramisu", hasArt: true, why: "커피를 층층이 스며들게 해 부드럽게 다독이듯, 일 고민이 생기면 관점을 먼저 바꿔보는 편이에요. '이 상황에서 배울 건 없을까', '다르게 보면 어떨까'를 자연스럽게 떠올리며 스스로를 다독입니다. 조급해하지 않고 상황을 소화할 시간을 주는 여유가 이 유형의 강점입니다. 가끔은 생각을 정리한 다음 작은 행동으로 옮기는 연습도 도움이 될 거예요." },
  "CAR-disengage": { name: "아포가토", icon: "affogato", hasArt: true, why: "뜨거운 에스프레소에서 한 발 물러나 시원하게 녹이듯, 일 고민이 버거울 땐 잠시 그 생각 자체를 밀어두는 편이에요. 마감이나 성과 이야기가 나오면 일부러 다른 데로 화제를 돌리거나, '나중에 생각하지 뭐' 하고 미뤄두곤 합니다. 잠깐 숨 돌릴 틈을 스스로에게 주는 건 나쁘지 않지만, 너무 오래 미루면 고민이 더 무거워질 수 있어요. 아주 작은 것 하나라도 오늘 해볼 수 있는 걸 찾아보면, 거리를 좁히는 첫걸음이 될 거예요." },

  "LOV-primary": { name: "딸기 쇼트케이크", icon: "shortcake", hasArt: true, why: "신선한 딸기를 직접 골라 쌓아올리듯, 연애 고민이 생기면 마음을 먼저 표현하고 행동으로 옮기는 편이에요. 좋아하는 마음이 들면 먼저 다가가고, 관계에 문제가 생기면 대화를 청하며 직접 풀어보려 합니다. 감정을 숨기지 않고 적극적으로 나누는 용기가 이 유형의 매력입니다. 상대의 속도도 함께 살피면서 나아가면 관계가 더 편안해질 거예요." },
  "LOV-secondary": { name: "베리 치즈케이크", icon: "berrycheesecake", hasArt: true, why: "새콤함을 크리미하게 감싸안듯, 연애에서 기대만큼 안 풀리는 순간에도 마음을 다독이며 받아들이는 편이에요. '지금은 이런 시기인가 보다' 하고 상황을 다르게 보거나, 기대치를 조금 낮추며 스스로를 보호합니다. 감정에 휩쓸리지 않고 스스로를 다독이는 안정감이 이 유형의 힘입니다. 마음이 정리됐을 때는 그 생각을 상대에게도 살짝 표현해보면 관계가 더 깊어질 수 있어요." },
  "LOV-disengage": { name: "베리 소르베", icon: "berrysorbet", hasArt: true, why: "붙잡지 않고 차갑게 스쳐 지나가 녹아 사라지듯, 연애 고민이 힘들 땐 그 감정과 거리를 두는 편이에요. 연락을 줄이거나, 그 사람 생각 자체를 피하거나, 만남 자체를 미루는 식으로 상황을 넘기곤 합니다. 스스로를 지키기 위한 자연스러운 방법이지만, 감정을 계속 미뤄두면 나중에 한꺼번에 몰려올 수 있어요. 믿을 만한 사람에게 마음을 조금씩 꺼내보는 것부터 시작해보면 좋을 거예요." },

  "REL-primary": { name: "밀푀유", icon: "millefeuille", hasArt: true, why: "한 겹씩 직접 쌓아 올리듯, 관계에서 불편함이 생기면 경계를 분명히 하고 직접 조율하는 편이에요. 거절해야 할 땐 분명히 말하고, 필요한 대화는 미루지 않고 먼저 꺼내는 식으로 관계를 관리합니다. 스스로를 지키면서도 관계를 이어가는 균형 감각이 이 유형의 힘입니다. 가끔은 너무 명확하게 선을 긋기보다 상대의 입장도 한 번 더 헤아려보면 좋아요." },
  "REL-secondary": { name: "딸기마카롱", icon: "macaron", hasArt: true, why: "매끈한 겉과 부드러운 속처럼, 관계에서 부담스러운 순간에도 기준은 지키되 다정하게 조율하는 편이에요. 바로 반응하기보다 '이 상황을 어떻게 받아들이면 좋을까'를 먼저 생각한 뒤 부드럽게 의견을 전합니다. 관계를 해치지 않으면서 스스로도 지키는 균형이 이 유형의 강점입니다. 마음속으로만 정리하지 말고, 정리된 생각을 상대에게 한 번은 표현해보는 것도 도움이 될 거예요." },
  "REL-disengage": { name: "머랭쿠키", icon: "meringue", hasArt: true, why: "부서지기 쉬운 머랭처럼, 관계가 부담스러워지는 순간엔 살짝 뒤로 물러나는 편이에요. 연락을 줄이거나 모임을 피하는 식으로 거리를 두며 스스로를 보호합니다. 무리하지 않고 나를 지키는 방법이지만, 너무 자주 물러나면 관계 자체가 멀어질 수 있어요. 정말 편한 한 사람에게만이라도 지금 마음을 살짝 이야기해보면 좋을 거예요." },

  "SLF-primary": { name: "바스크 치즈케이크", icon: "basquecake", hasArt: true, why: "일부러 거칠게 태운 표면 그대로, 꾸미지 않고 자기 자신을 적극적으로 채워가는 편이에요. 부족하다고 느끼는 부분이 있으면 바로 배우거나 시도해보면서 스스로를 발전시켜갑니다. 있는 그대로의 나를 바꿔나가려는 실행력이 이 유형의 힘입니다. 가끔은 애쓰지 않고 지금 이대로도 충분하다고 스스로에게 말해주는 시간도 필요해요." },
  "SLF-secondary": { name: "마들렌", icon: "madeleine", hasArt: true, why: "익숙한 조개 모양 안에서, 스스로를 다독이며 있는 그대로 받아들이는 편이에요. 부족한 점이 보여도 '이 정도면 나쁘지 않다'고 스스로에게 다정하게 말해주며 마음을 가라앉힙니다. 스스로를 몰아붙이지 않는 다정함이 이 유형의 강점입니다. 받아들이는 데서 그치지 않고, 정말 바꾸고 싶은 부분 하나쯤은 작게 시도해보는 것도 좋아요." },
  "SLF-disengage": { name: "카스텔라", icon: "castella", hasArt: true, why: "담백하고 균일한 결처럼, 자기 자신에 대한 고민이 버거울 땐 그 생각과 조용히 거리를 두는 편이에요. 스스로를 들여다보는 대신 다른 일에 몰두하거나 그 생각 자체를 미뤄두곤 합니다. 잠시 거리를 두는 건 자연스러운 일이지만, 계속 미루면 자신에 대한 확신이 흐려질 수 있어요. 하루 중 아주 짧은 시간이라도 나에 대해 생각해보는 시간을 가져보면 좋을 거예요." },

  "DIR-primary": { name: "피스타치오 크루아상", icon: "croissant", hasArt: true, why: "새로운 결을 만들어가듯, 인생의 방향이 흔들릴 때 직접 탐색하고 시도해보며 답을 찾는 편이에요. 새로운 정보를 찾아보고, 다양한 선택지를 직접 경험해보면서 방향을 조금씩 좁혀갑니다. 가만히 있지 않고 움직이며 답을 찾아가는 추진력이 이 유형의 힘입니다. 가끔은 멈춰서 지금까지 걸어온 길을 돌아보는 시간도 방향을 분명히 하는 데 도움이 될 거예요." },
  "DIR-secondary": { name: "레몬 머랭 타르트", icon: "lemontart", hasArt: true, why: "새콤함을 다르게 음미하듯, 방향이 불확실할 때 지금의 상황을 다른 시선으로 바라보는 편이에요. '지금 이 시기도 의미가 있을 거야'라고 생각하며 조급해하지 않고 방향을 다시 그려봅니다. 불확실함 앞에서도 흔들리지 않는 여유가 이 유형의 강점입니다. 생각이 정리되면 작은 것부터 하나씩 실행에 옮겨보는 것도 좋은 다음 걸음이 될 거예요." },
  "DIR-disengage": { name: "프루트 타르트", icon: "fruittart", hasArt: true, why: "여러 과일이 자유롭게 얹혀있듯, 방향을 하나로 정하지 않고 그때그때 흘러가는 대로 두는 편이에요. 진로나 미래에 대한 질문이 나오면 구체적으로 답하기보다 자연스럽게 화제를 넘기곤 합니다. 유연하게 흘러가는 것도 하나의 방식이지만, 너무 오래 정하지 않으면 방향 없이 표류하는 느낌이 들 수 있어요. 아주 작은 것 하나만이라도 '이번 달엔 이걸 해본다' 하고 정해보면 좋을 거예요." },
};

// ============================================================
// 궁합(매칭) — 9장
// ============================================================
export const GROUPS: Record<string, FactorKey[]> = {
  G1: ["job_fit", "boundary"],
  G2: ["partner_fit", "values", "meaning"],
  G3: ["global_worth", "tension_tol", "attachment"],
  G4: ["competence_cw", "approval_cw"],
};
export function groupOf(factor: FactorKey): string | undefined {
  return Object.keys(GROUPS).find((g) => GROUPS[g].includes(factor));
}

export const BRIDGE_TARGETS: Record<string, AxisKey[]> = {
  meaning: ["CAR", "DIR"],
  tension_tol: ["LOV", "REL"],
  competence_cw: ["CAR", "SLF"],
  approval_cw: ["REL", "SLF"],
};
export const SHARED_PAIR: { pair: [AxisKey, AxisKey]; factor: FactorKey }[] = [
  { pair: ["CAR", "DIR"], factor: "meaning" },
  { pair: ["LOV", "REL"], factor: "tension_tol" },
  { pair: ["CAR", "SLF"], factor: "competence_cw" },
  { pair: ["REL", "SLF"], factor: "approval_cw" },
];

// ============================================================
// 궁합(매칭) — ssol-wellness-v2-master-spec.md 9장, "그대로 사용" 로직
// (2026-09-25: 어제 만든 BEST_AXIS_MATCH/WORST_AXIS_MATCH 자체 설계는 폐기합니다.
// 스펙 9.1이 명시하듯, 원래의 점수 기반 멘토 로직도 이미 폐기된 설계입니다 — 점수 입력 없이
// 유형 코드(영역+대처방식) 구조만으로 궁합을 근사하는 이 버전이 v2의 유일한 기준입니다.)
export type DomainRelation = "same" | "connected" | "independent";
export type ModeRelation = "same" | "diff";

export function domainRelation(a: AxisKey, b: AxisKey): DomainRelation {
  if (a === b) return "same";
  const connected = SHARED_PAIR.some(({ pair }) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a));
  return connected ? "connected" : "independent";
}

export interface MatchTone {
  domainRelation: DomainRelation;
  modeRelation: ModeRelation;
  headline: string;
  body: string;
  /** 2026-09-25: /match 결과에서 쓰는 길게 풀어쓴 버전(2개 문단). 결과 화면의 작은 미리보기
   *  카드(match-desc)는 여전히 짧은 body를 씁니다 — 카드 안에 다 들어가지 않기 때문입니다. */
  detail: string[];
}

// 스펙 9.4/9.5 — 영역 관계(같은/연결/독립) × 대처방식 관계(같음/다름) 6가지 조합.
// 절대 원칙: 1차·2차·이탈 사이에 우열이 없으므로, 어떤 톤도 "안 맞는다"는 식으로 쓰지 않습니다.
export const TONE_TABLE: Record<string, { headline: string; body: string; detail: string[] }> = {
  "same-same": {
    headline: "설명 없이도 통하는 사이예요",
    body: "완전히 같은 유형이에요! 같은 고민을 안고, 같은 방식으로 풀어가고 있다는 뜻입니다. 설명하지 않아도 서로 다 알 것 같은, 가장 편안한 사이입니다.",
    detail: [
      "완전히 같은 유형이에요! 같은 영역에서 비슷한 고민을 안고 있고, 그 고민을 풀어가는 방식까지 같다는 뜻입니다. 겪고 있는 상황을 구구절절 설명하지 않아도, 서로의 반응과 속도를 이미 알고 있는 것처럼 편안하게 느껴질 거예요.",
      "다만 너무 닮아 있어서 같은 지점에서 함께 막힐 수도 있다는 점은 기억해두면 좋아요. 그럴 땐 서로를 다그치기보다, 같은 자리에 서 있다는 사실 자체를 위로 삼아보세요. 한쪽이 먼저 작은 변화를 시도하면, 다른 한쪽도 그 힌트를 자연스럽게 따라갈 수 있을 거예요.",
    ],
  },
  "same-diff": {
    headline: "같은 고민을 다른 방법으로 풀어가는 사이예요",
    body: "같은 고민을 하고 있지만 푸는 방식은 서로 다릅니다. 한쪽은 직접 부딪히고, 다른 한쪽은 관점을 바꾸거나 거리를 두며 나름의 방식으로 소화하고 있는 것입니다. 같은 문제를 다르게 풀어가는 모습에서 서로 배울 점을 찾을 수 있어요.",
    detail: [
      "같은 영역에서 같은 고민을 하고 있지만, 그 고민을 풀어가는 방식은 서로 다릅니다. 한쪽은 상황을 직접 바꾸려고 부딪히는 편이고, 다른 한쪽은 관점을 바꾸거나 잠시 거리를 두며 나름의 속도로 소화하고 있는 셈입니다. 겉으로 드러나는 태도는 달라 보여도, 마주한 고민의 뿌리는 정확히 같은 곳에 있어요.",
      "그래서 서로의 방식을 이해하지 못하면 답답하게 느껴질 수 있지만, 반대로 들여다보면 내가 갖지 못한 해법을 바로 옆에서 참고할 수 있는 사이이기도 합니다. 같은 문제를 다르게 풀어가는 모습을 지켜보는 것만으로도, 나에게 없던 선택지를 하나 더 얻는 셈이에요.",
    ],
  },
  "connected-same": {
    headline: "결이 통하는 사이예요",
    body: "겉보기엔 다른 고민 같아도, 뿌리가 맞닿아 있습니다. 두 사람이 신경 쓰는 지점이 실은 하나의 요인에서 함께 갈라져 나온 것입니다. 게다가 비슷한 방식으로 대처하고 있어서, 별다른 설명 없이도 결이 잘 통하는 사이예요.",
    detail: [
      "겉보기엔 서로 다른 고민 같아도, 실제로는 뿌리가 맞닿아 있는 사이입니다. 두 사람이 각자 신경 쓰는 지점이 사실은 하나의 요인에서 함께 갈라져 나온 것이라, 이야기를 나누다 보면 '어? 나도 그런데'라는 순간이 생각보다 자주 찾아올 거예요.",
      "게다가 그 고민에 대처하는 방식까지 비슷해서, 별다른 설명 없이도 결이 잘 통합니다. 한 사람이 먼저 풀어놓은 이야기가 다른 한 사람에게는 자신의 고민을 이해하는 실마리가 되어줄 수 있는, 편안하면서도 서로에게 도움이 되는 관계예요.",
    ],
  },
  "connected-diff": {
    headline: "같은 뿌리, 다른 해법을 가진 사이예요",
    body: "뿌리가 비슷한 고민을 갖고 있지만, 다루는 방식은 서로 다릅니다. 한쪽은 부딪히며 풀어가고, 다른 한쪽은 받아들이거나 거리를 두며 다르게 소화하는 셈입니다. 같은 문제를 전혀 다른 각도에서 바라보게 되니, 대화를 나눌수록 생각지 못한 힌트를 얻을 수 있어요.",
    detail: [
      "뿌리가 비슷한 고민을 갖고 있지만, 다루는 방식은 서로 다릅니다. 한쪽은 상황에 직접 부딪히며 바꿔나가는 편이고, 다른 한쪽은 받아들이거나 한 걸음 물러나 다르게 소화하는 쪽에 가깝습니다. 겉으로 보이는 태도는 달라도, 마음속 깊이 신경 쓰는 지점은 놀랍도록 비슷하게 겹쳐 있어요.",
      "그래서 같은 문제를 전혀 다른 각도에서 바라보게 되고, 대화를 나눌수록 생각지 못한 힌트를 얻을 수 있습니다. 내가 막혀 있던 지점을 상대는 이미 다른 방식으로 지나온 적이 있을 수도 있어요. 서로의 해법을 빌려 쓰다 보면, 혼자였다면 찾지 못했을 균형을 함께 만들어갈 수 있는 사이입니다.",
    ],
  },
  "independent-same": {
    headline: "각자의 영역에서 편안한 사이예요",
    body: "완전히 다른 영역의 고민이지만, 대처하는 방식은 비슷합니다. 서로의 고민에 깊이 개입하지 않아도, 문제를 대하는 태도만큼은 자연스럽게 맞아떨어지는 것입니다. 각자의 영역에서 편하게, 나란히 나아갈 수 있는 사이예요.",
    detail: [
      "완전히 다른 영역에서 각자의 고민을 안고 있지만, 그 고민을 대하는 태도만큼은 비슷합니다. 서로의 고민에 깊이 개입하지 않아도, 문제를 풀어가는 방식이 자연스럽게 맞아떨어지는 셈이에요.",
      "그래서 서로의 영역을 굳이 이해하려 애쓰지 않아도, 나란히 함께 있는 것만으로 편안함을 느낄 수 있는 사이입니다. 각자의 자리에서 각자의 속도로 나아가면서도, 같은 리듬으로 걷고 있다는 감각을 공유할 수 있을 거예요.",
    ],
  },
  "independent-diff": {
    headline: "완전히 새로운 관점을 주는 사이예요",
    body: "고민의 영역도, 대처 방식도 완전히 다릅니다. 서로가 마주한 상황도, 그 상황을 다루는 태도도 겹치는 지점이 거의 없다는 뜻입니다. 그만큼 나에게 없는 관점을 만날 수 있는, 가장 새로운 자극을 주는 사이예요.",
    detail: [
      "고민의 영역도, 그 고민을 대하는 방식도 서로 완전히 다릅니다. 지금 마주한 상황도, 그 상황을 풀어가는 태도도 겹치는 지점이 거의 없다는 뜻이에요.",
      "그만큼 나에게는 없는 관점을 만날 수 있는, 가장 새로운 자극을 주는 사이이기도 합니다. 익숙한 방식에서 벗어나고 싶을 때, 이 사람과의 대화가 전혀 다른 방향의 실마리를 던져줄 수 있어요.",
    ],
  },
};

export function matchTone(myAxis: AxisKey, myMode: ModeKey, friendAxis: AxisKey, friendMode: ModeKey): MatchTone {
  const dRel = domainRelation(myAxis, friendAxis);
  const mRel: ModeRelation = myMode === friendMode ? "same" : "diff";
  const key = `${dRel}-${mRel}`;
  return { domainRelation: dRel, modeRelation: mRel, ...TONE_TABLE[key] };
}

// 결과 화면의 자동 미리보기 2칸(친구 입력 없이 바로 보여주는 예시)용 — 실제 "친구와 궁합 보기"는
// /match에서 친구 유형을 직접 골라 matchTone()으로 계산합니다. 여기서는 그중 대표적인 두 조합
// (connected-same / independent-diff)을 골라 예시로 보여줍니다.
function firstConnectedAxis(axis: AxisKey): AxisKey {
  const entry = SHARED_PAIR.find(({ pair }) => pair.includes(axis))!;
  return entry.pair[0] === axis ? entry.pair[1] : entry.pair[0];
}
function firstIndependentAxis(axis: AxisKey): AxisKey {
  return AXIS_ORDER.find((a) => a !== axis && domainRelation(axis, a) === "independent")!;
}
export function previewMatchTypes(my: TypeCode): { connectedSame: TypeCode; independentDiff: TypeCode } {
  const [axis, mode] = my.split("-") as [AxisKey, ModeKey];
  const otherMode: ModeKey = mode === "primary" ? "secondary" : mode === "secondary" ? "disengage" : "primary";
  return {
    connectedSame: `${firstConnectedAxis(axis)}-${mode}` as TypeCode,
    independentDiff: `${firstIndependentAxis(axis)}-${otherMode}` as TypeCode,
  };
}
