import { NextResponse } from "next/server";
import { type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportV3Input } from "@/lib/reportV3/buildInput";
import { assembleSection1 } from "@/lib/reportV3/sectionOneAssembler";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-29: 섹션 1(웰니스 프로파일) 무료 공개 — 결제 없이 로그인만 하면(자기 결과에 한해)
// 볼 수 있습니다. deep-report-prompt-8section-v6.md 최신 반영으로 섹션 1은 더 이상 AI가
// 쓰지 않고 서버가 점수만으로 즉시 결정론적으로 조립합니다(lib/reportV3/sectionOneAssembler.ts) —
// 같은 입력이면 항상 같은 결과라 AI 호출도, 캐싱도, 동시 요청 잠금도 필요 없어졌습니다
// (예전엔 이 라우트가 OpenAI를 호출해서 캐싱·락 로직이 있었는데 전부 걷어냈습니다).
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
    .select("user_id, type_key, axis_scores, factor_scores, sub_scores, mode_scores, part1_answers, part2_answers")
    .eq("id", resultId)
    .single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
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

  return NextResponse.json({ section1: assembleSection1(input) });
}
