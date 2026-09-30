import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { AXIS_KR, AXIS_ORDER, type AxisKey } from "@/lib/data";
import { RADAR_CX, RADAR_CY, RADAR_H, RADAR_MAX_R, RADAR_MAX_SCORE, RADAR_W, radarPointAt } from "@/lib/radarGeometry";

// 2026-09-29: 이메일 안 오각형 그래프가 안 보이는 문제 — 이메일 클라이언트(특히 Gmail)가
// 인라인 <svg> 마크업을 잘라내거나 렌더링하지 않아서, 그동안 그래프 대신 점수 텍스트 줄만
// 보였습니다. 같은 기하 계산으로 SVG 문자열을 만들고(components/RadarChart.tsx와 동일),
// resvg로 실제 PNG로 구워서 <img>로 넣으면 이메일에서도 보입니다.
// (처음엔 next/og의 ImageResponse로 시도했는데, JSX로 그린 <polygon>/<circle>/<text>가
// 빈 이미지(content-length 0)를 냈습니다 — resvg가 훨씬 안전한 선택입니다.)
// 2026-09-29: resvg는 서버리스 환경의 시스템 폰트에 기대지 않습니다(한글이 아예 안 그려짐) —
// lib/fonts/NotoSansKR-Medium.ttf(Google Fonts 공식 파일, 사이트에서 쓰는 것과 같은 폰트)를
// 직접 읽어 등록합니다.
export const runtime = "nodejs";

const FONT_PATH = path.join(process.cwd(), "lib/fonts/NotoSansKR-Medium.ttf");

// 2026-09-30: 파라미터가 아예 없으면(v === null) `Number(null)`이 0이라 Number.isFinite도
// true를 반환해서, fallback이 "숫자가 아닌 값"일 때만 걸리고 "값 자체가 없음"일 때는
// 안 걸리는 버그가 있었습니다(그래프 한 점이 중심으로 붕괴).
function num(v: string | null, fallback: number): number {
  if (v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildRadarSvg(scores: Record<AxisKey, number>): string {
  const dataPts = AXIS_ORDER.map((d, i) =>
    radarPointAt(i, (Math.max(0, Math.min(scores[d], RADAR_MAX_SCORE)) / RADAR_MAX_SCORE) * RADAR_MAX_R)
  );

  const rings = [0.34, 0.67, 1]
    .map((level) => `<polygon points="${AXIS_ORDER.map((_, i) => radarPointAt(i, RADAR_MAX_R * level).join(",")).join(" ")}" fill="none" stroke="#f0dfc8" stroke-width="1"/>`)
    .join("");
  const spokes = AXIS_ORDER.map((_, i) => {
    const p = radarPointAt(i, RADAR_MAX_R);
    return `<line x1="${RADAR_CX}" y1="${RADAR_CY}" x2="${p[0]}" y2="${p[1]}" stroke="#f0dfc8" stroke-width="1"/>`;
  }).join("");
  const shape = `<polygon points="${dataPts.map((p) => p.join(",")).join(" ")}" fill="#d9748a" fill-opacity="0.18" stroke="#d9748a" stroke-width="2"/>`;
  const dots = dataPts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="#d9748a"/>`).join("");
  const labels = AXIS_ORDER.map((d, i) => {
    const p = radarPointAt(i, RADAR_MAX_R + 18);
    const anchor = p[0] < RADAR_CX - 8 ? "end" : p[0] > RADAR_CX + 8 ? "start" : "middle";
    return `<text x="${p[0]}" y="${p[1]}" text-anchor="${anchor}" dominant-baseline="middle" font-size="12" fill="#8a6f5c" font-family="Noto Sans KR">${AXIS_KR[d]}</text>`;
  }).join("");

  return `<svg width="${RADAR_W}" height="${RADAR_H}" viewBox="0 0 ${RADAR_W} ${RADAR_H}" xmlns="http://www.w3.org/2000/svg">${rings}${spokes}${shape}${dots}${labels}</svg>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scores: Record<AxisKey, number> = {
    CAR: num(url.searchParams.get("CAR"), 3),
    LOV: num(url.searchParams.get("LOV"), 3),
    REL: num(url.searchParams.get("REL"), 3),
    SLF: num(url.searchParams.get("SLF"), 3),
    DIR: num(url.searchParams.get("DIR"), 3),
  };

  const svg = buildRadarSvg(scores);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 590 }, // 2배 해상도로 렌더링(레티나 대비)
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
