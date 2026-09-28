"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

const SPECIAL_CHAR_RE = /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\/;']/;

interface PasswordChecks {
  length: boolean;
  upper: boolean;
  special: boolean;
}
function checkPassword(pw: string): PasswordChecks {
  return { length: pw.length >= 8, upper: /[A-Z]/.test(pw), special: SPECIAL_CHAR_RE.test(pw) };
}

// 2026-09-28: /login의 "비밀번호를 잊으셨나요?" 메일 링크가 도착하는 화면.
// Supabase가 메일 링크의 회복 토큰으로 이 페이지에 임시 세션을 만들어주면, 그 세션으로
// auth.updateUser({ password })를 호출해 새 비밀번호를 정합니다.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // 메일 링크로 들어오면 Supabase SDK가 URL의 회복 토큰을 읽어 PASSWORD_RECOVERY 이벤트를
    // 한 번 보내줍니다. 이미 처리된 뒤(마운트가 늦은 경우)일 수도 있어 getSession도 같이 봅니다.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) setReady(true);
      else setTimeout(() => setInvalidLink((prev) => prev || !session), 2500);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  const pwChecks = checkPassword(password);
  const pwValid = pwChecks.length && pwChecks.upper && pwChecks.special;

  const submit = async () => {
    if (!pwValid) {
      setToast("비밀번호 조건을 모두 만족해주세요.");
      return;
    }
    if (password !== confirmPassword) {
      setToast("비밀번호가 서로 달라요. 다시 확인해주세요.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      console.error("비밀번호 변경 실패:", error.message);
      setToast("비밀번호를 바꾸지 못했어요. 링크가 만료됐을 수 있어요 — 다시 요청해주세요.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="card">
        <p className="kicker">비밀번호 변경</p>
        <h1 className="serif">바뀌었어요!</h1>
        <p className="muted" style={{ marginBottom: 24 }}>새 비밀번호로 다시 로그인해주세요.</p>
        <button className="btn-lg" onClick={() => router.push("/login")}>
          로그인하러 가기
        </button>
      </div>
    );
  }

  if (invalidLink && !ready) {
    return (
      <div className="card">
        <p className="kicker">비밀번호 변경</p>
        <h1 className="serif">링크가 유효하지 않아요</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          메일의 재설정 링크가 만료됐거나 이미 사용됐을 수 있어요. 로그인 화면에서 다시 요청해주세요.
        </p>
        <button className="btn-lg" onClick={() => router.push("/login")}>
          로그인 화면으로
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="kicker">비밀번호 변경</p>
      <h1 className="serif">새 비밀번호를 정해주세요</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {ready ? "새로 쓸 비밀번호를 입력해주세요." : "링크를 확인하는 중이에요…"}
      </p>

      <p className="field-label">새 비밀번호</p>
      <input
        type="password"
        className="text-input"
        placeholder="새 비밀번호를 입력해주세요"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={!ready}
      />
      <ul style={{ listStyle: "none", padding: 0, margin: "6px 2px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        <li className="tiny" style={{ color: pwChecks.length ? "var(--navy-soft)" : "var(--text3)" }}>
          {pwChecks.length ? "✓" : "○"} 8자 이상
        </li>
        <li className="tiny" style={{ color: pwChecks.upper ? "var(--navy-soft)" : "var(--text3)" }}>
          {pwChecks.upper ? "✓" : "○"} 대문자 1자 이상
        </li>
        <li className="tiny" style={{ color: pwChecks.special ? "var(--navy-soft)" : "var(--text3)" }}>
          {pwChecks.special ? "✓" : "○"} 특수문자 1자 이상
        </li>
      </ul>

      <p className="field-label">새 비밀번호 확인</p>
      <input
        type="password"
        className="text-input"
        placeholder="새 비밀번호를 다시 입력해주세요"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={!ready}
      />

      <button type="button" className="btn-lg" style={{ marginTop: 16 }} onClick={submit} disabled={!ready || busy}>
        비밀번호 바꾸기
      </button>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
