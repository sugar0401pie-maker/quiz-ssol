-- 2026-10-28: 방문자가 어디서 들어왔는지(유입 경로) 기록용 칸. 응시 시작·완료 카운터(ssol_quiz_events)에 함께 남긴다.
-- - source: 정리된 출처(instagram, kakao, share, www, direct …), medium/campaign: 링크에 붙인 utm 표시, referrer: 이전 사이트 도메인만.
-- - 개인정보 없음(경로·검색어·IP는 저장하지 않음). Supabase SQL Editor에서 한 번 실행하세요(여러 번 실행해도 안전합니다).
alter table public.ssol_quiz_events add column if not exists source text;
alter table public.ssol_quiz_events add column if not exists medium text;
alter table public.ssol_quiz_events add column if not exists campaign text;
alter table public.ssol_quiz_events add column if not exists referrer text;
create index if not exists ssol_quiz_events_source_idx on public.ssol_quiz_events (source);

-- 보는 법(출처별 시작·완료 수):
-- select coalesce(source, '(기록 전)') as source, coalesce(medium, '') as medium,
--        count(*) filter (where event = 'start') as starts,
--        count(*) filter (where event = 'complete') as completes
-- from public.ssol_quiz_events where created_at >= '2026-10-28' group by 1, 2 order by starts desc;
