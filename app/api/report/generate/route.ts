import { NextResponse } from "next/server";
import { type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportV3Input } from "@/lib/reportV3/buildInput";
import { generateReportV3 } from "@/lib/reportV3/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-28: gpt-6-sol(reasoning, medium effort)로 전환하면서 생성 시간이 더 늘어날 수
// 있어(Pro 플랜 기준 최대 300초까지 허용) 여유를 크게 둡니다. 그래도 함수가 중간에 죽는
// 경우를 대비해 아래에 "generating" 락 + 오래된 락 무시 로직을 둡니다.
export const maxDuration = 300;
const STALE_GENERATION_MS = 90_000; // 이보다 오래 'generating' 상태면 이전 시도가 죽은 것으로 보고 재시도

// 2026-09-28: deep-report-prompt-8section-v6.md 반영. 1~8번 섹션 전부를 매번 OpenAI가
// 생성합니다(섹션 1도 이제 AI가 씀 — 더 이상 결제 전 무료 미리보기 없음). 같은 주문
// (order_id)에는 재호출하지 않고 ssol_reports에 저장된 값을 재사용합니다.

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

type GenerationOutcome =
  | { status: "ready"; assembled: unknown }
  | { status: "generating" }
  | { status: "failed" };

// 2026-09-28: gpt-6-sol 전환 후 생성 시간이 늘어나 "이미 생성 중"인지 락으로 확인합니다.
// - 리포트 행이 없거나, 'generating'인데 STALE_GENERATION_MS보다 오래됐으면(이전 시도가 죽은
//   것으로 판단) 이번 요청이 새로 락을 걸고 OpenAI를 호출합니다.
// - 이미 최근에 'generating' 락이 걸려있으면(다른 탭/폴링 중인 요청이 진행 중) 이번 요청은
//   OpenAI를 다시 부르지 않고 그냥 "generating"만 반환합니다 — 클라이언트는 몇 초 후 다시 폴링.
async function startOrGetGeneration(
  admin: ReturnType<typeof createAdminClient>,
  resultId: string,
  orderId: string,
  userId: string
): Promise<GenerationOutcome> {
  const { data: existing } = await admin
    .from("ssol_reports")
    .select("status, assembled, created_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing?.assembled) return { status: "ready", assembled: existing.assembled };

  const isFreshLock = existing?.status === "generating" && Date.now() - new Date(existing.created_at).getTime() < STALE_GENERATION_MS;
  if (isFreshLock) return { status: "generating" };

  // 이번 요청이 락을 겁니다(락 없음/오래된 락/이전 실패 전부 이 경로).
  const { error: lockError } = await admin
    .from("ssol_reports")
    .upsert({ order_id: orderId, result_id: resultId, user_id: userId, status: "generating", created_at: new Date().toISOString(), assembled: null }, { onConflict: "order_id" });
  if (lockError) {
    console.error("리포트 락 설정 실패:", lockError.message);
    return { status: "failed" };
  }

  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("type_key, axis_scores, factor_scores, sub_scores, mode_scores, part1_answers, part2_answers")
    .eq("id", resultId)
    .single();
  if (resultError || !result) {
    await admin.from("ssol_reports").update({ status: "failed" }).eq("order_id", orderId);
    return { status: "failed" };
  }

  const typeCode = result.type_key as TypeCode;
  const [confirmedAxis, confirmedMode] = typeCode.split("-") as [AxisKey, ModeKey];

  const input = buildReportV3Input({
    axis: confirmedAxis,
    mode: confirmedMode,
    axisScores: result.axis_scores,
    factorScores: result.factor_scores,
    modeScores: result.mode_scores,
    copingSubScores: result.sub_scores,
    part1Answers: result.part1_answers,
    part2Answers: result.part2_answers,
  });

  let sections;
  try {
    sections = await generateReportV3(input);
  } catch (err) {
    console.error("v3 리포트 생성 실패:", err instanceof Error ? err.message : err);
    await admin.from("ssol_reports").update({ status: "failed" }).eq("order_id", orderId);
    return { status: "failed" };
  }

  const assembled = {
    section1: sections.section1,
    section2: sections.section2,
    section3: sections.section3,
    section4: sections.section4,
    section5: sections.section5,
    section6: sections.section6,
    section7: sections.section7,
    section8: sections.section8,
  };

  const { data: saved, error: saveError } = await admin
    .from("ssol_reports")
    .update({ status: "ready", assembled, ready_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .select("assembled")
    .single();
  if (saveError) {
    console.error("리포트 저장 실패:", saveError.message);
    return { status: "failed" };
  }
  return { status: "ready", assembled: saved.assembled };
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
