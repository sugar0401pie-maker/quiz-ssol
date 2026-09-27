import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 토스페이먼츠 successUrl. 결제창에서 결제를 마치면 이 주소로 돌아옵니다
// (paymentKey, orderId, amount 가 쿼리로 붙어서 옵니다).
// 결제·로그인처럼 외부 사이트를 오가는 흐름이라 화면 상태(QuizContext)는 여기서 복원하지 않고,
// /auth/finish 로 넘겨서 그쪽에서 한 번에 복원합니다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const paymentKey = url.searchParams.get("paymentKey");
  const orderId = url.searchParams.get("orderId");
  const amount = Number(url.searchParams.get("amount"));

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.redirect(new URL("/auth/finish", origin));
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("ssol_orders").select("*").eq("order_id", orderId).single();

  if (!order || order.amount !== amount) {
    console.error("결제 승인 거부: 주문을 찾을 수 없거나 금액이 다릅니다.", orderId, amount);
    return NextResponse.redirect(new URL("/auth/finish", origin));
  }

  // 이미 승인 처리된 주문이면(새로고침 등으로 이 주소에 다시 온 경우) 다시 승인 요청하지 않습니다.
  if (order.status === "paid") {
    return NextResponse.redirect(new URL("/auth/finish", origin));
  }
  if (order.status !== "pending") {
    return NextResponse.redirect(new URL("/auth/finish", origin));
  }

  try {
    const auth = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error("토스 결제 승인 실패:", res.status, body);
      await admin.from("ssol_orders").update({ status: "failed" }).eq("id", order.id);
      return NextResponse.redirect(new URL("/auth/finish", origin));
    }

    await admin
      .from("ssol_orders")
      .update({ status: "paid", toss_payment_key: paymentKey, paid_at: new Date().toISOString() })
      .eq("id", order.id);

    // 결제 성공 시 1주일 AI 채팅권 발급 (schema.sql 6)번 흐름 예시대로).
    // order_id는 ssol_chat_passes에 unique라 혹시 중복 호출돼도 안전합니다.
    const { error: passError } = await admin
      .from("ssol_chat_passes")
      .upsert({ user_id: order.user_id, order_id: order.id }, { onConflict: "order_id", ignoreDuplicates: true });
    if (passError) console.error("채팅권 발급 실패:", passError.message);
  } catch (err) {
    console.error("결제 승인 처리 중 오류:", err instanceof Error ? err.message : err);
    await admin.from("ssol_orders").update({ status: "failed" }).eq("id", order.id);
  }

  return NextResponse.redirect(new URL("/auth/finish", origin));
}
