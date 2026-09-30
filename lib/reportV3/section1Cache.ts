import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { assembleSection1Varied, type SectionOneInput } from "./sectionOneAssembler";

// 2026-09-30: assembleSection1Varied()는 AI를 한 번 호출할 수 있어(중복 문장 다양화)
// 매번 다른 표현이 나올 수 있습니다 — 무료 미리보기와 결제 후 리포트가 항상 같은 문장을
// 보여주도록, 결과를 ssol_quiz_results.section1_preview에 캐싱하고 이후엔 그대로 재사용합니다.
// 이 컬럼은 원래 섹션 1이 AI로 작성되던 시절 쓰던 캐시라 이미 DB에 있습니다(재사용).
//
// 실측으로 발견한 경쟁 상태: 무료 미리보기 fetch와 "결제 건너뛰고 바로 생성"(또는 실제
// 결제 직후 폴링) 요청이 거의 동시에 들어오면, 둘 다 캐시가 비어있는 걸 보고 각자
// AI를 호출해 서로 다른 표현을 캐싱해버릴 수 있습니다(먼저 읽은 값을 그대로 믿으면
// 안 됩니다). section1_preview_at을 "클레임" 마커로 써서, Postgres가 같은 행에 대한
// 동시 UPDATE를 직렬화해주는 성질을 이용해 둘 중 하나만 실제로 AI를 호출하게 하고,
// 진 쪽은 이긴 쪽의 결과가 채워지길 잠깐 기다렸다가 재사용합니다.
const CLAIM_STALE_MS = 20_000; // 다양화 호출은 보통 몇 초면 끝나므로, 이보다 오래된 클레임은 죽은 것으로 간주합니다.
const POLL_INTERVAL_MS = 500;
const POLL_ATTEMPTS = 10; // 최대 5초 대기

export async function getOrBuildSection1(
  admin: ReturnType<typeof createAdminClient>,
  resultId: string,
  input: SectionOneInput
): Promise<string[]> {
  const { data: row } = await admin
    .from("ssol_quiz_results")
    .select("section1_preview, section1_preview_at")
    .eq("id", resultId)
    .single();
  if (Array.isArray(row?.section1_preview) && row.section1_preview.length > 0) {
    return row.section1_preview as string[];
  }

  const hasFreshClaim = !!row?.section1_preview_at && Date.now() - new Date(row.section1_preview_at).getTime() < CLAIM_STALE_MS;
  if (!hasFreshClaim) {
    // section1_preview_at이 비어있을 때만 성공하는 조건부 UPDATE — 같은 행에 동시에
    // 들어온 UPDATE는 Postgres가 하나씩 순서대로 처리하므로, 두 요청이 거의 동시에
    // 이 코드에 도달해도 실제로 클레임에 성공하는 건 하나뿐입니다.
    const { data: claimed } = await admin
      .from("ssol_quiz_results")
      .update({ section1_preview_at: new Date().toISOString() })
      .eq("id", resultId)
      .is("section1_preview_at", null)
      .select("id");
    if (Array.isArray(claimed) && claimed.length > 0) {
      const section1 = await assembleSection1Varied(input);
      const { error } = await admin.from("ssol_quiz_results").update({ section1_preview: section1 }).eq("id", resultId);
      if (error) console.error("섹션1 캐시 저장 실패:", error.message);
      return section1;
    }
  }

  // 클레임에 실패했다는 건 다른 요청이 지금 만들고 있다는 뜻 — 그 결과가 채워지길
  // 잠깐 기다렸다가 재사용합니다(항상 같은 문장을 보여주기 위해).
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data: retry } = await admin.from("ssol_quiz_results").select("section1_preview").eq("id", resultId).single();
    if (Array.isArray(retry?.section1_preview) && retry.section1_preview.length > 0) return retry.section1_preview as string[];
  }

  // 5초를 기다려도 못 받으면(락이 죽었거나 유독 느림) 사용자를 계속 기다리게 하지
  // 않기 위해 직접 만들어서 반환합니다 — 다만 캐시는 건드리지 않습니다(먼저 클레임한
  // 요청이 뒤늦게 쓸 수도 있는 값을 덮어쓰지 않기 위해).
  return assembleSection1Varied(input);
}
