import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 2026-09-25: /signup/email 에서 "인증번호 받기"를 누르기 전에 먼저 이 이메일로 이미 가입을
// 완료한 계정이 있는지 확인합니다. (signup_completed_at이 채워진 행만 "이미 가입됨"으로 봅니다 —
// 인증만 시작하고 끝내지 않은 이메일은 다시 시도할 수 있어야 하니까요.)
export async function POST(req: Request) {
  let body: { email?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = body?.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ssol_profiles")
    .select("id")
    .ilike("email", email)
    .not("signup_completed_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("이메일 중복확인 실패:", error.message);
    // 확인 자체가 실패했을 땐 가입을 막지 않습니다 — 최종 안전판은 completeSignup 쪽에 있습니다.
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({ exists: !!data });
}
