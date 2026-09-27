import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { sharedCookieDomain } from "./shared-cookie-domain";

// 서버(Route Handler)용 클라이언트. 쿠키의 로그인 세션으로 "누가 요청했는지" 확인할 때 사용합니다.
export function createClient() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain: sharedCookieDomain(headers().get("host")) },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server Component 에서 호출된 경우 무시 (middleware 가 세션을 갱신합니다)
          }
        },
      },
    }
  );
}
