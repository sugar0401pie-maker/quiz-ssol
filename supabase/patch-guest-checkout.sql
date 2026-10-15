-- 2026-10-15: 로그인 없이 결제하는 "비회원(guest)" 흐름 + 결제 전 청약철회 제한 동의 기록.
-- 비회원은 브라우저에만 있는 무작위 열쇠의 해시(guest_token_hash)로 자기 결과·주문·리포트를 식별합니다.
-- 가입하면 /api/results/claim이 user_id를 채우고 guest_token_hash를 비웁니다.
-- 여러 번 실행해도 안전합니다. Supabase SQL Editor에서 한 번 실행해 주세요.

alter table public.ssol_quiz_results add column if not exists guest_token_hash text;
alter table public.ssol_orders       add column if not exists guest_token_hash text;
alter table public.ssol_reports      add column if not exists guest_token_hash text;

-- 비회원 주문·리포트는 계정이 없으므로 user_id를 비울 수 있어야 합니다.
alter table public.ssol_orders  alter column user_id drop not null;
alter table public.ssol_reports alter column user_id drop not null;

-- 소유자(계정 또는 비회원 열쇠) 없는 주문·리포트는 만들 수 없게 막습니다(기존 행은 전부 user_id가 있어 통과).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ssol_orders_owner_check') then
    alter table public.ssol_orders add constraint ssol_orders_owner_check check (user_id is not null or guest_token_hash is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ssol_reports_owner_check') then
    alter table public.ssol_reports add constraint ssol_reports_owner_check check (user_id is not null or guest_token_hash is not null);
  end if;
end $$;

create index if not exists ssol_quiz_results_guest_idx on public.ssol_quiz_results (guest_token_hash, created_at desc) where guest_token_hash is not null;
create index if not exists ssol_orders_guest_idx       on public.ssol_orders       (guest_token_hash, created_at desc) where guest_token_hash is not null;
create index if not exists ssol_reports_guest_idx      on public.ssol_reports      (guest_token_hash)                  where guest_token_hash is not null;

-- 결제 전 청약철회 제한 동의 기록(주문마다 동의 시각과 어떤 문구 버전이었는지).
alter table public.ssol_orders add column if not exists withdrawal_notice_at timestamptz;
alter table public.ssol_orders add column if not exists withdrawal_notice_version text;
