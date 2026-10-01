import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { FACTOR_KR, type FactorKey } from "@/lib/data";
import { FACTOR_AVERAGE_V1, FACTOR_DISPLAY_ORDER } from "@/lib/reportV3/factorAverages";

// 2026-10-01: radar-image/route.ts와 같은 이유로 존재합니다 — 이메일 클라이언트(특히 Gmail)는
// 인라인 <svg>를 신뢰할 수 없게 처리해서, 하위요인 편차 차트도 resvg로 PNG를 구워 <img>로
// 넣어야 이메일에서 보입니다. 좌표·색상은 components/SubfactorDeviationChart.tsx와 동일하게
// 맞춥니다(화면과 메일이 같은 그래프로 보이도록).
export const runtime = "nodejs";

const FONT_PATH = path.join(process.cwd(), "lib/fonts/NotoSansKR-Medium.ttf");
const COLOR_AVG = "#F4C0D1";
const COLOR_IND = "#D4537E";
const COLOR_BORDER = "#f0dfc8";
const COLOR_INK = "#4a2c2a";
const COLOR_TEXT3 = "#8f7059";
// 2026-10-01: components/SubfactorDeviationChart.tsx와 같은 이유로 트랙을 넓혔습니다(피드백:
// 라벨 영역이 너무 넓어 그래프가 오른쪽으로 치우쳐 보임).
const TRACK_X0 = 150;
const TRACK_X1 = 690;
const LABEL_X = 145;
const ROW_HEIGHT = 34;
const TOP_PAD = 34;

const scoreToX = (s: number) => TRACK_X0 + (s - 1) * ((TRACK_X1 - TRACK_X0) / 4);

function num(v: string | null, fallback: number): number {
  if (v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildSvg(individual: Record<FactorKey, number>, indLabel: string): string {
  const height = TOP_PAD + FACTOR_DISPLAY_ORDER.length * ROW_HEIGHT + 30;

  const rows = FACTOR_DISPLAY_ORDER.map((f, i) => {
    const y = TOP_PAD + 16 + i * ROW_HEIGHT;
    const avgX = scoreToX(FACTOR_AVERAGE_V1[f]);
    const indX = scoreToX(individual[f]);
    return `<g>
      <text x="${LABEL_X}" y="${y + 6}" text-anchor="end" font-size="13" fill="${COLOR_INK}" font-family="Noto Sans KR">${FACTOR_KR[f]}</text>
      <line x1="${TRACK_X0}" y1="${y}" x2="${TRACK_X1}" y2="${y}" stroke="${COLOR_BORDER}" stroke-width="1"/>
      <line x1="${Math.min(avgX, indX)}" y1="${y}" x2="${Math.max(avgX, indX)}" y2="${y}" stroke="${COLOR_IND}" stroke-width="3" opacity="0.4"/>
      <circle cx="${avgX}" cy="${y}" r="5" fill="${COLOR_AVG}"/>
      <circle cx="${indX}" cy="${y}" r="6" fill="${COLOR_IND}"/>
      <text x="${indX}" y="${y - 10}" text-anchor="middle" font-size="11" font-weight="600" fill="${COLOR_INK}" font-family="Noto Sans KR">${individual[f].toFixed(1)}</text>
    </g>`;
  }).join("");

  const guides = [TRACK_X0, (TRACK_X0 + TRACK_X1) / 2, TRACK_X1]
    .map((x) => `<line x1="${x}" y1="${TOP_PAD}" x2="${x}" y2="${height - 30}" stroke="${COLOR_BORDER}" stroke-width="1" stroke-dasharray="3,3"/>`)
    .join("");

  return `<svg width="700" height="${height}" viewBox="0 0 700 ${height}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="160" cy="10" r="5" fill="${COLOR_AVG}"/>
    <text x="172" y="14" font-size="11" fill="${COLOR_TEXT3}" font-family="Noto Sans KR">15유형 평균</text>
    <circle cx="280" cy="10" r="6" fill="${COLOR_IND}"/>
    <text x="294" y="14" font-size="11" fill="${COLOR_TEXT3}" font-family="Noto Sans KR">${indLabel}</text>
    ${guides}
    ${rows}
    <text x="${TRACK_X0}" y="${height - 10}" text-anchor="middle" font-size="11" fill="${COLOR_TEXT3}" font-family="Noto Sans KR">1점</text>
    <text x="${(TRACK_X0 + TRACK_X1) / 2}" y="${height - 10}" text-anchor="middle" font-size="11" fill="${COLOR_TEXT3}" font-family="Noto Sans KR">3점</text>
    <text x="${TRACK_X1}" y="${height - 10}" text-anchor="middle" font-size="11" fill="${COLOR_TEXT3}" font-family="Noto Sans KR">5점</text>
  </svg>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const individual: Record<FactorKey, number> = {
    job_fit: num(url.searchParams.get("job_fit"), 3),
    partner_fit: num(url.searchParams.get("partner_fit"), 3),
    attachment: num(url.searchParams.get("attachment"), 3),
    boundary: num(url.searchParams.get("boundary"), 3),
    global_worth: num(url.searchParams.get("global_worth"), 3),
    values: num(url.searchParams.get("values"), 3),
    meaning: num(url.searchParams.get("meaning"), 3),
    tension_tol: num(url.searchParams.get("tension_tol"), 3),
    competence_cw: num(url.searchParams.get("competence_cw"), 3),
    approval_cw: num(url.searchParams.get("approval_cw"), 3),
  };
  const indLabel = url.searchParams.get("label") || "나의 점수";

  const svg = buildSvg(individual, indLabel);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1400 }, // 2배 해상도
    font: { fontFiles: [FONT_PATH], loadSystemFonts: false, defaultFontFamily: "Noto Sans KR" },
  });
  const png = resvg.render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
