-- 2026-09-28: 심층 리포트 섹션 1(당신의 웰니스 프로파일) 무료 공개 기능.
-- 결제 전에도 AI가 쓴 섹션 1 전체를 볼 수 있도록, 한 번 생성하면 이 결과에 캐싱해
-- 재방문 시(또는 결제 후 2~8번을 이어 쓸 때) 다시 생성하지 않고 재사용합니다.
-- 여러 번 실행해도 안전합니다.
alter table public.ssol_quiz_results add column if not exists section1_preview jsonb;
alter table public.ssol_quiz_results add column if not exists section1_preview_at timestamptz;
