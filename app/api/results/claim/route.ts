import { NextResponse } from "next/server";
import { claimGuestRows } from "@/lib/guest/claim";
import { guestHashFrom } from "@/lib/guest/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-10-15: 로그인(가입)한 사용자가 이 브라우저에서 비회원으로 저장·결제했던 것을 자기 계정으로 가져옵니다.
// 열쇠를 가진 쪽만 가져갈 수 있고(해시 일치), 로그인이 안 되어 있으면 아무것도 하지 않습니다.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const hash = guestHashFrom(req);
  if (!hash) return NextResponse.json({ claimed: false });

  const out = await claimGuestRows(createAdminClient(), user.id, hash);
  if (out.error) console.error("비회원 데이터 가져오기 실패:", out.error);
  return NextResponse.json({ claimed: out.claimed, results: out.results, orders: out.orders });
}
