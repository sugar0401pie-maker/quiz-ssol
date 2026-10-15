import { NextResponse } from "next/server";
import crypto from "crypto";
import { ownerColumns, ownsRow, resolveOwner } from "@/lib/guest/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WITHDRAWAL_VERSION } from "@/lib/withdrawal";
import { REPORT_PRICE } from "@/lib/pricing"; // 원. 고정 가격 — 반드시 서버에서 정합니다.

// 심층 리포트 결제용 주문 생성. 토스페이먼츠 결제창을 띄우기 직전에 호출합니다.
// v2: 리포트가 결정론적 조립이라 생활영역 태그 선택 단계가 없습니다 — resultId만 있으면 됩니다.
// 2026-10-15: 비회원(로그인 없이 결제) 지원 — 결과의 소유자(계정 또는 이 브라우저의 열쇠)와 주문하는 사람이
// 같아야 합니다. 비회원 주문은 user_id 없이 guest_token_hash로 묶이고, 가입하면 /api/results/claim이 옮깁니다.
// 또 결제 전 "청약철회 제한" 동의(withdrawalAck)가 없으면 주문을 만들지 않습니다(화면의 체크와 별개의 서버 방어선).
export async function POST(req: Request) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string; reportKind?: "solo" | "relationship"; friendTypeCode?: string; withdrawalAck?: boolean } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  if (!resultId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (body?.withdrawalAck !== true) return NextResponse.json({ error: "withdrawal notice required" }, { status: 400 });
  const reportKind = body?.reportKind === "relationship" ? "relationship" : "solo";
  const friendTypeCode = reportKind === "relationship" ? body?.friendTypeCode ?? null : null;
  if (reportKind === "relationship" && !friendTypeCode) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // 관계성 리포트는 로그인한 사용자만 살 수 있습니다(비회원 결제는 개인 리포트만).
  if (reportKind === "relationship" && owner.kind === "guest") {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select(owner.kind === "guest" ? "id, user_id, guest_token_hash, special_key" : "id, user_id, special_key")
    .eq("id", resultId)
    .single();
  const resultRow = result as unknown as { id: string; user_id: string | null; guest_token_hash?: string | null; special_key: string | null } | null;
  if (resultError || !resultRow || !ownsRow(owner, resultRow)) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }
  // 2026-09-29: 이스터에그 히든 결과(초슈퍼울트라짱/비스코티)는 심층 리포트가 없습니다 —
  // 결제 자체가 시작되지 않도록 서버에서 막습니다(화면에 CTA가 없는 것과 별개의 방어선).
  if (resultRow.special_key) {
    return NextResponse.json({ error: "no deep report for special result" }, { status: 400 });
  }

  // 토스 orderId 규칙: 영문 대소문자/숫자/-_=, 6~64자.
  const orderId = `ssol_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

  const baseRow: Record<string, unknown> = {
    order_id: orderId,
    ...ownerColumns(owner),
    result_id: resultId,
    amount: REPORT_PRICE,
    status: "pending",
    report_kind: reportKind,
    friend_type_code: friendTypeCode,
  };
  let { data: order, error } = await admin
    .from("ssol_orders")
    .insert({ ...baseRow, withdrawal_notice_at: new Date().toISOString(), withdrawal_notice_version: WITHDRAWAL_VERSION })
    .select("order_id, amount")
    .single();
  // 동의 기록 칸을 만드는 SQL을 아직 실행하기 전이면 칸 없이 주문을 만듭니다(결제가 막히지 않게).
  if (error && /withdrawal_notice/.test(error.message)) {
    ({ data: order, error } = await admin.from("ssol_orders").insert(baseRow).select("order_id, amount").single());
  }
  if (error || !order) {
    console.error("주문 생성 실패:", error?.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ orderId: order.order_id, amount: order.amount });
}
