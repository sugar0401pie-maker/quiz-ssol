-- 2026-09-25: "이메일 중복확인" 기능 추가분.
-- 문제: signInWithOtp(shouldCreateUser:true)는 이미 있는 이메일이어도 조용히 성공해버려서(기존
-- 계정으로 로그인 OTP를 보내는 셈), 그 상태로 가입 폼을 끝까지 진행하면 기존 계정의 비밀번호·
-- 이름이 새 값으로 덮어써질 위험이 있었습니다. 그래서 "가입을 실제로 완료한 이메일"을
-- ssol_profiles에 남겨두고, 가입 폼에서 먼저 이 표를 조회해 막습니다.
-- 여러 번 실행해도 안전합니다.

alter table public.ssol_profiles
  add column if not exists email text,
  add column if not exists signup_completed_at timestamptz,
  add column if not exists nickname text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists address text;

create index if not exists ssol_profiles_email_idx on public.ssol_profiles (lower(email));

-- 가입 시 프로필에 이메일도 함께 저장하도록 트리거 갱신 (기존 name/provider 로직은 그대로 유지).
create or replace function public.ssol_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ssol_profiles (id, name, provider, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nickname'),
    new.raw_app_meta_data->>'provider',
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
