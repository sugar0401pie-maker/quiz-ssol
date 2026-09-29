// 2026-09-29: "이스터에그처럼 숨은 유형 2개" 요청 — SSOL_히든결과_강함과_도움신호/결과_페이지_문구.md
// 원문 그대로. 15유형 체계 밖의 특별 결과라 심층 리포트가 없습니다(lib/scoring.ts의
// detectSpecialResult 참고).
import type { SpecialResultKey } from "./scoring";

export interface SpecialResultContent {
  key: SpecialResultKey;
  image: string;
  tagBadge?: string;
  title: string;
  subtitle: string;
  body: string[];
  listTitle: string;
  list: { label: string; text: string }[];
  calloutTitle: string;
  callout: string;
  quote: string;
  footnote?: string;
}

export const SPECIAL_RESULTS: Record<SpecialResultKey, SpecialResultContent> = {
  cake: {
    key: "cake",
    image: "/images/special/cake.png",
    title: "모든 관점에서 강한 초슈퍼울트라짱디저트!",
    subtitle: "흔들리지 않아서 강한 게 아니라, 흔들려도 자기 자리로 돌아올 줄 아는 만렙 디저트예요.",
    body: [
      "당신은 커리어, 연애, 관계, 나 자신, 삶의 방향까지 어느 한쪽에만 기대지 않고 삶을 균형 있게 이끌어가고 있어요. 원하는 것이 무엇인지 알고, 필요한 순간에는 선택하고 움직일 수 있으며, 사람들과 가까워질 때도 나만의 경계를 잃지 않아요.",
      "무엇보다 당신의 진짜 강점은 언제나 완벽하다는 데 있지 않아요. 마음이 흔들리거나 계획이 틀어져도 자신을 다시 돌보고, 경험을 다음 선택의 힘으로 바꿀 수 있다는 데 있어요. 여러 맛이 조화롭게 쌓인 3단 케이크처럼, 지금의 당신은 각기 다른 삶의 영역을 꽤 단단하게 쌓아 올린 상태예요.",
    ],
    listTitle: "다섯 가지 관점",
    list: [
      { label: "커리어", text: "목표를 세우고 실행하면서도 상황에 맞게 방향을 조정할 줄 알아요." },
      { label: "연애", text: "애정을 표현하면서도 자신을 잃지 않는 건강한 경계를 지켜요." },
      { label: "관계", text: "다가갈 때와 거리를 둘 때를 알고, 관계 속에서 솔직함을 선택해요." },
      { label: "나 자신", text: "장점과 부족한 부분을 함께 바라보며 스스로를 존중해요." },
      { label: "삶의 방향", text: "남의 정답보다 자신의 가치와 기준을 중심으로 선택해요." },
    ],
    calloutTitle: "초슈퍼울트라짱 포인트",
    callout: "강한 사람도 쉬어야 해요. 모든 일을 혼자 해결하려 하지 않고, 누군가의 도움과 호의를 편하게 받아들이는 순간 당신의 균형은 더 오래 유지될 거예요.",
    quote: "나는 완벽해서 강한 게 아니야. 다시 나아갈 줄 알아서 강한 거야!",
  },
  biscotti: {
    key: "biscotti",
    image: "/images/special/biscotti.png",
    tagBadge: "CRY FOR HELP",
    title: "지금은 혼자 버티기보다, 누군가의 손을 잡아야 할 때예요.",
    subtitle: "당신이 약한 사람이어서가 아니라, 여러 영역의 에너지가 한꺼번에 낮아진 상태일 수 있어요.",
    body: [
      "최근 커리어, 연애, 관계, 나 자신, 삶의 방향 어느 곳에서도 마음 놓을 자리를 찾기 어려웠을 수 있어요. 무엇부터 바꿔야 할지 모르겠고, 작은 선택조차 평소보다 무겁게 느껴질지도 몰라요.",
      "하지만 이 결과는 당신에게 능력이 없거나 앞으로도 계속 힘들 거라는 뜻이 아니에요. 오랫동안 혼자 감당하느라 마음의 힘이 줄어들었고, 지금은 더 열심히 버티는 것보다 안전하게 기대고 회복할 시간이 필요하다는 신호에 가까워요. 조금 기울어진 케이크도 받침과 손길이 더해지면 다시 단단히 설 수 있어요.",
    ],
    listTitle: "지금 필요한 것",
    list: [
      { label: "하나만 고르기", text: "모든 문제를 한꺼번에 해결하려 하지 말고, 오늘 가장 힘든 한 가지부터 골라보세요." },
      { label: "상태를 말하기", text: "믿을 수 있는 사람에게 “요즘 조금 버겁고, 잠깐 이야기하고 싶어”라고 알려보세요." },
      { label: "기본을 회복하기", text: "수면, 식사, 씻기, 짧은 산책처럼 몸을 지키는 작은 행동을 우선해도 괜찮아요." },
      { label: "도움을 연결하기", text: "혼자 정리하기 어렵다면 전문 상담사와 함께 지금의 상황을 천천히 나눠보세요." },
    ],
    calloutTitle: "꼭 기억할 점",
    callout: "도움을 요청하는 것은 무너졌다는 증거가 아니라, 자신을 지키기 위해 방향을 바꾸는 능력이에요. 지금 필요한 것은 더 강해지라는 요구가 아니라, 혼자가 아니라는 경험일 수 있어요.",
    quote: "나 지금은 조금 지쳤어. 잠깐 내 옆에 있어줄래?",
    footnote: "이 결과는 의학적 진단이 아니며, 현재의 마음 상태를 돌아보기 위한 참고 자료입니다.",
  },
};
