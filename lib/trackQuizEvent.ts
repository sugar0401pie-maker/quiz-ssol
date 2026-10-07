// 2026-10-07: 응시 시작·완료 카운터(supabase/patch-quiz-events.sql, app/api/events).
// 서버에 개인정보는 보내지 않는다 — 브라우저마다 무작위로 만든 방문자 id, 한 번의 응시를 구분하는 run id,
// 완료 때의 유형 코드뿐. 집계가 화면을 막으면 안 되므로 실패해도 조용히 무시한다(fire-and-forget).
const VISITOR_KEY = "ssol_visitor_id";
const RUN_KEY = "ssol_quiz_run_id";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readOrCreate(store: Storage, key: string, forceNew = false): string {
  try {
    const existing = forceNew ? null : store.getItem(key);
    if (existing) return existing;
    const id = newId();
    store.setItem(key, id);
    return id;
  } catch {
    return newId(); // 저장소를 못 쓰는 환경(사파리 프라이빗 모드 등)이면 이번 호출만 임시 id.
  }
}

/**
 * start: 새 응시(run)를 시작. 나머지는 같은 run에 이어서 기록(run이 없으면 새로 만듦).
 * complete=2부까지 마침, paywall_view=결제 전 리포트 화면 도달, pay_click=결제 버튼 클릭,
 * signup_wall=결제하려는데 로그인이 안 돼 가입 화면으로 보낸 경우, pay_window=결제 창이 실제로 열림.
 */
export type QuizEvent = "start" | "complete" | "paywall_view" | "pay_click" | "signup_wall" | "pay_window";

export function trackQuizEvent(event: QuizEvent, typeKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    const visitorId = readOrCreate(window.localStorage, VISITOR_KEY);
    const runId = readOrCreate(window.sessionStorage, RUN_KEY, event === "start");
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, runId, visitorId, typeKey }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 집계 실패는 사용자 흐름에 영향을 주지 않는다.
  }
}
