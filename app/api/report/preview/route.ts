import { NextResponse } from "next/server";
import { type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { buildReportV3Input } from "@/lib/reportV3/buildInput";
import { assembleSection1 } from "@/lib/reportV3/sectionOneAssembler";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-29: 섹션 1(웰니스 프로파일) 무료 공개 — 결제 없이 로그인만 하면(자기 결과에 한해)
// 볼 수 있습니다. deep-report-prompt-8section-v6.md 최신 반영으로 섹션 1은 더 이상 AI가
// 쓰지 않고 서버가 점수만으로 즉시 결정론적으로 조립합니다(lib/reportV3/sectionOneAssembler.ts).
// 2026-10-05: 같은 구간 영역의 반복 문구를 AI 대신 미리 써둔 표현 여러 개로 풀면서 AI 호출과 캐시를
// 없앴습니다 — 같은 입력이면 항상 같은 글이라 결제 후 리포트와도 자동으로 같습니다.
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
    .select("user_id, user_name, gender, type_key, axis_scores, factor_scores, sub_scores, mode_scores, part1_answers, part2_answers, special_key")
    .eq("id", resultId)
    .single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }
  // 2026-09-30: 이스터에그 히든 결과(초슈퍼울트라짱/비스코티)는 심층 리포트가 없습니다 —
  // app/api/orders/route.ts에는 이미 있던 방어선이 이 라우트엔 빠져 있어서, 결제 없이도
  // 직접 이 URL로 접근하면 정상 유형인 것처럼 무료 미리보기가 나가고 있었습니다.
  if (result.special_key) {
    return NextResponse.json({ error: "no deep report for special result" }, { status: 400 });
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

  const section1 = assembleSection1(input);
  return NextResponse.json({ section1 });
}
