import "server-only";
import { AXIS_KR, AXIS_ORDER, DESSERT, type AxisKey, type TypeCode } from "../data";
import { resolveIconKey } from "../icons";
import { EUL_REUL } from "../josa";
import { fmtScore } from "../scoring";

// 2026-09-29: app/api/report/send-email/route.ts에 있던 걸 공용 파일로 뺐습니다 —
// app/api/admin/resend-report-email/route.ts(관리자용 재발송)도 같은 HTML을 써야 해서
// 중복 없이 공유합니다.
export const SITE_ORIGIN = "https://quiz.ssolwellnesshouse.com";

// 이메일 HTML은 CSS 변수/인터랙션을 못 쓰니, components/RadarChart.tsx와 같은 기하 계산을
// 그대로 옮기되 라이트모드 색을 하드코딩한 고정 SVG 문자열로 만듭니다.
function buildRadarSvg(scores: Record<AxisKey, number>): string {
  const CX = 142, CY = 100, MAX_R = 72, MAX_SCORE = 5;
  const N = AXIS_ORDER.length;
  const angleFor = (i: number) => ((-90 + i * (360 / N)) * Math.PI) / 180;
  const pointAt = (i: number, r: number): [number, number] => {
    const a = angleFor(i);
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const dataPts = AXIS_ORDER.map((d, i) => pointAt(i, (Math.max(0, Math.min(scores[d], MAX_SCORE)) / MAX_SCORE) * MAX_R));

  const rings = [0.34, 0.67, 1]
    .map((level) => `<polygon points="${AXIS_ORDER.map((_, i) => pointAt(i, MAX_R * level).join(",")).join(" ")}" fill="none" stroke="#f0dfc8" stroke-width="1"/>`)
    .join("");
  const spokes = AXIS_ORDER.map((d, i) => {
    const p = pointAt(i, MAX_R);
    return `<line x1="${CX}" y1="${CY}" x2="${p[0]}" y2="${p[1]}" stroke="#f0dfc8" stroke-width="1"/>`;
  }).join("");
  const shape = `<polygon points="${dataPts.map((p) => p.join(",")).join(" ")}" fill="#d9748a" fill-opacity="0.18" stroke="#d9748a" stroke-width="2"/>`;
  const dots = dataPts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="#d9748a"/>`).join("");
  const labels = AXIS_ORDER.map((d, i) => {
    const p = pointAt(i, MAX_R + 18);
    const anchor = p[0] < CX - 8 ? "end" : p[0] > CX + 8 ? "start" : "middle";
    return `<text x="${p[0]}" y="${p[1]}" text-anchor="${anchor}" dominant-baseline="middle" font-size="11.5" fill="#8a6f5c" font-family="'Noto Sans KR', sans-serif">${AXIS_KR[d]}</text>`;
  }).join("");

  return `<svg viewBox="0 0 295 195" width="295" height="195" xmlns="http://www.w3.org/2000/svg">${rings}${spokes}${shape}${dots}${labels}</svg>`;
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
  const profileUrl = `${SITE_ORIGIN}/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`;
  const scoreLine = AXIS_ORDER.map((a) => `${AXIS_KR[a]} ${fmtScore(axisScores[a])}점`).join(" · ");

  let body = `<div style="text-align:center;margin-bottom:20px;">
    <img src="${profileUrl}" alt="${esc(dessert.name)}" width="220" style="width:220px;max-width:100%;border-radius:16px;display:block;margin:0 auto 16px;" />
    <h1 style="font-size:20px;margin:0 0 12px;">${esc(dessert.name)}의 웰니스 이야기</h1>
    <div style="max-width:295px;margin:0 auto;">${buildRadarSvg(axisScores)}</div>
    <p style="font-size:13px;color:#8a6f5c;margin:8px 0 0;">${esc(scoreLine)}</p>
  </div>`;
  for (const key of ["section1", "section2", "section3", "section4", "section5", "section6", "section7", "section8"]) {
    body += `<h2 style="font-size:16px;">${titles[key]}</h2>`;
    for (const p of assembled[key] ?? []) body += `<p>${esc(p)}</p>`;
  }
  return body;
}
