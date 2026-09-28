import { NextResponse } from "next/server";
import { AXIS_KR, AXIS_ORDER, DESSERT, type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";
import { EUL_REUL } from "@/lib/josa";
import { fmtScore } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-28: 심층 리포트 "메일로 보내기" 버튼 — Resend로 발송합니다.
// RESEND_API_KEY가 아직 없으면(설정 전) 501로 명확히 실패를 알립니다 — 조용히 성공한 척하지 않음.
// v6부터는 섹션 1(웰니스 프로파일)도 AI가 쓰므로 assembled.section1을 그대로 씁니다
// (예전처럼 domainProfile.ts로 따로 조립하지 않음).
const FROM_ADDRESS = "쏠 웰니스 하우스 <report@ssolwellnesshouse.com>";
const SITE_ORIGIN = "https://quiz.ssolwellnesshouse.com";

// 2026-09-28: "메일 상단에 프로필 사진 + 오각형 그래프" 요청 — components/RadarChart.tsx와
// 같은 기하 계산을 그대로 옮기되, 이메일은 CSS 변수/인터랙션을 못 쓰니 라이트모드 색을
// 그대로 하드코딩한 고정 SVG 문자열로 만듭니다.
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

function sectionsToHtml(
  typeCode: TypeCode,
  confirmedAxis: AxisKey,
  axisScores: Record<AxisKey, number>,
  assembled: Record<string, string[]>
) {
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

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string; email?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  const email = body?.email?.trim();
  if (!resultId || !email || !email.includes("@")) {
    return NextResponse.json({ error: "resultId, email required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "email sending not configured" }, { status: 501 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("ssol_orders")
    .select("id")
    .eq("result_id", resultId)
    .eq("user_id", user.id)
    .eq("status", "paid")
    .eq("report_kind", "solo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "payment required" }, { status: 403 });

  const { data: report } = await admin.from("ssol_reports").select("assembled").eq("order_id", order.id).maybeSingle();
  if (!report?.assembled) return NextResponse.json({ error: "report not ready" }, { status: 409 });

  const { data: result } = await admin.from("ssol_quiz_results").select("type_key, axis_scores").eq("id", resultId).single();
  if (!result) return NextResponse.json({ error: "result not found" }, { status: 404 });

  const typeCode = result.type_key as TypeCode;
  const [confirmedAxis] = typeCode.split("-") as [AxisKey, ModeKey];
  const html = sectionsToHtml(typeCode, confirmedAxis, result.axis_scores, report.assembled as Record<string, string[]>);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [email],
      subject: `${DESSERT[typeCode].name} 심층 웰니스 리포트`,
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("리포트 메일 발송 실패:", t);
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
