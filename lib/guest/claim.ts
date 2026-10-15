import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 2026-10-15: 비회원으로 저장·결제한 결과/주문/리포트를 방금 로그인(가입)한 계정으로 옮깁니다.
// - 소유자만 바뀝니다(user_id를 채우고 guest_token_hash를 비움). 내용·결제 상태는 그대로입니다.
// - 비회원으로 결제했다면 이제야 계정이 생겼으니 쏘웰라 1주일 체험권을 이때 지급합니다
//   (결제 확인 라우트는 계정이 없는 주문에는 체험권을 주지 않습니다). order_id가 unique라 여러 번 불려도 안전합니다.
export async function claimGuestRows(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  guestHash: string
): Promise<{ claimed: boolean; results: number; orders: number; error?: string }> {
  const ownerPatch = { user_id: userId, guest_token_hash: null };

  const results = await admin.from("ssol_quiz_results").update(ownerPatch).eq("guest_token_hash", guestHash).is("user_id", null).select("id");
  if (results.error) return { claimed: false, results: 0, orders: 0, error: results.error.message };

  const orders = await admin.from("ssol_orders").update(ownerPatch).eq("guest_token_hash", guestHash).is("user_id", null).select("id, status");
  if (orders.error) return { claimed: false, results: results.data?.length ?? 0, orders: 0, error: orders.error.message };

  const reports = await admin.from("ssol_reports").update(ownerPatch).eq("guest_token_hash", guestHash).is("user_id", null).select("id");
  if (reports.error) console.error("비회원 리포트 소유자 변경 실패:", reports.error.message);

  for (const o of orders.data ?? []) {
    if (o.status !== "paid") continue;
    const { error } = await admin.from("ssol_chat_passes").upsert({ user_id: userId, order_id: o.id }, { onConflict: "order_id", ignoreDuplicates: true });
    if (error) console.error("비회원 결제 건 채팅권 지급 실패:", error.message);
  }

  const nResults = results.data?.length ?? 0;
  const nOrders = orders.data?.length ?? 0;
  return { claimed: nResults + nOrders > 0, results: nResults, orders: nOrders };
}
