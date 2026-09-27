-- 2026-09-25: "유형간 관계성 보고서"(친구/연인과의 궁합 심층 리포트) 추가분.
-- 기존 ssol_orders/ssol_reports는 "내 유형" 리포트(1건)만 가정했는데, 이제 같은 결과(result_id)로
-- 솔로 리포트와 관계성 리포트를 각각 따로 결제할 수 있어서 구분 컬럼이 필요합니다.
-- 여러 번 실행해도 안전합니다(add column if not exists).

alter table public.ssol_orders
  add column if not exists report_kind text not null default 'solo',
  add column if not exists friend_type_code text;

alter table public.ssol_reports
  add column if not exists report_kind text not null default 'solo',
  add column if not exists friend_type_code text;

-- 결제 여부 조회 시 "같은 result_id라도 리포트 종류가 다르면 다른 주문"으로 찾을 수 있도록 색인.
create index if not exists ssol_orders_result_kind_idx on public.ssol_orders (result_id, report_kind, friend_type_code);
