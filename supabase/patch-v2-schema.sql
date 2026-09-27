-- final-ssol-wellness-v2-master-spec.md 반영 — v1(5영역·직면/회피·10~20유형)에서
-- v2(5영역·3대처방식·15유형, CAR/LOV/REL/SLF/DIR × primary/secondary/disengage)로 전면 개편.
-- 기존에 저장된 v1 결과 행은 새 구조와 호환되지 않습니다(문항 자체가 20개→33개로 바뀜).
-- 이 앱은 아직 초기 단계라 기존 행을 유지할 실익이 없다고 보고 삭제 후 재구성합니다.
-- 만약 기존 데이터를 보존해야 한다면 이 스크립트를 실행하기 전에 별도로 백업해두세요.

-- 1) 기존 결과에 딸린 하위 데이터부터 정리 (FK 순서상 자식 테이블 먼저)
delete from public.ssol_chat_messages;
delete from public.ssol_chat_passes;
delete from public.ssol_reports;
delete from public.ssol_orders;
delete from public.ssol_quiz_results;

-- 2) ssol_quiz_results: v1 컬럼(answers: smallint[20], domain_scores) → v2 구조로 교체
alter table public.ssol_quiz_results drop constraint if exists ssol_quiz_results_type_key_check;
alter table public.ssol_quiz_results drop column if exists answers;
alter table public.ssol_quiz_results drop column if exists domain_scores;

alter table public.ssol_quiz_results
  add column if not exists part1_answers jsonb not null default '{}'::jsonb,  -- {P01:1..5, ...} 21개
  add column if not exists part2_answers jsonb not null default '{}'::jsonb,  -- {Q01:1..5, ...} 12개
  add column if not exists axis_scores   jsonb not null default '{}'::jsonb,  -- {CAR:.., LOV:.., REL:.., SLF:.., DIR:..} 1~5
  add column if not exists factor_scores jsonb not null default '{}'::jsonb,  -- 10개 하위요인 점수
  add column if not exists sub_scores    jsonb not null default '{}'::jsonb,  -- 6개 대처 하위요인 점수
  add column if not exists mode_scores   jsonb not null default '{}'::jsonb;  -- {primary:.., secondary:.., disengage:..}

alter table public.ssol_quiz_results
  add constraint ssol_quiz_results_type_key_check
  check (type_key ~ '^(CAR|LOV|REL|SLF|DIR)-(primary|secondary|disengage)$');

-- 3) ssol_orders: v1의 생활영역 태그 컬럼 제거 (v2 리포트는 결정론적 조립이라 태그 선택 단계가 없음)
alter table public.ssol_orders drop column if exists life_domain_tags;

-- 4) ssol_reports: v1의 AI 생성 결과(sections: [{title,body}] x8) → v2 결정론적 조립 결과로 교체
alter table public.ssol_reports drop column if exists sections;
alter table public.ssol_reports drop column if exists model;
alter table public.ssol_reports
  add column if not exists assembled jsonb; -- { section2, section3, section4, section5, section6:[], section7 }

-- 5) 참고용 콘텐츠 테이블(v1 10~20유형)은 더 이상 최신이 아니므로 삭제합니다.
--    v2는 lib/data.ts의 DESSERT/DESSERT_FAMILY를 그대로 쓰고, 별도 DB 테이블을 두지 않습니다.
drop table if exists public.ssol_dessert_types;
