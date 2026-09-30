"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 2026-09-30: "로그아웃 버튼이 화면마다 다른 자리에 있다"는 피드백 — /result 페이지 안에만
// 있던 로그아웃 버튼을 걷어내고, 로그인 상태일 때 모든 화면에서 항상 브랜드 푸터("by 쏠
// 웰니스 하우스") 바로 위, 같은 자리에 뜨도록 루트 레이아웃으로 옮겼다.
export default function AuthFooterLink() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setIsLoggedIn(!!user);
        setAuthChecked(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setToast("로그아웃했어요.");
  };

  if (!authChecked || !isLoggedIn) return null;

  return (
    <p style={{ textAlign: "center", margin: "0 0 10px" }}>
      <button type="button" className="text-link" onClick={handleLogout}>
        로그아웃
      </button>
      {toast && <span className="tiny" style={{ display: "block", marginTop: 4 }}>{toast}</span>}
    </p>
  );
}
