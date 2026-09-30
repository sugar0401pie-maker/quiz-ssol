import { NextResponse } from "next/server";
import { DESSERT, type TypeCode } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-30: "지난 테스트 결과 열람하기" 화면용 — 로그인한 사용자가 그동안 저장한 테스트
// 응시 기록을 전부 훑어보고, 각각 언제 봤는지·무슨 유형이었는지·심층보고서가 있는지를
// 확인할 수 있게 합니다.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const admin = createAdminClient();
  const { data: results, error } = await admin
    .from("ssol_quiz_results")
    .select("id, type_key, created_at, special_key")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("응시 기록 조회 실패:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  if (!results || results.length === 0) return NextResponse.json({ items: [] });

  const resultIds = results.map((r) => r.id);
  const [{ data: reports }, { data: profile }] = await Promise.all([
    admin.from("ssol_reports").select("result_id").in("result_id", resultIds).eq("status", "ready"),
    admin.from("profiles").select("primary_quiz_result_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const reportedResultIds = new Set((reports ?? []).map((r) => r.result_id));

  // 2026-09-30: "대표 유형" 개념은 app.ssolwellnesshouse.com(홈/채팅 개인화)이 profiles.
  // primary_quiz_result_id로 이미 쓰고 있습니다 — 같은 Supabase 프로젝트를 공유하므로, 여기서
  // 사용자가 고르면 그 앱에도 그대로 반영됩니다. 명시적으로 고른 적이 없으면(무효한 값 포함)
  // 그 앱과 같은 규칙으로 최신 기록이 기본 대표입니다.
  const validPrimaryId = results.some((r) => r.id === profile?.primary_quiz_result_id) ? profile?.primary_quiz_result_id : null;
  const effectivePrimaryId = validPrimaryId ?? results[0].id;

  const items = results.map((r) => ({
    resultId: r.id,
    createdAt: r.created_at,
    typeCode: r.special_key ? null : (r.type_key as TypeCode),
    dessertName: r.special_key ? null : DESSERT[r.type_key as TypeCode]?.name ?? null,
    hasReport: reportedResultIds.has(r.id),
    isPrimary: r.id === effectivePrimaryId,
  }));

  return NextResponse.json({ items });
}
