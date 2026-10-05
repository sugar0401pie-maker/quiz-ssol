import "server-only";
import { type AxisKey, type ModeKey, type TypeCode } from "../data";
import { createAdminClient } from "../supabase/admin";
import { buildReportV3Input } from "./buildInput";
import { generateReportV3 } from "./generate";
import { assembleSection1 } from "./sectionOneAssembler";

// 2026-10-01: app/api/report/generate/route.ts에 있던 걸 공용 파일로 뺐습니다 —
// app/api/admin/grant-report/route.ts(관리자용 무료 리포트 생성, 결제 없이 테스트/데모 계정에
// 리포트를 내주고 싶을 때)도 같은 생성 로직을 써야 해서 중복 없이 공유합니다.
//
// 2026-09-28: gpt-6-sol(reasoning, medium effort)로 전환하면서 생성 시간이 더 늘어날 수
// 있어(Pro 플랜 기준 최대 300초까지 허용) 여유를 크게 둡니다. 그래도 함수가 중간에 죽는
// 경우를 대비해 아래에 "generating" 락 + 오래된 락 무시 로직을 둡니다.
const STALE_GENERATION_MS = 280_000;

export type GenerationOutcome = { status: "ready"; assembled: unknown } | { status: "generating" } | { status: "failed" };

// 2026-09-28: gpt-6-sol 전환 후 생성 시간이 늘어나 "이미 생성 중"인지 락으로 확인합니다.
// - 리포트 행이 없거나, 'generating'인데 STALE_GENERATION_MS보다 오래됐으면(이전 시도가 죽은
//   것으로 판단) 이번 요청이 새로 락을 걸고 OpenAI를 호출합니다.
// - 이미 최근에 'generating' 락이 걸려있으면(다른 탭/폴링 중인 요청이 진행 중) 이번 요청은
//   OpenAI를 다시 부르지 않고 그냥 "generating"만 반환합니다 — 클라이언트는 몇 초 후 다시 폴링.
export async function startOrGetGeneration(
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
    .select("type_key, user_name, gender, axis_scores, factor_scores, sub_scores, mode_scores, part1_answers, part2_answers")
    .eq("id", resultId)
    .single();
  if (resultError || !result) {
    await admin.from("ssol_reports").update({ status: "failed" }).eq("order_id", orderId);
    return { status: "failed" };
  }

  const typeCode = result.type_key as TypeCode;
  const [confirmedAxis, confirmedMode] = typeCode.split("-") as [AxisKey, ModeKey];

  const input = buildReportV3Input({
    userName: result.user_name,
    gender: result.gender,
    axis: confirmedAxis,
    mode: confirmedMode,
    axisScores: result.axis_scores,
    factorScores: result.factor_scores,
    modeScores: result.mode_scores,
    copingSubScores: result.sub_scores,
    part1Answers: result.part1_answers,
    part2Answers: result.part2_answers,
  });

  // 2026-10-05: 섹션 1은 AI 없이 점수만으로 결정론적으로 조립됩니다 — 같은 입력이면 항상 같은
  // 글이라 무료 미리보기(app/api/report/preview)와 결제 후 리포트가 따로 캐싱하지 않아도 같습니다.
  let sections;
  try {
    const section1 = assembleSection1(input);
    sections = await generateReportV3(input, section1);
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
