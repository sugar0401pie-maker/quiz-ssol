-- 심층 리포트 생성 기능 추가분: 생활영역 태그 컬럼 (여러 번 실행해도 안전)
alter table public.ssol_reports add column if not exists life_domain_tags text[];
