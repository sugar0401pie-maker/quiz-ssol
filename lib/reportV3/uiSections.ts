// 2026-09-29: app/result/report/page.tsx와 app/result/report/view/page.tsx가 각자
// 똑같은 섹션 제목 배열/계산을 복붙해서 갖고 있던 걸 하나로 합쳤습니다 — 프롬프트가
// 정한 섹션 제목 문구가 바뀌면 이 파일 하나만 고치면 됩니다.
import { AXIS_KR, type AxisKey } from "@/lib/data";
import { EUL_REUL } from "@/lib/josa";

/** 3번·5번은 영역 이름이 들어가서 빈 문자열 — sectionTitlesForAxis()로 채웁니다. */
export const SECTION_TITLES = [
  "당신의 웰니스 프로파일",
  "주목할 만한 부분은",
  "",
  "더 자세히 들여다보면",
  "",
  "다른 유형과의 관계성",
  "앞으로 나아갈 방향",
  "바로 지금, 작은 변화를 만들어봐요",
] as const;

export function sectionTitlesForAxis(confirmedAxis: AxisKey) {
  const axisKR = AXIS_KR[confirmedAxis];
  return {
    sectionTitle3: `${axisKR}${EUL_REUL(axisKR)} 다루는 나의 방식`,
    sectionTitle4: SECTION_TITLES[3],
    sectionTitle5: `${axisKR}${EUL_REUL(axisKR)} 고민하는 나의 모습`,
  };
}
