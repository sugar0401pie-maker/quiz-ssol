// 2026-09-25: "유형간 관계성 보고서" — /match에서 상대 유형을 고른 뒤 유료로 보는 심층 리포트.
// 솔로 심층 리포트(lib/reportAssembly.ts)와 같은 "1번은 무료, 2번부터 결제" 틀을 그대로 쓰되,
// 내용은 두 사람의 관계(영역 관계 × 대처방식 관계)를 다룹니다. 상대는 실제 회원가입 없이 유형만
// 골라 들어오는 구조라 상대의 실제 점수는 없고, 그래서 전부 결정론적 조립입니다(AI 호출 없음 —
// "일단 만들어달라"는 요청 범위에서는 비용 없이 안정적으로 내보내는 쪽이 우선입니다).
import {
  AXIS_KR,
  DESSERT,
  MODE_KR,
  TONE_TABLE,
  domainRelation,
  type AxisKey,
  type ModeKey,
  type TypeCode,
} from "./data";
import { annotateMode } from "./reportV3/modeAnnotation";

interface Tips {
  strength: string[];
  caution: string[];
}

const RELATIONSHIP_TIPS: Record<string, Tips> = {
  "same-same": {
    strength: [
      "같은 고민, 같은 대처 방식이라 별다른 설명 없이도 서로를 이해할 수 있어요. 힘든 순간에도 굳이 말하지 않아도 알아주는 든든함이 있습니다.",
    ],
    caution: [
      "너무 닮아서 같은 맹점을 함께 갖고 있을 수 있어요. 가끔은 서로에게서 벗어나 다른 사람의 시선을 빌려보는 것도 도움이 될 수 있습니다.",
    ],
  },
  "same-diff": {
    strength: [
      "같은 고민을 다른 각도에서 보고 있어서, 내가 못 본 해법을 상대에게서 빌려올 수 있어요. 이야기를 나눌수록 선택지가 늘어나는 관계입니다.",
    ],
    caution: [
      "상대의 대처 방식이 답답하게 느껴질 때는, 틀린 게 아니라 다른 길일 뿐이라는 걸 떠올려보세요. 방식을 맞추려 하기보다 각자의 속도를 존중하는 편이 관계에 도움이 됩니다.",
    ],
  },
  "connected-same": {
    strength: [
      "뿌리가 이어진 고민을 비슷한 방식으로 풀어가고 있어서, 깊은 이야기를 나누기에 편안한 사이예요. 한쪽의 경험이 다른 쪽에게도 바로 도움이 될 때가 많습니다.",
    ],
    caution: [
      "비슷한 지점에서 같이 지칠 수 있으니, 둘 다 힘든 시기가 겹칠 땐 서로를 다그치기보다 잠시 각자의 시간을 갖는 것도 좋아요.",
    ],
  },
  "connected-diff": {
    strength: [
      "뿌리는 닿아있지만 해법은 다르니, 대화할수록 생각지 못한 힌트를 주고받을 수 있어요. 서로의 방식을 빌려 쓰다 보면 혼자서는 못 찾았을 균형을 만들 수 있습니다.",
    ],
    caution: [
      "방식이 다르다 보니 서로의 선택을 판단하고 싶어질 수 있어요. \"왜 그렇게 해?\"보다 \"그건 어떻게 도움이 돼?\"라고 물어보면 대화가 한결 편해집니다.",
    ],
  },
  "independent-same": {
    strength: [
      "영역은 겹치지 않아도 대처하는 태도가 비슷해서, 서로의 고민에 깊이 관여하지 않아도 나란히 편안하게 지낼 수 있어요.",
    ],
    caution: [
      "서로의 영역에 큰 관심이 없다 보니 무심하게 느껴질 수 있어요. 가끔은 먼저 물어봐 주는 작은 관심이 관계를 더 단단하게 만듭니다.",
    ],
  },
  "independent-diff": {
    strength: [
      "영역도 대처 방식도 다르니, 나에게 없는 완전히 새로운 관점을 얻을 수 있는 사이예요. 익숙한 틀에서 벗어나고 싶을 때 가장 신선한 자극을 주는 관계입니다.",
    ],
    caution: [
      "공통점을 찾기 어려워 대화의 접점을 만들기까지 시간이 걸릴 수 있어요. 서로의 영역을 궁금해하는 질문 하나가 그 거리를 좁히는 첫걸음이 될 수 있습니다.",
    ],
  },
};

export interface RelationshipSections {
  /** 1번 — 무료. 두 유형 소개. */
  overview: string[];
  /** 2번 — 관계의 결(영역 관계 해석) */
  section2: string[];
  /** 3번 — 대처 방식 비교 */
  section3: string[];
  /** 4번 — 함께 있을 때 좋은 점 */
  section4: string[];
  /** 5번 — 배려하면 좋은 점 */
  section5: string[];
  /** 6번 — 이번 주 제안 */
  section6: string[];
}

export function buildRelationshipSections(
  myName: string,
  myTypeCode: TypeCode,
  friendName: string,
  friendTypeCode: TypeCode
): RelationshipSections {
  const [myAxis, myMode] = myTypeCode.split("-") as [AxisKey, ModeKey];
  const [friendAxis, friendMode] = friendTypeCode.split("-") as [AxisKey, ModeKey];
  const dRel = domainRelation(myAxis, friendAxis);
  const mRel = myMode === friendMode ? "same" : "diff";
  const key = `${dRel}-${mRel}`;
  const tone = TONE_TABLE[key];
  const tips = RELATIONSHIP_TIPS[key];
  const myDessert = DESSERT[myTypeCode];
  const friendDessert = DESSERT[friendTypeCode];

  const overview = [
    `${myName}님은 ${myDessert.name}(${AXIS_KR[myAxis]} 영역 · ${annotateMode(MODE_KR[myMode])}) 유형이고, ${friendName}님은 ${friendDessert.name}(${AXIS_KR[friendAxis]} 영역 · ${annotateMode(MODE_KR[friendMode])}) 유형이에요.`,
    `두 사람의 조합은 "${tone.headline}"에 해당합니다. 아래에서 두 분의 관계를 조금 더 자세히 풀어드릴게요.`,
  ];

  const section6 =
    mRel === "same"
      ? [
          "이번 주엔 같은 방식으로 대처하고 있다는 사실 자체를 서로에게 말해보세요. \"우리 되게 비슷하게 반응하네\"라는 한마디가 생각보다 큰 위안이 될 수 있어요.",
        ]
      : [
          "이번 주엔 서로의 대처 방식을 한 번 빌려서 시도해보세요. 평소라면 안 했을 방식을 잠깐 따라 해보는 것만으로도 새로운 시야가 열릴 수 있어요.",
        ];

  return {
    overview,
    section2: tone.detail.slice(0, 1),
    section3: tone.detail.slice(1),
    section4: tips.strength,
    section5: tips.caution,
    section6,
  };
}
