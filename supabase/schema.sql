-- 쏠 웰니스 하우스 · 2단계 Supabase 스키마
-- 모든 테이블/함수/트리거 이름은 기존 프로젝트 객체와 겹치지 않도록 ssol_ 접두사를 사용합니다.
-- 사용법: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행 (여러 번 실행해도 안전하도록 if not exists 사용)
-- 로그인 사용자는 Supabase Auth(auth.users)를 그대로 사용합니다. 별도 users 테이블은 만들지 않습니다.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- 1) 프로필 (auth.users 1:1, 표시 이름/호칭 저장)
-- ─────────────────────────────────────────────
create table if not exists public.ssol_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  gender      text check (gender in ('female','male','none')),
  provider    text,                       -- 'kakao' | 'naver' | 'email'
  created_at  timestamptz not null default now()
);

-- 가입 시 profiles 행 자동 생성
create or replace function public.ssol_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ssol_profiles (id, name, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nickname'),
    new.raw_app_meta_data->>'provider'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ssol_on_auth_user_created on auth.users;
create trigger ssol_on_auth_user_created
  after insert on auth.users
  for each row execute function public.ssol_handle_new_user();

-- ─────────────────────────────────────────────
-- 2) 테스트 결과  (QuizContext 값을 그대로 저장)
--    user_id 가 null 이면 "로그인 없이 저장된 결과"(공유용) — 서버(service role)만 insert 가능
-- ─────────────────────────────────────────────
create table if not exists public.ssol_quiz_results (
  id              uuid primary key default gen_random_uuid(),
  share_id        text not null unique default encode(gen_random_bytes(6), 'hex'),  -- 공유 URL 용 (/r/{share_id})
  user_id         uuid references auth.users(id) on delete set null,
  user_name       text not null,
  gender          text not null check (gender in ('female','male','none')),
  answers         smallint[] not null check (array_length(answers, 1) = 20),
  domain_scores   jsonb not null,          -- {"relate":18,"worth":12,"control":12,"happy":12,"meaning":12}
  type_key        text not null check (type_key ~ '^(relate|worth|control|happy|meaning)_(F|E)$'),
  created_at      timestamptz not null default now()
);
create index if not exists ssol_quiz_results_user_idx on public.ssol_quiz_results (user_id, created_at desc);

-- ─────────────────────────────────────────────
-- 3) 주문 / 결제 (토스페이먼츠)
--    금액은 반드시 서버에서 3500 으로 고정해 생성하고, 결제 승인 시 amount 를 다시 대조합니다.
-- ─────────────────────────────────────────────
create table if not exists public.ssol_orders (
  id                uuid primary key default gen_random_uuid(),
  order_id          text not null unique,            -- 토스에 넘기는 orderId (예: ssol_20260921_ab12cd)
  user_id           uuid not null references auth.users(id) on delete restrict,
  result_id         uuid not null references public.ssol_quiz_results(id) on delete restrict,
  amount            integer not null check (amount > 0),
  status            text not null default 'pending' check (status in ('pending','paid','failed','canceled','refunded')),
  toss_payment_key  text unique,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists ssol_orders_user_idx on public.ssol_orders (user_id, created_at desc);

-- ─────────────────────────────────────────────
-- 4) 심층 리포트 (Claude API 생성 결과)
-- ─────────────────────────────────────────────
create table if not exists public.ssol_reports (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references public.ssol_orders(id) on delete restrict,  -- 주문 1건당 리포트 1개
  result_id   uuid not null references public.ssol_quiz_results(id) on delete restrict,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','generating','ready','failed')),
  sections    jsonb,                     -- [{ "title": "...", "body": "..." } x 7]
  model       text,                      -- 생성에 사용한 모델 ID
  created_at  timestamptz not null default now(),
  ready_at    timestamptz
);

-- ─────────────────────────────────────────────
-- 5) 1주일 AI 채팅권 + 채팅 메시지
-- ─────────────────────────────────────────────
create table if not exists public.ssol_chat_passes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_id    uuid not null unique references public.ssol_orders(id) on delete restrict,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days')
);
create index if not exists ssol_chat_passes_user_idx on public.ssol_chat_passes (user_id, expires_at desc);

create table if not exists public.ssol_chat_messages (
  id          bigint generated always as identity primary key,
  pass_id     uuid not null references public.ssol_chat_passes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ssol_chat_messages_pass_idx on public.ssol_chat_messages (pass_id, created_at);

-- ─────────────────────────────────────────────
-- 6) RLS (Row Level Security) — 반드시 켜기
--    · 브라우저(anon/authenticated 키)에서는 "내 것 읽기"만 허용
--    · 쓰기(insert/update)는 전부 서버(Route Handler, service_role 키)에서만 수행
--      (service_role 은 RLS 를 우회하므로 정책이 필요 없음. 이 키는 절대 브라우저에 노출 금지)
-- ─────────────────────────────────────────────
alter table public.ssol_profiles       enable row level security;
alter table public.ssol_quiz_results   enable row level security;
alter table public.ssol_orders         enable row level security;
alter table public.ssol_reports        enable row level security;
alter table public.ssol_chat_passes    enable row level security;
alter table public.ssol_chat_messages  enable row level security;

drop policy if exists "profiles: read own"   on public.ssol_profiles;
drop policy if exists "profiles: update own" on public.ssol_profiles;
create policy "profiles: read own"   on public.ssol_profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.ssol_profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "results: read own" on public.ssol_quiz_results;
create policy "results: read own" on public.ssol_quiz_results for select using (auth.uid() = user_id);

drop policy if exists "orders: read own" on public.ssol_orders;
create policy "orders: read own" on public.ssol_orders for select using (auth.uid() = user_id);

drop policy if exists "reports: read own" on public.ssol_reports;
create policy "reports: read own" on public.ssol_reports for select using (auth.uid() = user_id);

drop policy if exists "passes: read own" on public.ssol_chat_passes;
create policy "passes: read own" on public.ssol_chat_passes for select using (auth.uid() = user_id);

drop policy if exists "messages: read own" on public.ssol_chat_messages;
create policy "messages: read own" on public.ssol_chat_messages for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 7) 공유 페이지용: share_id 로 "유형만" 공개 조회 (이름/응답 원본은 노출하지 않음)
-- ─────────────────────────────────────────────
create or replace function public.ssol_get_shared_result(p_share_id text)
returns table (type_key text, domain_scores jsonb)
language sql security definer set search_path = public as $$
  select type_key, domain_scores from public.ssol_quiz_results where share_id = p_share_id;
$$;
revoke all on function public.ssol_get_shared_result(text) from public;
grant execute on function public.ssol_get_shared_result(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- 8) 편의 함수: 지금 유효한 채팅권이 있는가 (채팅 API 에서 서버가 호출)
-- ─────────────────────────────────────────────
create or replace function public.ssol_has_active_chat_pass(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ssol_chat_passes where user_id = p_user and expires_at > now());
$$;
revoke all on function public.ssol_has_active_chat_pass(uuid) from public;
grant execute on function public.ssol_has_active_chat_pass(uuid) to service_role;

-- ─────────────────────────────────────────────
-- (참고) 저장 흐름 예시 — 서버 Route Handler 에서 service_role 로 실행
--   1. 가입/로그인 직후: insert into ssol_quiz_results (user_id, user_name, gender, answers, domain_scores, type_key) values (...)
--   2. 결제 시작:        insert into ssol_orders (order_id, user_id, result_id, amount) values ('ssol_...', ..., ..., 3500)
--   3. 결제 승인 성공:    update ssol_orders set status='paid', toss_payment_key=..., paid_at=now() where order_id=... and amount=3500
--                        insert into chat_passes (user_id, order_id) values (...)
--                        insert into reports (order_id, result_id, user_id, status) values (...,'generating')
--   4. 리포트 생성 완료:  update ssol_reports set status='ready', sections=..., ready_at=now() where id=...
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- 9) 권한 (GRANT)
--    SQL Editor 로 만든 테이블은 API 역할에 권한이 자동으로 붙지 않을 수 있어 명시합니다.
--    · service_role(서버): 전부 읽기/쓰기   · authenticated(로그인 사용자): 본인 행 읽기만 (RLS 정책이 본인 행으로 제한)
-- ─────────────────────────────────────────────
grant usage on schema public to service_role, authenticated, anon;

grant all on
  public.ssol_profiles, public.ssol_quiz_results, public.ssol_orders,
  public.ssol_reports, public.ssol_chat_passes, public.ssol_chat_messages
  to service_role;
grant usage, select on all sequences in schema public to service_role;

grant select on
  public.ssol_quiz_results, public.ssol_orders, public.ssol_reports,
  public.ssol_chat_passes, public.ssol_chat_messages
  to authenticated;
grant select, update (name, gender) on public.ssol_profiles to authenticated;
