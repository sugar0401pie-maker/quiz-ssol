import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 개발자 전용 임시 엔드포인트 — 토스페이먼츠 결제 연동 전까지, 결제를 건너뛰고
// "결제 완료" 상태의 주문을 만들어 심층 리포트 생성 파이프라인을 테스트하기 위한 것입니다.
// TODO: 배포 전 제거 예정. 실제로는 토스페이먼츠 결제 승인(/api/payments/confirm 등)이
// 성공했을 때만 이런 주문이 생겨야 합니다.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

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
  if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });
  const reportKind = body?.reportKind === "relationship" ? "relationship" : "solo";
  const friendTypeCode = reportKind === "relationship" ? body?.friendTypeCode ?? null : null;

  const admin = createAdminClient();
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("id, user_id")
    .eq("id", resultId)
    .single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }

  const { data: order, error } = await admin
    .from("ssol_orders")
    .insert({
      order_id: `dev_test_${Date.now()}`,
      user_id: user.id,
      result_id: resultId,
      amount: 3500,
      status: "paid",
      paid_at: new Date().toISOString(),
      report_kind: reportKind,
      friend_type_code: friendTypeCode,
    })
    .select("id")
    .single();
  if (error) {
    console.error("dev test order failed:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  // 실제 결제(/api/payments/confirm)와 동일하게, 테스트 주문에도 채팅권을 발급합니다.
  const { error: passError } = await admin
    .from("ssol_chat_passes")
    .upsert({ user_id: user.id, order_id: order.id }, { onConflict: "order_id", ignoreDuplicates: true });
  if (passError) console.error("채팅권 발급 실패:", passError.message);

  return NextResponse.json({ orderId: order.id });
}
