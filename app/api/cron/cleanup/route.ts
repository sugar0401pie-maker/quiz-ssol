import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 2026-10-15: 비회원(로그인 없이 저장)으로 남은 데이터를 보관 기간이 지나면 정리합니다(개인정보 최소 보관).
// 2026-10-16: 보관 기간 확정 — 결제 안 한 결과 30일, 결제한 결과·리포트 내용 3년(약관 제5조·개인정보처리방침 5번과 같은 값).
//   1) 30일: 가입도 결제도 없이 30일 지난 비회원 결과를 지웁니다. 결제 전에 멈춘 주문(pending/failed)은 결제 기록이 아니므로
//      함께 지웁니다. 결제가 있었던 주문(paid/canceled/refunded)이 걸린 결과는 여기서 지우지 않습니다.
//   2) 3년: 결제가 있었던 비회원 주문이 3년 지나면 리포트 내용을 지우고, 결과 행은 응답·점수를 비웁니다. 주문 행(결제 기록)은
//      전자상거래법상 5년 보존이라 남기되, 비회원 열쇠(guest_token_hash)를 되찾을 수 없는 무작위 표식("purged-…")으로 바꿔 이후엔
//      누구도 이 결과를 되찾을 수 없게 합니다(주문은 계정 또는 열쇠가 있어야 한다는 DB 제약 때문에 비우지 못하고 표식으로 대체).
//      (주문이 결과를 참조하고 있어 결과 행 자체는 지울 수 없어서 내용만 비웁니다.)
// Vercel Cron(vercel.json)이 매일 부르며, Vercel 환경변수 CRON_SECRET이 설정돼 있어야 동작합니다(없으면 항상 401).
const DAY = 24 * 3600e3;
const PAID_LIKE = ["paid", "canceled", "refunded"]; // 실제 결제가 있었던 주문 상태 — 결제 기록으로 보존
const BATCH = 200;
const PURGED_PREFIX = "purged-";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    // configured: 환경변수 CRON_SECRET이 이 배포에 들어가 있는지만 알려줍니다(값은 절대 노출하지 않음) — 설정 확인용.
    return NextResponse.json({ error: "unauthorized", configured: !!secret }, { status: 401 });
  }
  const admin = createAdminClient();
  const now = Date.now();
  const out = { deletedUnpaid: 0, purgedPaid: 0 };

  // ---- 1) 30일 지난 미결제 비회원 결과
  const { data: stale, error } = await admin
    .from("ssol_quiz_results")
    .select("id")
    .is("user_id", null)
    .not("guest_token_hash", "is", null)
    .lt("created_at", new Date(now - 30 * DAY).toISOString())
    .limit(BATCH);
  if (error) {
    console.error("비회원 결과 정리 조회 실패:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  const ids = (stale ?? []).map((r) => r.id);
  if (ids.length > 0) {
    const { data: ordered } = await admin.from("ssol_orders").select("id, result_id, status").in("result_id", ids);
    const keep = new Set((ordered ?? []).filter((o) => PAID_LIKE.includes(o.status)).map((o) => o.result_id));
    const toDelete = ids.filter((id) => !keep.has(id));
    if (toDelete.length > 0) {
      // 결제 전에 멈춘 주문부터(결과를 참조하고 있어서) — 이 주문들은 결제 기록이 아닙니다.
      const { error: ordErr } = await admin.from("ssol_orders").delete().in("result_id", toDelete).in("status", ["pending", "failed"]);
      if (ordErr) {
        console.error("비회원 미결제 주문 정리 실패:", ordErr.message);
        return NextResponse.json({ error: "failed" }, { status: 500 });
      }
      const { error: delError } = await admin.from("ssol_quiz_results").delete().in("id", toDelete);
      if (delError) {
        console.error("비회원 결과 정리 삭제 실패:", delError.message);
        return NextResponse.json({ error: "failed" }, { status: 500 });
      }
      out.deletedUnpaid = toDelete.length;
    }
  }

  // ---- 2) 결제한 지 3년 지난 비회원 결제 건: 리포트·응답 내용 비우기
  const { data: oldOrders, error: oldErr } = await admin
    .from("ssol_orders")
    .select("id, result_id")
    .is("user_id", null)
    .not("guest_token_hash", "is", null)
    .not("guest_token_hash", "like", `${PURGED_PREFIX}%`) // 이미 정리한 건은 다시 고르지 않음
    .in("status", PAID_LIKE)
    .lt("created_at", new Date(now - 3 * 365 * DAY).toISOString())
    .limit(BATCH);
  if (oldErr) {
    console.error("비회원 3년 경과 주문 조회 실패:", oldErr.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  for (const o of oldOrders ?? []) {
    const { error: repErr } = await admin.from("ssol_reports").delete().eq("order_id", o.id);
    if (repErr) {
      console.error("비회원 리포트 삭제 실패:", repErr.message);
      continue;
    }
    const { error: resErr } = await admin
      .from("ssol_quiz_results")
      .update({
        user_name: "삭제됨",
        part1_answers: {},
        part2_answers: {},
        axis_scores: {},
        factor_scores: {},
        sub_scores: {},
        mode_scores: {},
        guest_token_hash: null,
      })
      .eq("id", o.result_id);
    if (resErr) {
      console.error("비회원 결과 내용 비우기 실패:", resErr.message);
      continue;
    }
    // 마지막에 주문의 열쇠를 무작위 표식으로 바꿔(되찾기 불가) 다음 실행에서 다시 고르지 않게 합니다. 주문 행 자체(결제 기록)는 남깁니다.
    const { error: keyErr } = await admin
      .from("ssol_orders")
      .update({ guest_token_hash: `${PURGED_PREFIX}${crypto.randomBytes(16).toString("hex")}` })
      .eq("id", o.id);
    if (keyErr) console.error("비회원 주문 열쇠 제거 실패:", keyErr.message);
    else out.purgedPaid += 1;
  }

  return NextResponse.json({ deleted: out.deletedUnpaid, ...out });
}
