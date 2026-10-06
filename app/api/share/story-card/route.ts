import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { DESSERT, DESSERT_FAMILY, TYPE_LINE2, type AxisKey, type TypeCode } from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";

// 2026-10-05: 인스타그램 스토리용 세로 결과 카드(1080×1920 PNG). 공유 창(components/ShareSheet.tsx)에
// 이미지 파일로 넘겨서, 인스타그램 스토리·피드에 올릴 때 바로 쓸 수 있게 합니다.
// radar-image/route.ts와 같은 방식(SVG 문자열 → resvg로 PNG, 서버리스에서 한글이 그려지도록 폰트 파일을
// 직접 등록)을 씁니다. 개인정보(닉네임 등)는 넣지 않고 유형 정보만 담아서 누구나 같은 카드를 받습니다
// — 그래서 유형별 15가지뿐이고 오래 캐싱해도 됩니다.
//
// 문구는 카카오톡 공유 문구("저는 ○○ 유형이에요. 당신은 어떤 유형일까요?")와 같은 메시지로 맞췄습니다.
//
// 인스타그램 스토리는 위쪽 약 250px(프로필·진행바)과 아래쪽 약 250px(답장창)을 앱이 가립니다 —
// 중요한 내용은 그 사이(y 250~1670)에만 둡니다.
export const runtime = "nodejs";

const FONT_PATH = path.join(process.cwd(), "lib/fonts/NotoSansKR-Medium.ttf");
const W = 1080;
const H = 1920;

// app/globals.css 라이트 모드 토큰 값(이미지엔 CSS 변수가 안 통해서 직접 적음).
const COLOR_BG = "#fff7ec";
const COLOR_BG_DEEP = "#fde8dc";
const COLOR_ACCENT = "#d9748a";
const COLOR_INK = "#4a2c2a";
const COLOR_INK_SOFT = "#7a5a45";
const COLOR_BORDER = "#f0dfc8";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 한 줄이 maxChars를 넘지 않게, 가능하면 띄어쓰기에서 끊어 여러 줄로 나눕니다.
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    const cut = rest.lastIndexOf(" ", maxChars);
    const at = cut > maxChars * 0.5 ? cut : maxChars;
    lines.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) lines.push(rest);
  return lines;
}

function buildSvg(typeCode: TypeCode, imageDataUri: string): string {
  const dessert = DESSERT[typeCode];
  const axis = typeCode.split("-")[0] as AxisKey;
  const family = DESSERT_FAMILY[axis].name;
  const nameSize = dessert.name.length > 9 ? 82 : 96;
  const lineTexts = wrap(TYPE_LINE2[typeCode], 22); // 가장 긴 설명(37자)도 두 줄에 들어오게(세 줄이면 아래 버튼과 겹침)
  const lines = lineTexts
    .map((t, i) => `<text x="${W / 2}" y="${1390 + i * 58}" text-anchor="middle" font-size="40" fill="${COLOR_INK_SOFT}" font-family="Noto Sans KR">${esc(t)}</text>`)
    .join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${COLOR_BG}"/>
      <stop offset="1" stop-color="${COLOR_BG_DEEP}"/>
    </linearGradient>
    <clipPath id="photo"><rect x="190" y="440" width="700" height="700" rx="60"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1000" cy="180" r="260" fill="${COLOR_ACCENT}" opacity="0.08"/>
  <circle cx="60" cy="1760" r="320" fill="${COLOR_ACCENT}" opacity="0.07"/>

  <text x="${W / 2}" y="320" text-anchor="middle" font-size="38" letter-spacing="6" fill="${COLOR_ACCENT}" font-family="Noto Sans KR">쏠 웰니스 하우스</text>
  <text x="${W / 2}" y="395" text-anchor="middle" font-size="46" fill="${COLOR_INK_SOFT}" font-family="Noto Sans KR">저는 이 유형이에요</text>

  <rect x="182" y="432" width="716" height="716" rx="66" fill="#ffffff" stroke="${COLOR_BORDER}" stroke-width="4"/>
  <image href="${imageDataUri}" x="190" y="440" width="700" height="700" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>

  <text x="${W / 2}" y="1262" text-anchor="middle" font-size="${nameSize}" fill="${COLOR_INK}" font-family="Noto Sans KR">${esc(dessert.name)}</text>
  <text x="${W / 2}" y="1327" text-anchor="middle" font-size="38" fill="${COLOR_ACCENT}" font-family="Noto Sans KR">${esc(family)}</text>
  ${lines}

  <rect x="190" y="1520" width="700" height="130" rx="65" fill="${COLOR_ACCENT}"/>
  <text x="${W / 2}" y="1582" text-anchor="middle" font-size="46" fill="#ffffff" font-family="Noto Sans KR">당신은 어떤 유형일까요?</text>
  <text x="${W / 2}" y="1627" text-anchor="middle" font-size="30" fill="#ffffff" opacity="0.9" font-family="Noto Sans KR">quiz.ssolwellnesshouse.com</text>
</svg>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  if (!(type in DESSERT)) return new Response("unknown type", { status: 400 });
  const typeCode = type as TypeCode;

  // 캐릭터 이미지는 사이트의 정적 파일(public/images/profiles)을 같은 주소에서 받아 SVG에 박습니다.
  const imgRes = await fetch(`${url.origin}/images/profiles/profile-${resolveIconKey(DESSERT[typeCode].icon)}.jpg`);
  if (!imgRes.ok) return new Response("image not found", { status: 502 });
  const imageDataUri = `data:image/jpeg;base64,${Buffer.from(await imgRes.arrayBuffer()).toString("base64")}`;

  const resvg = new Resvg(buildSvg(typeCode, imageDataUri), {
    fitTo: { mode: "width", value: W },
    font: { fontFiles: [FONT_PATH], loadSystemFonts: false, defaultFontFamily: "Noto Sans KR" },
  });
  const png = resvg.render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
