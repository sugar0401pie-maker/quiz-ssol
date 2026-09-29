-- 2026-09-29: 이스터에그 히든 결과(초슈퍼울트라짱디저트/비스코티) — 15유형 체계 밖의
-- 특별 결과를 표시하기 위한 플래그. null이면 평소처럼 15유형 중 하나입니다.
-- (값 검증은 lib/scoring.ts의 detectSpecialResult()가 서버에서 계산해서 넣으므로,
-- 여기서는 별도 CHECK 제약 없이 컬럼만 추가합니다.)
alter table public.ssol_quiz_results add column if not exists special_key text;
