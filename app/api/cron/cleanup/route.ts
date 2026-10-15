import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 2026-10-15: 비회원(로그인 없이 저장)으로 남은 결과 중, 결제도 가입(소유자 이동)도 없이 30일이 지난 것을 지웁니다
// (개인정보 최소 보관). 결제 기록이 있는 결과는 지우지 않습니다 — 전자상거래법상 결제 기록 보존 때문에
// ssol_orders가 결과를 참조하고 있어 애초에 지울 수도 없습니다.
// Vercel Cron(vercel.json)이 매일 부르며, Vercel 환경변수 CRON_SECRET이 설정돼 있어야 동작합니다(없으면 항상 401).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    // configured: 환경변수 CRON_SECRET이 이 배포에 들어가 있는지만 알려줍니다(값은 절대 노출하지 않음) — 설정 확인용.
    return NextResponse.json({ error: "unauthorized", configured: !!secret }, { status: 401 });
  }
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 3600e3).toISOString();

  const { data: stale, error } = await admin
    .from("ssol_quiz_results")
    .select("id")
    .is("user_id", null)
    .not("guest_token_hash", "is", null)
    .lt("created_at", cutoff)
    .limit(500);
  if (error) {
    console.error("비회원 결과 정리 조회 실패:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  const ids = (stale ?? []).map((r) => r.id);
  if (ids.length === 0) return NextResponse.json({ deleted: 0 });

  // 주문이 걸린 결과는 제외.
  const { data: ordered } = await admin.from("ssol_orders").select("result_id").in("result_id", ids);
  const keep = new Set((ordered ?? []).map((o) => o.result_id));
  const toDelete = ids.filter((id) => !keep.has(id));
  if (toDelete.length === 0) return NextResponse.json({ deleted: 0 });

  const { error: delError } = await admin.from("ssol_quiz_results").delete().in("id", toDelete);
  if (delError) {
    console.error("비회원 결과 정리 삭제 실패:", delError.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ deleted: toDelete.length });
}
