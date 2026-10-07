-- 2026-10-07: 심리테스트 응시 시작·완료 카운터. 로그인하지 않고 테스트만 해 본 사람은 서버에 기록이
-- 남지 않아서, "응시자 대비 결과 저장·가입 비율"을 알 수 없었다. 이 표는 응시 흐름(시작/완료)만 센다.
-- - 개인정보 없음: 닉네임·답변·IP는 저장하지 않고, 브라우저마다 무작위로 만든 방문자 id와 한 번의 응시를 구분하는
--   run id, 완료 때의 유형 코드만 남긴다.
-- - 앱(서버)만 쓴다: RLS를 켜고 정책은 만들지 않아 anon/authenticated는 읽고 쓸 수 없으며, 서비스 롤로만 접근한다.
-- Supabase SQL Editor에서 한 번 실행하세요(여러 번 실행해도 안전합니다).
create table if not exists public.ssol_quiz_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('start', 'complete', 'paywall_view', 'pay_click', 'signup_wall', 'pay_window')),
  run_id text not null,
  visitor_id text,
  type_key text
);
-- 같은 응시(run)의 같은 이벤트는 한 번만 센다(새로고침·중복 호출 방지).
create unique index if not exists ssol_quiz_events_run_event_uidx on public.ssol_quiz_events (run_id, event);
create index if not exists ssol_quiz_events_created_idx on public.ssol_quiz_events (created_at);

alter table public.ssol_quiz_events enable row level security;
grant all on public.ssol_quiz_events to service_role;

-- 보는 법(날짜별 시작/완료 수와 완료율):
-- select (created_at at time zone 'Asia/Seoul')::date as day,
--        count(*) filter (where event = 'start') as starts,
--        count(*) filter (where event = 'complete') as completes
-- from public.ssol_quiz_events group by 1 order by 1 desc;
