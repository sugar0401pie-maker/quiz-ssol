import { NextResponse } from "next/server";
import { type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportV3Input } from "@/lib/reportV3/buildInput";
import { getOrBuildSection1 } from "@/lib/reportV3/section1Cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-29: 섹션 1(웰니스 프로파일) 무료 공개 — 결제 없이 로그인만 하면(자기 결과에 한해)
// 볼 수 있습니다. deep-report-prompt-8section-v6.md 최신 반영으로 섹션 1은 더 이상 AI가
// 쓰지 않고 서버가 점수만으로 즉시 결정론적으로 조립합니다(lib/reportV3/sectionOneAssembler.ts).
// 2026-09-30: 단, 그리드 여러 개가 같은 점수 구간이라 문장이 반복되는 경우엔 그 부분만 AI로
// 한 번 다양화합니다 — 그래서 다시 캐싱이 필요해졌습니다(section1Cache.ts, 결제 후 리포트와
// 항상 같은 문장을 보장). 캐시가 있으면 AI를 다시 부르지 않고 그대로 재사용합니다.
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

  const section1 = await getOrBuildSection1(admin, resultId, input);
  return NextResponse.json({ section1 });
}
