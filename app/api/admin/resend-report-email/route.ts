import { NextResponse } from "next/server";
import { DESSERT, GENDER_TITLE, type AxisKey, type Gender, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportEmailHtml } from "@/lib/reportV3/emailHtml";
import type { GeneratedSectionsV3 } from "@/lib/reportV3/types";
import { createAdminClient } from "@/lib/supabase/admin";

// 2026-09-29: 관리자 전용 — 이미 결제 완료된 주문의 심층 리포트를 다시 메일로 보냅니다.
// 프롬프트/조립 로직이 바뀌어 기존 결제자의 ssol_reports.assembled를 새로 만든 뒤, 그 결과를
// 다시 보내주고 싶을 때 씁니다(고객 로그인 세션이 없어도 되도록 만든 관리자용 엔드포인트라,
// 일반 로그인 인증 대신 서비스 롤 키를 그대로 관리자 비밀값으로 씁니다 — 이 값은 본인과
// 서버만 압니다).
export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: { orderId?: string; email?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const orderId = body?.orderId;
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "email sending not configured" }, { status: 501 });

  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("ssol_orders")
    .select("id, user_id, result_id, report_kind, status")
    .eq("id", orderId)
    .single();
  if (orderError || !order || order.status !== "paid" || order.report_kind !== "solo") {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  const { data: report } = await admin.from("ssol_reports").select("assembled").eq("order_id", orderId).maybeSingle();
  if (!report?.assembled) return NextResponse.json({ error: "report not ready" }, { status: 409 });

  const { data: result } = await admin
    .from("ssol_quiz_results")
    .select("type_key, axis_scores, factor_scores, user_name, gender")
    .eq("id", order.result_id)
    .single();
  if (!result) return NextResponse.json({ error: "result not found" }, { status: 404 });

  let email = body?.email?.trim();
  if (!email) {
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(order.user_id);
    if (authError || !authUser?.user?.email) return NextResponse.json({ error: "email not found for user" }, { status: 404 });
    email = authUser.user.email;
  }

  const typeCode = result.type_key as TypeCode;
  const [confirmedAxis] = typeCode.split("-") as [AxisKey, ModeKey];
  const title = result.gender ? GENDER_TITLE[result.gender as Gender] : "";
  const html = buildReportEmailHtml(
    typeCode,
    confirmedAxis,
    result.axis_scores,
    result.factor_scores,
    result.user_name,
    title,
    report.assembled as GeneratedSectionsV3
  );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "쏠 웰니스 하우스 <report@ssolwellnesshouse.com>",
      to: [email],
      subject: `${DESSERT[typeCode].name} 심층 웰니스 리포트`,
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("관리자 재발송 실패:", t);
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, email });
}
