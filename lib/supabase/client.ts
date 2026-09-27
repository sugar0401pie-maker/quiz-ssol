import { createBrowserClient } from "@supabase/ssr";
import { sharedCookieDomain } from "./shared-cookie-domain";

// 브라우저용 클라이언트 (anon 키). 로그인/인증번호 확인에만 사용합니다.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { domain: sharedCookieDomain(typeof window !== "undefined" ? window.location.hostname : undefined) } }
  );
}
