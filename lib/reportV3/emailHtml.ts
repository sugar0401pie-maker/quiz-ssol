import "server-only";
import { AXIS_KR, DESSERT, type AxisKey, type TypeCode } from "../data";
import { resolveIconKey } from "../icons";
import { EUL_REUL } from "../josa";

// 2026-09-29: app/api/report/send-email/route.ts에 있던 걸 공용 파일로 뺐습니다 —
// app/api/admin/resend-report-email/route.ts(관리자용 재발송)도 같은 HTML을 써야 해서
// 중복 없이 공유합니다.
export const SITE_ORIGIN = "https://quiz.ssolwellnesshouse.com";

// 2026-09-29: 인라인 <svg>로 그리던 오각형 그래프가 Gmail 등에서 잘려 나가 안 보이고,
// 그 아래 점수 텍스트 줄만 보이던 문제 — 이메일 클라이언트는 인라인 SVG를 신뢰할 수 없이
// 처리합니다. app/api/report/radar-image/route.tsx(next/og ImageResponse)가 같은 그래프를
// 실제 PNG로 구워주므로, 이제 그 이미지를 <img>로 넣습니다. 점수 텍스트 줄은 그래프와
// 중복이라 없앴습니다.
function radarImageUrl(scores: Record<AxisKey, number>): string {
  const qs = (Object.entries(scores) as [AxisKey, number][]).map(([k, v]) => `${k}=${v}`).join("&");
  return `${SITE_ORIGIN}/api/report/radar-image?${qs}`;
}

export function buildReportEmailHtml(
  typeCode: TypeCode,
  confirmedAxis: AxisKey,
  axisScores: Record<AxisKey, number>,
  assembled: Record<string, string[]>
): string {
  const dessert = DESSERT[typeCode];
  const axisKR = AXIS_KR[confirmedAxis];
  const titles: Record<string, string> = {
    section1: "1. 당신의 웰니스 프로파일",
    section2: "2. 주목할 만한 부분은",
    section3: `3. ${axisKR}${EUL_REUL(axisKR)} 다루는 나의 방식`,
    section4: "4. 더 자세히 들여다보면",
    section5: `5. ${axisKR}${EUL_REUL(axisKR)} 고민하는 나의 모습`,
    section6: "6. 다른 유형과의 관계성",
    section7: "7. 앞으로 나아갈 방향",
    section8: "8. 바로 지금, 작은 변화를 만들어봐요",
  };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // components/ReportParagraph.tsx와 같은 규칙 — "•" 소제목 줄과 "첫째," 류 서수 접두어를
  // <strong>으로 감쌉니다(화면과 메일에서 같은 부분이 굵게 보이도록).
  const ORDINAL_PREFIX = /^(첫째|둘째|셋째|넷째|다섯째),/;
  const renderParagraph = (p: string) => {
    if (p.startsWith("•")) return `<p><strong>${esc(p)}</strong></p>`;
    const m = p.match(ORDINAL_PREFIX);
    if (!m) return `<p>${esc(p)}</p>`;
    return `<p><strong>${esc(m[0])}</strong>${esc(p.slice(m[0].length))}</p>`;
  };
  const profileUrl = `${SITE_ORIGIN}/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`;

  let body = `<div style="text-align:center;margin-bottom:20px;">
    <img src="${profileUrl}" alt="${esc(dessert.name)}" width="220" style="width:220px;max-width:100%;border-radius:16px;display:block;margin:0 auto 16px;" />
    <h1 style="font-size:20px;margin:0 0 12px;">${esc(dessert.name)}의 웰니스 이야기</h1>
    <img src="${radarImageUrl(axisScores)}" alt="다섯 영역 오각형 그래프" width="295" height="195" style="width:295px;max-width:100%;display:block;margin:0 auto;" />
  </div>`;
  for (const key of ["section1", "section2", "section3", "section4", "section5", "section6", "section7", "section8"]) {
    body += `<h2 style="font-size:16px;">${titles[key]}</h2>`;
    for (const p of assembled[key] ?? []) body += renderParagraph(p);
  }
  return body;
}
