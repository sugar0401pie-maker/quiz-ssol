"use client";

import { useEffect } from "react";
import { claimGuestData, getGuestKey } from "@/lib/guest/client";
import { createClient } from "@/lib/supabase/client";

// 2026-10-15: 비회원으로 저장·결제한 사람이 가입·로그인하면, 이 브라우저의 비회원 기록(결과·주문·리포트)을 그 계정으로 옮기고
// 쏘웰라 1주일 체험권을 지급합니다(lib/guest/claim.ts). 어느 화면에서 로그인했든 놓치지 않도록 전체 레이아웃에 둡니다.
// 열쇠가 없으면(비회원으로 저장한 적 없음) 아무 요청도 보내지 않습니다.
export default function GuestClaim() {
  useEffect(() => {
    const supabase = createClient();
    const run = async () => {
      if (!getGuestKey(false)) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await claimGuestData();
    };
    void run();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void run();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
