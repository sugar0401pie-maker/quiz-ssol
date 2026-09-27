-- 이미 schema.sql 을 실행한 프로젝트에 권한만 추가하는 패치 (여러 번 실행해도 안전)
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
