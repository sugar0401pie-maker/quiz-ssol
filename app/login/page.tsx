"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import type { Gender } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 이미 이메일 계정이 있는 사용자를 위한 로그인 화면.
// (카카오·네이버는 버튼을 다시 누르면 그 자체로 로그인이 되므로 별도 로그인 화면이 필요 없습니다.)
//
// 2026-09-25: 두 가지 경로로 들어올 수 있습니다.
// 1) 방금 테스트를 마친 뒤 결과를 저장하려고(result가 Context에 있음) — 로그인 후 그 결과를 저장.
// 2) 첫 화면의 "이미 테스트를 보셨다면 로그인하기"로 바로 들어온 경우(result 없음) — 로그인 후
//    서버에 저장돼 있던 가장 최근 결과를 불러와 이어서 보여줍니다.
export default function LoginPage() {
  const router = useRouter();
  const { result, userName, userGender, setProfile, setResult, setSavedResultId, pendingAfterSignup, setPendingAfterSignup } =
    useQuiz();
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    router.prefetch("/result");
  }, [router]);

  const saveResult = async () => {
    if (!result) return false;
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName,
        gender: userGender,
        part1Answers: result.part1Answers,
        part2Answers: result.part2Answers,
        confirmedAxis: result.confirmedAxis,
        confirmedMode: result.confirmedMode,
        typeCode: result.typeCode,
        axisScores: result.axisScores,
        factorScores: result.factorScores,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.id) setSavedResultId(data.id);
    return true;
  };

  // result가 없는 채로 로그인한 경우 — 서버에 저장된 가장 최근 결과를 불러옵니다.
  const loadLatestSavedResult = async (): Promise<"loaded" | "none" | "error"> => {
    const res = await fetch("/api/results");
    if (res.status === 404) return "none";
    if (!res.ok) return "error";
    const data = await res.json();
    setProfile(data.userName, data.gender as Gender);
    setResult({
      part1Answers: data.part1Answers,
      part2Answers: data.part2Answers,
      factorScores: data.factorScores,
      axisScores: data.axisScores,
      confirmedAxis: data.confirmedAxis,
      subScores: data.subScores,
      modeScores: data.modeScores,
      confirmedMode: data.confirmedMode,
      typeCode: data.typeCode,
    });
    setSavedResultId(data.id);
    return "loaded";
  };

  // 2026-09-28: "비밀번호 찾기가 없다"는 지적 — Supabase의 비밀번호 재설정 이메일을 보내고,
  // 그 메일의 링크는 /reset-password로 연결해서 거기서 새 비밀번호를 정하게 합니다.
  const sendPasswordReset = async () => {
    const email = contact.trim();
    if (!email || !email.includes("@")) {
      setToast("이메일 주소를 먼저 입력해주세요.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      console.error("비밀번호 재설정 메일 발송 실패:", error.message);
      setToast("메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setToast("비밀번호 재설정 메일을 보냈어요. 메일함을 확인해주세요.");
  };

  const login = async () => {
    if (!contact.trim() || !password.trim()) {
      setToast("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: contact.trim(),
        password: password.trim(),
      });
      if (error) {
        console.error("로그인 실패:", error.message);
        setToast("이메일 또는 비밀번호가 올바르지 않아요.");
        return;
      }

      if (result) {
        // 방금 테스트를 마친 경우 — 이번 결과를 저장하고 원래 가려던 곳으로.
        const saved = await saveResult(); // 실패해도 로그인 자체는 진행
        const nextPath = pendingAfterSignup ?? "/result";
        setPendingAfterSignup(null);
        router.push(saved && nextPath === "/result" ? "/result?saved=1" : nextPath);
      } else {
        // 첫 화면에서 바로 로그인한 경우 — 저장돼 있던 마지막 결과를 불러옵니다.
        const outcome = await loadLatestSavedResult();
        if (outcome === "loaded") {
          router.push("/result");
        } else if (outcome === "none") {
          setToast("아직 저장된 결과가 없어요. 테스트를 먼저 진행해주세요.");
          setTimeout(() => router.push("/"), 1400);
        } else {
          setToast("결과를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <button
        className="secondary"
        style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }}
        onClick={() => router.push(result ? "/signup" : "/")}
      >
        ← 뒤로
      </button>
      <p className="kicker">로그인</p>
      <h1 className="serif">다시 오셨네요</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {result ? "기존 계정으로 로그인하면 이번 결과도 함께 저장돼요." : "로그인하면 저장해둔 마지막 결과를 이어서 볼 수 있어요."}
      </p>

      <p className="field-label" style={{ marginTop: 0 }}>이메일</p>
      <input
        type="text"
        className="text-input"
        placeholder="가입할 때 쓴 이메일 주소"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />

      <p className="field-label">비밀번호</p>
      <input
        type="password"
        className="text-input"
        placeholder="비밀번호를 입력해주세요"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button type="button" className="btn-lg" style={{ marginTop: 16 }} onClick={login} disabled={busy}>
        로그인
      </button>
      <button type="button" className="text-link" style={{ display: "block", margin: "10px auto 0" }} onClick={sendPasswordReset} disabled={busy}>
        비밀번호를 잊으셨나요?
      </button>
      {result && (
        <button
          type="button"
          className="secondary"
          style={{ marginTop: 10 }}
          onClick={() => router.push("/signup/email")}
        >
          계정이 없으신가요? 계정 만들기
        </button>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
