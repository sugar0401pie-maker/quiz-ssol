-- 2026-10-07: 결제 화면 이탈 지점을 보려고 이벤트 종류를 늘립니다(결제 화면 도달·결제 버튼 클릭·가입 화면으로 보냄·결제 창 열림).
-- 이미 patch-quiz-events.sql을 실행한 경우 이 파일을 한 번 더 실행하세요(여러 번 실행해도 안전합니다).
alter table public.ssol_quiz_events drop constraint if exists ssol_quiz_events_event_check;
alter table public.ssol_quiz_events
  add constraint ssol_quiz_events_event_check
  check (event in ('start', 'complete', 'paywall_view', 'pay_click', 'signup_wall', 'pay_window'));
