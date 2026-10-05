import { NextResponse } from "next/server";
import crypto from "crypto";
import { startOrGetGeneration } from "@/lib/reportV3/generateOrGet";
import { REPORT_PRICE } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

// 2026-10-01: 관리자 전용 — 실제 결제 없이 특정 결과(resultId)에 심층 리포트를 내줍니다
// (데모·QA·지인 테스트 계정처럼 결제 플로우를 거치지 않고 리포트를 보여주고 싶을 때).
// app/api/admin/resend-report-email/route.ts와 같은 인증 방식(서비스 롤 키를 관리자 비밀값으로
// 사용)이고, 생성 로직도 실제 결제 흐름(app/api/report/generate/route.ts)과 완전히 같은
// lib/reportV3/generateOrGet.ts를 씁니다 — 가짜 데이터가 아니라 진짜 AI가 생성한 리포트입니다.
export const maxDuration = 300;

// ssol_orders.amount는 0보다 커야 한다는 체크 제약이 있어(실제 결제 금액 기록용), 관리자
// 지급 주문도 정가를 그대로 기록합니다(app/api/orders/route.ts의 REPORT_PRICE와 동일) —
// 실제로 결제가 일어나는 건 아니고, 이 레코드는 Toss를 거치지 않았다는 점을 status나 별도
// 구분 없이 그냥 "paid" 레코드로 남깁니다(이 엔드포인트 자체가 관리자 비밀값으로만 호출
// 가능하니, 호출 이력 자체가 "관리자가 지급했다"는 근거입니다).

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: { resultId?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("id, user_id, special_key")
    .eq("id", resultId)
    .single();
  if (resultError || !result) return NextResponse.json({ error: "result not found" }, { status: 404 });
  if (result.special_key) return NextResponse.json({ error: "no deep report for special result" }, { status: 400 });

  // 이미 결제 완료된 주문이 있으면 그걸 그대로 씁니다(중복 결제/생성 방지).
  const { data: existingOrder } = await admin
    .from("ssol_orders")
    .select("id")
    .eq("result_id", resultId)
    .eq("status", "paid")
    .eq("report_kind", "solo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let orderId = existingOrder?.id;
  if (!orderId) {
    const { data: order, error: orderError } = await admin
      .from("ssol_orders")
      .insert({
        order_id: `ssol_admingrant_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
        user_id: result.user_id,
        result_id: resultId,
        amount: REPORT_PRICE,
        status: "paid",
        report_kind: "solo",
      })
      .select("id")
      .single();
    if (orderError || !order) {
      console.error("관리자 리포트 지급용 주문 생성 실패:", orderError?.message);
      return NextResponse.json({ error: "order creation failed" }, { status: 500 });
    }
    orderId = order.id;
  }

  const outcome = await startOrGetGeneration(admin, resultId, orderId, result.user_id);
  if (outcome.status === "failed") return NextResponse.json({ error: "generation failed" }, { status: 500 });
  if (outcome.status === "generating") return NextResponse.json({ orderId, status: "generating" });
  return NextResponse.json({ orderId, status: "ready" });
}
