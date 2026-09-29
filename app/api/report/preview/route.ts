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
// 2026-09-29: 동시 요청 방지 락 — 두 탭을 동시에 열거나 리액트가 두 번 마운트하는 경우
// section1_preview가 아직 비어있는 두 요청이 동시에 들어와 OpenAI를 두 번 부를 수 있었습니다
// (유료 생성 경로의 ssol_reports.status='generating' 락과 달리 여기엔 락이 없었음). 아래처럼
// section1_preview_at을 락 타임스탬프로 써서, 먼저 도착한 요청만 생성하고 나중 요청은
// 잠깐 기다렸다가 캐싱된 값을 읽습니다.
const STALE_PREVIEW_MS = 90_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // 락 시도: section1_preview가 아직 비어있고(=null), section1_preview_at도 없거나
  // STALE_PREVIEW_MS보다 오래된 경우에만 이번 요청이 락을 갱신합니다(성공 시 row 반환).
  // 마이그레이션 전이라 컬럼이 없으면 이 호출 자체가 에러를 내는데, 그 경우 락 없이
  // (기존 방식대로) 바로 생성을 진행합니다.
  const staleThreshold = new Date(Date.now() - STALE_PREVIEW_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("ssol_quiz_results")
    .update({ section1_preview_at: new Date().toISOString() })
    .eq("id", resultId)
    .is("section1_preview", null)
    .or(`section1_preview_at.is.null,section1_preview_at.lt.${staleThreshold}`)
    .select("id")
    .maybeSingle();

  if (!claimError && !claimed) {
    // 다른 요청이 방금 락을 잡고 생성 중 — 잠깐 기다렸다가 캐싱된 값을 읽어봅니다.
    for (let i = 0; i < 5; i++) {
      await sleep(4000);
      const { data: refreshed } = await admin.from("ssol_quiz_results").select("section1_preview").eq("id", resultId).single();
      if (refreshed?.section1_preview) return NextResponse.json({ section1: refreshed.section1_preview });
    }
    // 그래도 안 끝났으면(드문 경우) 여기서 또 생성을 시작하지 않고 빈 응답을 돌려줍니다 —
    // 화면은 준비 중 문구를 계속 보여주고, 원래 요청이 끝나면 다음 방문 때 캐시로 뜹니다.
    return NextResponse.json({});
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
