import { NextResponse } from "next/server";
import { AXIS_KR, DESSERT, type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { EUL_REUL } from "@/lib/josa";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-28: 심층 리포트 "메일로 보내기" 버튼 — Resend로 발송합니다.
// RESEND_API_KEY가 아직 없으면(설정 전) 501로 명확히 실패를 알립니다 — 조용히 성공한 척하지 않음.
// v6부터는 섹션 1(웰니스 프로파일)도 AI가 쓰므로 assembled.section1을 그대로 씁니다
// (예전처럼 domainProfile.ts로 따로 조립하지 않음).
const FROM_ADDRESS = "쏠 웰니스 하우스 <report@ssolwellnesshouse.com>";

function sectionsToHtml(typeCode: TypeCode, confirmedAxis: AxisKey, assembled: Record<string, string[]>) {
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
  let body = `<h1 style="font-size:20px;">${esc(dessert.name)}의 웰니스 이야기</h1>`;
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

  const { data: result } = await admin.from("ssol_quiz_results").select("type_key").eq("id", resultId).single();
  if (!result) return NextResponse.json({ error: "result not found" }, { status: 404 });

  const typeCode = result.type_key as TypeCode;
  const [confirmedAxis] = typeCode.split("-") as [AxisKey, ModeKey];
  const html = sectionsToHtml(typeCode, confirmedAxis, report.assembled as Record<string, string[]>);

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
