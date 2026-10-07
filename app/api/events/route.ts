import { DESSERT } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

// 2026-10-07: 응시 시작·완료 카운터 수집(lib/trackQuizEvent.ts). 로그인 없이 누구나 호출하므로 입력을 엄격히
// 검증하고, 실패해도 항상 204로 응답해 화면 흐름에 영향이 없게 한다(표가 아직 없어도 마찬가지 —
// supabase/patch-quiz-events.sql을 실행하기 전에는 서버 로그에만 오류가 남는다).
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const EVENTS = ["start", "complete", "paywall_view", "pay_click", "signup_wall", "pay_window"];

export async function POST(req: Request) {
  let body: { event?: unknown; runId?: unknown; visitorId?: unknown; typeKey?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const event = body?.event;
  const runId = body?.runId;
  const visitorId = body?.visitorId;
  const typeKey = body?.typeKey;
  if (typeof event !== "string" || !EVENTS.includes(event) || typeof runId !== "string" || !ID_RE.test(runId)) {
    return new Response(null, { status: 204 });
  }
  const row = {
    event,
    run_id: runId,
    visitor_id: typeof visitorId === "string" && ID_RE.test(visitorId) ? visitorId : null,
    type_key: event === "complete" && typeof typeKey === "string" && typeKey in DESSERT ? typeKey : null,
  };
  const { error } = await createAdminClient()
    .from("ssol_quiz_events")
    .upsert(row, { onConflict: "run_id,event", ignoreDuplicates: true });
  if (error) console.error("응시 이벤트 기록 실패:", error.message);
  return new Response(null, { status: 204 });
}
