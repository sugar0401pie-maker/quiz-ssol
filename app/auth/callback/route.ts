import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sharedCookieDomain } from "@/lib/supabase/shared-cookie-domain";

// 카카오 로그인(Supabase 기본 제공) 콜백. code를 세션으로 교환하고, 화면 쪽 상태 복원은
// /auth/finish 에서 처리합니다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const store = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { domain: sharedCookieDomain(url.hostname) },
        cookies: {
          getAll: () => store.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("카카오 로그인 코드 교환 실패:", error.message);
      return NextResponse.redirect(new URL("/signup?error=kakao", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/auth/finish", url.origin));
}
