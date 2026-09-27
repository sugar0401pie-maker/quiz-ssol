import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-25: 이메일 가입 폼의 마지막 단계(비밀번호 설정 성공 직후)에서 호출합니다.
// ssol_profiles.signup_completed_at을 채워서 "이 이메일은 이미 가입을 마쳤다"는 걸 남겨두면,
// 같은 이메일로 다시 가입을 시도할 때 /api/auth/check-email에서 막을 수 있습니다.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { nickname?: string; marketingConsent?: boolean; address?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    // 바디 없이 호출해도 괜찮습니다 — 닉네임/마케팅 동의는 선택값입니다.
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("ssol_profiles")
    .update({
      email: user.email,
      signup_completed_at: new Date().toISOString(),
      nickname: body?.nickname?.trim() || null,
      marketing_consent: !!body?.marketingConsent,
      address: body?.address?.trim().slice(0, 200) || null,
    })
    .eq("id", user.id);
  if (error) {
    console.error("가입 완료 표시 실패:", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
