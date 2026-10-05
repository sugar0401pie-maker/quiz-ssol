import "server-only";
import { AXIS_KR, DESSERT, type AxisKey, type FactorKey, type TypeCode } from "../data";
import { resolveIconKey } from "../icons";
import { EUL_REUL } from "../josa";
import { buildAverageComparisonText } from "./averageComparison";
import { splitBoldParagraph } from "./boldParagraph";
import type { GeneratedSectionsV3 } from "./types";
import { leadInIndexFor } from "./uiSections";

// 2026-09-29: app/api/report/send-email/route.ts에 있던 걸 공용 파일로 뺐습니다 —
// app/api/admin/resend-report-email/route.ts(관리자용 재발송)도 같은 HTML을 써야 해서
// 중복 없이 공유합니다.
export const SITE_ORIGIN = "https://quiz.ssolwellnesshouse.com";
const SOWELLA_URL = "https://app.ssolwellnesshouse.com";

// 2026-09-29: 인라인 <svg>로 그리던 오각형 그래프가 Gmail 등에서 잘려 나가 안 보이고,
// 그 아래 점수 텍스트 줄만 보이던 문제 — 이메일 클라이언트는 인라인 SVG를 신뢰할 수 없이
// 처리합니다. app/api/report/radar-image/route.tsx(next/og ImageResponse)가 같은 그래프를
// 실제 PNG로 구워주므로, 이제 그 이미지를 <img>로 넣습니다. 점수 텍스트 줄은 그래프와
// 중복이라 없앴습니다.
function radarImageUrl(scores: Record<AxisKey, number>): string {
  const qs = (Object.entries(scores) as [AxisKey, number][]).map(([k, v]) => `${k}=${v}`).join("&");
  return `${SITE_ORIGIN}/api/report/radar-image?${qs}`;
}

// 2026-10-01: 하위요인 편차 차트(app/api/report/deviation-image/route.ts)도 같은 이유로
// 이메일에서는 PNG로 구워서 넣습니다.
function deviationImageUrl(factorScores: Record<FactorKey, number>, label: string): string {
  const qs = (Object.entries(factorScores) as [FactorKey, number][]).map(([k, v]) => `${k}=${v}`).join("&");
  return `${SITE_ORIGIN}/api/report/deviation-image?${qs}&label=${encodeURIComponent(label)}`;
}

const SECTION_KEYS = ["section1", "section2", "section3", "section4", "section5", "section6", "section7", "section8"] as const;

// 2026-09-30: "화면에서 보이는 것과 같은 레이아웃으로 보내달라" 요청 — 결제 후 화면
// (app/result/report/view/page.tsx, ReportSectionCard.tsx)의 번호 원 배지 + 제목 카드
// 모양을 이메일에도 인라인 스타일로 재현합니다. 이메일은 토글/아코디언 상호작용을 믿을 수
// 없으니, 이미 결제해서 잠금이 풀린 내용답게 카드를 전부 펼친 상태로 보여줍니다. 색상은
// app/globals.css의 라이트 모드 토큰 값을 그대로 하드코딩했습니다(이메일엔 CSS 변수가
// 안 통해서).
const COLOR_ACCENT = "#d9748a"; // --navy
const COLOR_INK = "#4a2c2a"; // --ink
const COLOR_BORDER = "#f0dfc8"; // --border
const COLOR_CARD_BG = "#fff7ec"; // --sky-bg

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// components/ReportParagraph.tsx와 같은 판정 규칙을 lib/reportV3/boldParagraph.ts에서
// 공유합니다(화면과 메일에서 같은 부분이 굵게 보이도록) — 두괄식 요약 문단(규칙 17)도
// leadInIndexFor()로 화면과 똑같이 찾아서 굵게 표시합니다.
const PARA_STYLE = `margin:0 0 10px;font-size:14px;line-height:1.7;color:${COLOR_INK};`;
function renderParagraph(p: string, forceBold: boolean): string {
  const { boldText, restText } = splitBoldParagraph(p, forceBold);
  if (!boldText) return `<p style="${PARA_STYLE}">${esc(p)}</p>`;
  return `<p style="${PARA_STYLE}"><strong>${esc(boldText)}</strong>${esc(restText)}</p>`;
}

// 화면의 section8-highlight(마지막 문단 강조 박스)와 같은 모양.
function renderHighlightBox(p: string): string {
  return `<div style="border:1.5px solid ${COLOR_ACCENT};border-radius:14px;padding:14px 16px;margin:4px 0 0;">
    <p style="margin:0;font-weight:700;font-size:14px;line-height:1.7;color:${COLOR_INK};">${esc(p)}</p>
  </div>`;
}

// 화면의 .report-section-preview 카드(번호 원 배지 + 제목)와 같은 모양. <table>로
// 배지·제목을 나란히 두는 건 flexbox 지원이 들쑥날쑥한 이메일 클라이언트에서 가장
// 안전하게 통하는 레이아웃 방법입니다.
function renderSectionCard(num: number, title: string, paragraphs: string[], leadInIdx: number | null, highlightLast: boolean): string {
  const bodyHtml = paragraphs
    .map((p, i) => (highlightLast && i === paragraphs.length - 1 ? renderHighlightBox(p) : renderParagraph(p, i === leadInIdx)))
    .join("");

  return `<div style="border:1px solid ${COLOR_BORDER};border-radius:14px;padding:14px 16px;margin-bottom:14px;background:${COLOR_CARD_BG};">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:10px;">
      <tr>
        <td width="26" align="center" valign="middle" style="width:26px;height:26px;border-radius:50%;background:${COLOR_ACCENT};color:#ffffff;font-weight:700;font-size:13px;">${num}</td>
        <td style="padding-left:10px;font-size:15px;font-weight:700;color:${COLOR_INK};" valign="middle">${esc(title)}</td>
      </tr>
    </table>
    ${bodyHtml}
  </div>`;
}

// 2026-10-05: 메일 제목을 "{닉네임} {호칭}님의 심층 웰니스 리포트가 도착했습니다!"로 변경.
// 결제 직후 자동 발송(app/api/report/send-email)과 관리자 재발송(app/api/admin/resend-report-email)이
// 같은 제목을 쓰도록 여기 한 곳에서 만듭니다. 호칭이 없으면(성별 값이 비어있는 옛 데이터) "{닉네임}님"만 씁니다.
export function reportEmailSubject(userName: string, title: string): string {
  const who = title ? `${userName} ${title}님` : `${userName}님`;
  return `${who}의 심층 웰니스 리포트가 도착했습니다!`;
}

export function buildReportEmailHtml(
  typeCode: TypeCode,
  confirmedAxis: AxisKey,
  axisScores: Record<AxisKey, number>,
  factorScores: Record<FactorKey, number>,
  userName: string,
  title: string,
  assembled: GeneratedSectionsV3
): string {
  const dessert = DESSERT[typeCode];
  const axisKR = AXIS_KR[confirmedAxis];
  const titles: Record<string, string> = {
    section1: "당신의 웰니스 프로파일",
    section2: "주목할 만한 부분은",
    section3: `${axisKR}${EUL_REUL(axisKR)} 다루는 나의 방식`,
    section4: "더 자세히 들여다보면",
    section5: `${axisKR}${EUL_REUL(axisKR)} 고민하는 나의 모습`,
    section6: "다른 유형과의 관계성",
    section7: "앞으로 나아갈 방향",
    section8: "바로 지금, 작은 변화를 만들어봐요",
  };
  const profileUrl = `${SITE_ORIGIN}/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`;

  let body = `<div style="text-align:center;margin-bottom:20px;">
    <img src="${profileUrl}" alt="${esc(dessert.name)}" width="220" style="width:220px;max-width:100%;border-radius:16px;display:block;margin:0 auto 16px;" />
    <h1 style="font-size:20px;margin:0 0 12px;color:${COLOR_INK};">${esc(dessert.name)}의 웰니스 이야기</h1>
    <img src="${radarImageUrl(axisScores)}" alt="다섯 영역 오각형 그래프" width="295" height="195" style="width:295px;max-width:100%;display:block;margin:0 auto;" />
  </div>`;
  body += renderSectionCard(1, titles.section1, assembled.section1 ?? [], leadInIndexFor("section1", assembled.section1 ?? []), false);

  // 2026-10-01: 심층보고서 결제자 전용 "전체 유형 평균 대비" 블록 — 섹션 1 바로 아래,
  // 섹션 2가 시작되기 전에 넣습니다(화면 app/result/report/view/page.tsx와 같은 위치).
  const comparison = buildAverageComparisonText(userName, title, factorScores, confirmedAxis, axisKR, dessert.name);
  // intro[0]("~를 전체 유형별 평균과 대비하면 다음과 같습니다.")만 굵게 — 화면(view/page.tsx)과 같게.
  const comparisonParas = [...comparison.intro, ...comparison.deviationNote]
    .map((p, i) => renderParagraph(p, i === 0))
    .join("");
  body += `<div style="margin:0 0 14px;">
    ${comparisonParas}
    <img src="${deviationImageUrl(factorScores, `나의 점수(${esc(dessert.name)})`)}" alt="하위요인별 평균 대비 내 위치 그래프" width="700" style="width:100%;max-width:700px;display:block;margin:4px auto 0;" />
  </div>`;

  SECTION_KEYS.filter((key) => key !== "section1").forEach((key, idx) => {
    const paragraphs = assembled[key] ?? [];
    const leadInIdx = leadInIndexFor(key, paragraphs);
    body += renderSectionCard(idx + 2, titles[key], paragraphs, leadInIdx, key === "section8");
  });

  // 2026-10-05: 메일 맨 아래에 AI 채팅(쏘웰라, app.ssolwellnesshouse.com)으로 가는 버튼 한 개.
  // 결제 후 리포트 화면(app/result/report/view/page.tsx)의 "웰니스 채팅 쏘웰라 이용하기" 버튼과
  // 같은 이름·같은 주소입니다. 이메일은 CSS 변수·버튼 요소를 믿을 수 없어서 인라인 스타일 링크로 만듭니다.
  body += `<div style="text-align:center;margin:24px 0 8px;">
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${COLOR_INK};">테스트하실 때 가입하신 계정으로 쏘웰라를 그대로 이용하실 수 있어요.</p>
    <a href="${SOWELLA_URL}" target="_blank" style="display:inline-block;background:${COLOR_ACCENT};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">AI 기반 웰니스 채팅 쏘웰라로 이동하기</a>
  </div>`;
  return body;
}
