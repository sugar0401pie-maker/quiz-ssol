import { NextResponse } from "next/server";
import { DESSERT, type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportEmailHtml } from "@/lib/reportV3/emailHtml";
import type { GeneratedSectionsV3 } from "@/lib/reportV3/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-28: 심층 리포트 "메일로 보내기" 버튼 — Resend로 발송합니다.
// RESEND_API_KEY가 아직 없으면(설정 전) 501로 명확히 실패를 알립니다 — 조용히 성공한 척하지 않음.
// HTML 조립(레이더 차트 SVG 포함)은 lib/reportV3/emailHtml.ts로 뺐습니다 — 관리자용 재발송
// (app/api/admin/resend-report-email/route.ts)도 같은 걸 씁니다.
const FROM_ADDRESS = "쏠 웰니스 하우스 <report@ssolwellnesshouse.com>";

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
  const html = buildReportEmailHtml(typeCode, confirmedAxis, result.axis_scores, report.assembled as GeneratedSectionsV3);

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
