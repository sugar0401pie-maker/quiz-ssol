// 2026-09-29: "6번에서 관계 유형 중 하나라도 겹치면(같은 유형이 나오면) 6번 바로 위에
// 정원 활동 그림을 보여달라"는 요청 — SSOL_궁합_대표7쌍_가든활동 아트 7쌍을
// public/images/garden-pairs/pair-0N.png로 받아뒀습니다. 이 7쌍은 companions()/
// neighbors()/contrasts()의 92가지 조합 중 특별히 그림이 그려진 대표 케이스입니다.
import type { TypeCode } from "../data";

export interface GardenPair {
  a: TypeCode;
  b: TypeCode;
  image: string;
  activity: string;
}

export const GARDEN_PAIRS: GardenPair[] = [
  { a: "CAR-primary", b: "CAR-secondary", image: "/images/garden-pairs/pair-01.png", activity: "커피와 지도" },
  { a: "LOV-primary", b: "LOV-disengage", image: "/images/garden-pairs/pair-02.png", activity: "손잡고 산책" },
  { a: "SLF-primary", b: "SLF-secondary", image: "/images/garden-pairs/pair-03.png", activity: "데이지 피크닉 티" },
  { a: "SLF-primary", b: "CAR-primary", image: "/images/garden-pairs/pair-04.png", activity: "정원 가꾸기" },
  { a: "LOV-primary", b: "REL-primary", image: "/images/garden-pairs/pair-05.png", activity: "등나무 그네 대화" },
  { a: "DIR-primary", b: "LOV-disengage", image: "/images/garden-pairs/pair-06.png", activity: "다리 탐험" },
  { a: "CAR-primary", b: "REL-disengage", image: "/images/garden-pairs/pair-07.png", activity: "크로케 놀이" },
];

/**
 * 확정 유형(myType)과 6번 섹션에 실제로 등장하는 관계 유형들(relatedTypes) 중
 * 겹치는 대표 7쌍이 있으면 그 하나를 돌려줍니다(여러 개 겹치면 첫 번째만).
 */
export function findGardenPair(myType: TypeCode, relatedTypes: TypeCode[]): GardenPair | null {
  for (const pair of GARDEN_PAIRS) {
    const other = pair.a === myType ? pair.b : pair.b === myType ? pair.a : null;
    if (other && relatedTypes.includes(other)) return pair;
  }
  return null;
}
