"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 2026-09-30: "로그아웃 버튼이 화면마다 다른 자리에 있다"는 피드백 — /result 페이지 안에만
// 있던 로그아웃 버튼을 걷어내고, 모든 화면에서 항상 브랜드 푸터("by 쏠 웰니스 하우스")
// 바로 위, 같은 자리에 뜨도록 루트 레이아웃으로 옮겼다.
// 2026-09-30 수정: 로그인 상태일 때만 렌더링하고 로그아웃하면 사라지게 했더니 "로그아웃
// 하고 나면 버튼 자체가 없어진다"는 피드백 — 같은 자리에서 로그인/로그아웃 상태에 맞게
// 문구와 동작만 바뀌도록 고쳤다(로그아웃 상태에선 "로그인"을 누르면 /login으로 이동).
export default function AuthFooterLink() {
  const router = useRouter();
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

  if (!authChecked) return null;

  return (
    <p style={{ textAlign: "center", margin: "0 0 10px" }}>
      {isLoggedIn ? (
        <button type="button" className="text-link" onClick={handleLogout}>
          로그아웃
        </button>
      ) : (
        <button type="button" className="text-link" onClick={() => router.push("/login")}>
          로그인
        </button>
      )}
      {toast && <span className="tiny" style={{ display: "block", marginTop: 4 }}>{toast}</span>}
    </p>
  );
}
