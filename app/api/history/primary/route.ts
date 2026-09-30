import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-30: "지난 테스트 결과 열람하기" 목록에서 "대표 유형으로 설정" 버튼용. profiles.
// primary_quiz_result_id는 app.ssolwellnesshouse.com(홈 탭·채팅 개인화)이 읽는 값과 같은
// 컬럼이라, 여기서 바꾸면 그 앱에도 그대로 반영됩니다(같은 Supabase 프로젝트 공유).
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("id, user_id")
    .eq("id", resultId)
    .single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }

  // profiles 행이 아직 없는 사용자(app.ssol을 한 번도 안 써본 경우)도 있으므로 upsert합니다 —
  // 다른 컬럼은 건드리지 않고 primary_quiz_result_id만 지정합니다.
  const { error } = await admin
    .from("profiles")
    .upsert({ user_id: user.id, primary_quiz_result_id: resultId }, { onConflict: "user_id" });
  if (error) {
    console.error("대표 유형 설정 실패:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
