import { NextResponse } from "next/server";
import { type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportV3Input } from "@/lib/reportV3/buildInput";
import { generateSection1Only } from "@/lib/reportV3/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

// 2026-09-28: 섹션 1(웰니스 프로파일) 무료 공개 — 결제 없이 로그인만 하면(자기 결과에 한해)
// AI가 쓴 섹션 1 전체를 볼 수 있습니다. 한 번 생성하면 ssol_quiz_results.section1_preview에
// 캐싱해서 재방문 시 다시 생성하지 않습니다(비용 절감 + 항상 같은 내용 보장).
// supabase/patch-section1-preview.sql이 아직 적용 전이면 해당 컬럼이 없어 select/update가
// 실패할 수 있는데, 그 경우도 방어적으로 처리해서(캐싱만 건너뛰고) 매번 새로 생성합니다.
export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const resultId = new URL(req.url).searchParams.get("resultId");
  if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("user_id, type_key, axis_scores, factor_scores, sub_scores, mode_scores, part1_answers, part2_answers, section1_preview")
    .eq("id", resultId)
    .single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }

  if (result.section1_preview) {
    return NextResponse.json({ section1: result.section1_preview });
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

  let section1: string[];
  try {
    section1 = await generateSection1Only(input);
  } catch (err) {
    console.error("섹션1 무료 미리보기 생성 실패:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }

  const { error: cacheError } = await admin
    .from("ssol_quiz_results")
    .update({ section1_preview: section1, section1_preview_at: new Date().toISOString() })
    .eq("id", resultId);
  if (cacheError) {
    // 마이그레이션 전이라 컬럼이 없는 경우 등 — 캐싱만 실패, 생성 결과는 그대로 돌려줍니다.
    console.error("섹션1 캐싱 실패(계속 진행):", cacheError.message);
  }

  return NextResponse.json({ section1 });
}
