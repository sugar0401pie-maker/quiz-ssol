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
//
// 실측으로 발견한 두 번째 문제(더 심각함): sectionOneAssembler.ts의 조립 로직을 오늘
// 두 번 고쳤는데(undefined 버그, 점수 중복 표기), 그 사이에 이미 캐싱된 section1_preview
// 값은 고쳐지지 않고 그대로 남아있어서, 코드를 배포해도 예전에 한 번이라도 미리보기를
// 본 결과는 계속 옛날(버그 있는) 문장을 보여주는 사고가 실제로 있었습니다. 캐시에
// 버전 번호를 함께 저장해서, 조립 로직이 바뀌면(아래 SECTION1_CACHE_VERSION을 올리면)
// 예전 버전 캐시는 자동으로 무효 처리되고 새로 조립되도록 합니다 — 버그를 고칠 때마다
// 수동으로 DB 캐시를 지워야 한다는 걸 기억할 필요가 없어집니다.
const SECTION1_CACHE_VERSION = 1;

const CLAIM_STALE_MS = 20_000; // 다양화 호출은 보통 몇 초면 끝나므로, 이보다 오래된 클레임은 죽은 것으로 간주합니다.
const POLL_INTERVAL_MS = 500;
// 2026-09-30: 예전엔 5초만 기다리고 포기했는데, 정상적인 AI 호출도(특히 부하가 있을 때)
// 5초를 넘기는 경우가 있어 — 그러면 진 쪽이 포기하고 직접 만들어서 서로 다른 문장이
// 나가는 걸 이 캐시가 막으려던 바로 그 상황이 재현됐습니다. CLAIM_STALE_MS에 가깝게
// 늘려서(약간의 여유를 두고), 클레임이 실제로 죽은 경우에만 포기하도록 합니다.
const POLL_ATTEMPTS = 34; // 최대 17초 대기

interface CachedSection1 {
  v: number;
  paragraphs: string[];
}

// 예전(버전 개념이 도입되기 전) 캐시는 맨 배열 형태였습니다 — 그런 값과, 버전이 다른
// 값은 전부 "캐시 없음"과 동일하게 취급해 다시 조립합니다.
function readValidCache(value: unknown): string[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cached = value as Partial<CachedSection1>;
  if (cached.v !== SECTION1_CACHE_VERSION || !Array.isArray(cached.paragraphs) || cached.paragraphs.length === 0) return null;
  return cached.paragraphs;
}

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
  const cached = readValidCache(row?.section1_preview);
  if (cached) return cached;

  // section1_preview_at이 비어있거나(한 번도 클레임된 적 없음), 너무 오래전에 클레임된
  // 채로 멈춰있으면(다른 요청이 AI 호출 도중 죽었거나 타임아웃) 이번 요청이 (재)클레임할
  // 수 있습니다. Postgres는 같은 행에 대한 동시 UPDATE를 하나씩 순서대로 처리하므로,
  // 두 요청이 거의 동시에 이 코드에 도달해도 실제로 클레임에 성공하는 건 하나뿐입니다.
  // (처음엔 "비어있을 때만" 조건이라 한 번 클레임된 행은 죽은 클레임이어도 영영 재클레임이
  // 안 되는 버그가 있었습니다 — .or()로 "죽은 클레임도 다시 가져올 수 있게" 고쳤습니다.)
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  const { data: claimed } = await admin
    .from("ssol_quiz_results")
    .update({ section1_preview_at: new Date().toISOString() })
    .eq("id", resultId)
    .or(`section1_preview_at.is.null,section1_preview_at.lt.${staleBefore}`)
    .select("id");
  if (Array.isArray(claimed) && claimed.length > 0) {
    const paragraphs = await assembleSection1Varied(input);
    const payload: CachedSection1 = { v: SECTION1_CACHE_VERSION, paragraphs };
    const { error } = await admin.from("ssol_quiz_results").update({ section1_preview: payload }).eq("id", resultId);
    if (error) console.error("섹션1 캐시 저장 실패:", error.message);
    return paragraphs;
  }

  // 클레임에 실패했다는 건 다른 요청이 지금(신선하게) 만들고 있다는 뜻 — 그 결과가
  // 채워지길 잠깐 기다렸다가 재사용합니다(항상 같은 문장을 보여주기 위해).
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data: retry } = await admin.from("ssol_quiz_results").select("section1_preview").eq("id", resultId).single();
    const retryCached = readValidCache(retry?.section1_preview);
    if (retryCached) return retryCached;
  }

  // 5초를 기다려도 못 받으면(락이 죽었거나 유독 느림) 사용자를 계속 기다리게 하지
  // 않기 위해 직접 만들어서 반환합니다 — 다만 캐시는 건드리지 않습니다(먼저 클레임한
  // 요청이 뒤늦게 쓸 수도 있는 값을 덮어쓰지 않기 위해).
  return assembleSection1Varied(input);
}
