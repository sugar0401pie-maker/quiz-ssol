-- 토스페이먼츠 연동분: 주문 생성 시점에 고른 생활영역 태그를 주문에도 저장해서,
-- 결제 승인 후(외부 사이트를 오갔다 오는 흐름) 태그를 다시 몰라도 리포트를 이어서 생성할 수 있게 합니다.
alter table public.ssol_orders add column if not exists life_domain_tags text[];
