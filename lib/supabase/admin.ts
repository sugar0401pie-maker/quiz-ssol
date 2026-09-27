import "server-only";
import { createClient } from "@supabase/supabase-js";

// service_role 키를 쓰는 관리자 클라이언트. RLS 를 우회하므로 반드시 서버에서만 import 하세요.
// (server-only 패키지가 브라우저 번들에 포함되는 것을 빌드 단계에서 막아 줍니다.)
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
