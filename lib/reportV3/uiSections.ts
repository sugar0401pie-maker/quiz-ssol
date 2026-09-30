// 2026-09-29: app/result/report/page.tsx와 app/result/report/view/page.tsx가 각자
// 똑같은 섹션 제목 배열/계산을 복붙해서 갖고 있던 걸 하나로 합쳤습니다 — 프롬프트가
// 정한 섹션 제목 문구가 바뀌면 이 파일 하나만 고치면 됩니다.
import { AXIS_KR, type AxisKey } from "@/lib/data";
import { EUL_REUL } from "@/lib/josa";
import type { GeneratedSectionsV3 } from "./types";

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

// 2026-09-30: 2·3·4·5·7·8번은 AI가 쓴 첫 문단이 곧 두괄식 요약(프롬프트 규칙 17)이라
// 인덱스 0. 6번은 서버가 조립한 "결이 통하는/이어진/대조되는 사람들" 소개 뒤에
// AI가 "• 나와 다른 사람과 잘 지내는 법" 소제목 + 요약 + 조언 3개를 붙이므로, 그
// 소제목 바로 다음 문단이 요약입니다. 1번은 AI가 쓰지 않으므로(서버 조립) 없습니다.
const SECTION6_ADVICE_HEADING = "• 나와 다른 사람과 잘 지내는 법";

export function leadInIndexFor(sectionKey: keyof GeneratedSectionsV3, paragraphs: string[]): number | null {
  if (sectionKey === "section1") return null; // AI가 쓰지 않으므로(서버 조립) 두괄식 요약 없음.
  if (sectionKey === "section6") {
    const headingIdx = paragraphs.findIndex((p) => p.trim() === SECTION6_ADVICE_HEADING);
    return headingIdx >= 0 && headingIdx + 1 < paragraphs.length ? headingIdx + 1 : null;
  }
  return paragraphs.length > 0 ? 0 : null;
}
