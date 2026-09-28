import { NextResponse } from "next/server";
import { type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportV3Input } from "@/lib/reportV3/buildInput";
import { generateReportV3 } from "@/lib/reportV3/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-28: 이제 매 요청마다 OpenAI를 호출해서 응답이 예전보다 오래 걸릴 수 있어(재시도 포함
// 최대 20~30초 안팎), 기본 제한(플랫폼별 10초)보다 여유를 둡니다.
export const maxDuration = 60;

// 2026-09-28: v3 인계서(system_prompt_v3.md·base-knowledge-15types_v3·server_logic_v3.py)
// 반영. 2~8번 섹션은 매번 OpenAI가 생성합니다(대표 시나리오 템플릿을 그대로 서빙하던 이전
// 방식은 폐기 — base_knowledge가 이제 완성된 리포트가 아니라 짧은 원재료라 AI 없이는 리포트가
// 나올 수 없습니다). 1번(웰니스 프로파일)은 여전히 결정론적 조립(lib/reportV3/domainProfile.ts)
// 이라 무료로 즉시 제공됩니다. 같은 주문(order_id)에는 재호출하지 않고 ssol_reports에 저장된
// 값을 재사용합니다.

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function assembleAndStore(admin: ReturnType<typeof createAdminClient>, resultId: string, orderId: string, userId: string) {
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("type_key, axis_scores, factor_scores, sub_scores, mode_scores, part1_answers, part2_answers")
    .eq("id", resultId)
    .single();
  if (resultError || !result) return null;

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
    return null;
  }

  const assembled = {
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
    .upsert({ order_id: orderId, result_id: resultId, user_id: userId, status: "ready", assembled, ready_at: new Date().toISOString() }, { onConflict: "order_id" })
    .select("assembled")
    .single();
  if (saveError) {
    console.error("리포트 저장 실패:", saveError.message);
    return null;
  }
  return saved.assembled;
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

  const { data: report } = await admin.from("ssol_reports").select("status, assembled").eq("order_id", order.id).maybeSingle();
  if (report?.assembled) return NextResponse.json({ status: "ready", assembled: report.assembled });

  // 결제는 됐지만 아직 조립된 적이 없는 경우 — 바로 조립해서 반환합니다(비용도 지연도 없으니
  // 기다릴 이유가 없습니다).
  const assembled = await assembleAndStore(admin, resultId, order.id, user.id);
  if (!assembled) return NextResponse.json({ status: "paid_needs_generation" });
  return NextResponse.json({ status: "ready", assembled });
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

  const { data: existing } = await admin.from("ssol_reports").select("assembled").eq("order_id", order.id).maybeSingle();
  if (existing?.assembled) return NextResponse.json({ status: "ready", assembled: existing.assembled });

  const assembled = await assembleAndStore(admin, resultId, order.id, user.id);
  if (!assembled) return NextResponse.json({ error: "generation failed" }, { status: 500 });
  return NextResponse.json({ status: "ready", assembled });
}
