import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { REPORT_PRICE } from "@/lib/pricing"; // 원. 고정 가격 — 반드시 서버에서 정합니다.

// 심층 리포트 결제용 주문 생성. 토스페이먼츠 결제창을 띄우기 직전에 호출합니다.
// v2: 리포트가 결정론적 조립이라 생활영역 태그 선택 단계가 없습니다 — resultId만 있으면 됩니다.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string; reportKind?: "solo" | "relationship"; friendTypeCode?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  if (!resultId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const reportKind = body?.reportKind === "relationship" ? "relationship" : "solo";
  const friendTypeCode = reportKind === "relationship" ? body?.friendTypeCode ?? null : null;
  if (reportKind === "relationship" && !friendTypeCode) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("id, user_id, special_key")
    .eq("id", resultId)
    .single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }
  // 2026-09-29: 이스터에그 히든 결과(초슈퍼울트라짱/비스코티)는 심층 리포트가 없습니다 —
  // 결제 자체가 시작되지 않도록 서버에서 막습니다(화면에 CTA가 없는 것과 별개의 방어선).
  if (result.special_key) {
    return NextResponse.json({ error: "no deep report for special result" }, { status: 400 });
  }

  // 토스 orderId 규칙: 영문 대소문자/숫자/-_=, 6~64자.
  const orderId = `ssol_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

  const { data: order, error } = await admin
    .from("ssol_orders")
    .insert({
      order_id: orderId,
      user_id: user.id,
      result_id: resultId,
      amount: REPORT_PRICE,
      status: "pending",
      report_kind: reportKind,
      friend_type_code: friendTypeCode,
    })
    .select("order_id, amount")
    .single();
  if (error) {
    console.error("주문 생성 실패:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ orderId: order.order_id, amount: order.amount });
}
