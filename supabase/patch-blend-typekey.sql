-- 20type-expansion-spec.md 반영: typeKey에 "_blend" 접미사(혼합형 10종)가 붙을 수 있도록
-- ssol_quiz_results.type_key의 형식 제약을 완화합니다.
-- 이 패치를 실행하지 않으면, 혼합형(gap < 4)으로 판정된 사용자의 결과 저장이 전부 실패합니다.
alter table public.ssol_quiz_results drop constraint if exists ssol_quiz_results_type_key_check;
alter table public.ssol_quiz_results
  add constraint ssol_quiz_results_type_key_check
  check (type_key ~ '^(relate|worth|control|happy|meaning)_(F|E)(_blend)?$');
