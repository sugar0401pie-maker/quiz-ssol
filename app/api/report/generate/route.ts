import { NextResponse } from "next/server";
import { startOrGetGeneration } from "@/lib/reportV3/generateOrGet";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-28: gpt-6-sol(reasoning, medium effort)로 전환하면서 생성 시간이 더 늘어날 수
// 있어(Pro 플랜 기준 최대 300초까지 허용) 여유를 크게 둡니다. 그래도 함수가 중간에 죽는
// 경우를 대비해 lib/reportV3/generateOrGet.ts에 "generating" 락 + 오래된 락 무시 로직을 둡니다.
export const maxDuration = 300;

// 2026-09-28: deep-report-prompt-8section-v6.md 반영. 1~8번 섹션 전부를 매번 OpenAI가
// 생성합니다(섹션 1도 이제 AI가 씀 — 더 이상 결제 전 무료 미리보기 없음). 같은 주문
// (order_id)에는 재호출하지 않고 ssol_reports에 저장된 값을 재사용합니다.
// 2026-10-01: 실제 생성 로직(startOrGetGeneration)은 lib/reportV3/generateOrGet.ts로
// 뺐습니다 — app/api/admin/grant-report/route.ts(관리자용 무료 리포트 생성)도 같은 로직을
// 씁니다.

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// 결제 여부 + 리포트 조립 상태 조회.
export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const resultId = new URL(req.url).searchParams.get("resultId");
  if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });

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
  if (!order) return NextResponse.json({ status: "none" });

  const outcome = await startOrGetGeneration(admin, resultId, order.id, user.id);
  if (outcome.status === "failed") return NextResponse.json({ status: "failed" });
  if (outcome.status === "generating") return NextResponse.json({ status: "generating" });
  return NextResponse.json({ status: "ready", assembled: outcome.assembled });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  if (!resultId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = createAdminClient();

  const { data: result, error: resultError } = await admin.from("ssol_quiz_results").select("id, user_id").eq("id", resultId).single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }

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

  const outcome = await startOrGetGeneration(admin, resultId, order.id, user.id);
  if (outcome.status === "failed") return NextResponse.json({ error: "generation failed" }, { status: 500 });
  if (outcome.status === "generating") return NextResponse.json({ status: "generating" });
  return NextResponse.json({ status: "ready", assembled: outcome.assembled });
}
