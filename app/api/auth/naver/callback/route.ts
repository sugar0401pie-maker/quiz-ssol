import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { sharedCookieDomain } from "@/lib/supabase/shared-cookie-domain";

// 네이버 로그인 2단계 — 코드를 토큰으로 바꾸고, 프로필을 조회해서
// Supabase 사용자로 만들거나 찾은 뒤 로그인 세션을 발급합니다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = cookies();
  const savedState = store.get("naver_oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/signup?error=naver_state", origin));
  }

  try {
    // 1) 코드 → 액세스 토큰
    const tokenRes = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.NAVER_CLIENT_ID!,
        client_secret: process.env.NAVER_CLIENT_SECRET!,
        code,
        state,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      console.error("네이버 토큰 교환 실패:", tokenJson);
      return NextResponse.redirect(new URL("/signup?error=naver_token", origin));
    }

    // 2) 액세스 토큰 → 프로필
    const meRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const me = await meRes.json();
    const email: string | undefined = me?.response?.email;
    const name: string | undefined = me?.response?.name ?? me?.response?.nickname;
    if (!email) {
      // 네이버 앱의 "제공 정보" 설정에 이메일이 필수로 체크돼있지 않으면 여기로 옵니다.
      return NextResponse.redirect(new URL("/signup?error=naver_email", origin));
    }

    // 3) Supabase 사용자 확보 (이미 있으면 그대로, 없으면 생성)
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { provider: "naver" },
    });
    if (createError && !createError.message.includes("already been registered")) {
      console.error("네이버 사용자 생성 실패:", createError.message);
      return NextResponse.redirect(new URL("/signup?error=naver_user", origin));
    }
    const userId = created?.user?.id;

    // 4) 매직링크를 서버에서 직접 검증해서 로그인 세션 발급 (사용자에게 메일이 가지 않음)
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      console.error("네이버 로그인 링크 생성 실패:", linkError?.message);
      return NextResponse.redirect(new URL("/signup?error=naver_link", origin));
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { domain: sharedCookieDomain(url.hostname) },
        cookies: {
          getAll: () => store.getAll(),
          setAll: (list) => list.forEach(({ name: n, value, options }) => store.set(n, value, options)),
        },
      }
    );
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    });
    if (verifyError) {
      console.error("네이버 로그인 세션 발급 실패:", verifyError.message);
      return NextResponse.redirect(new URL("/signup?error=naver_session", origin));
    }

    // profiles.provider 는 auth.users 트리거가 app_metadata.provider 로 자동 채웁니다 (신규 가입 시).
    void userId;

    const res = NextResponse.redirect(new URL("/auth/finish", origin));
    res.cookies.delete("naver_oauth_state");
    return res;
  } catch (err) {
    console.error("네이버 로그인 처리 중 오류:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/signup?error=naver_unknown", origin));
  }
}
