"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
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
  const { result, userName, userGender, setProfile, setResult, setSavedResultId, pendingAfterSignup, setPendingAfterSignup, reset } =
    useQuiz();
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNoResultModal, setShowNoResultModal] = useState(false);

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

  // 2026-09-28: "로그인 화면에 카카오 로그인 버튼 없다" 요청 — /signup의 카카오 버튼과
  // 같은 방식(Supabase OAuth)입니다. 카카오/네이버는 버튼을 다시 누르면 그 자체로 로그인이
  // 되므로, 이메일/비밀번호 입력 없이 바로 이 흐름을 탑니다.
  const loginWithKakao = async () => {
    setBusy(true);
    stashPendingQuizForOAuth({ userName, userGender, result, pendingAfterSignup });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      console.error("카카오 로그인 시작 실패:", error.message);
      setBusy(false);
      setToast("카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
    // 성공하면 supabase가 알아서 카카오 페이지로 이동시킵니다.
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
          setShowNoResultModal(true);
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

      <p className="muted" style={{ textAlign: "center", fontSize: 12.5, margin: "16px 0 10px" }}>또는</p>
      <button type="button" className="signup-opt signup-kakao" onClick={loginWithKakao} disabled={busy}>
        <span>💬</span> 카카오로 로그인하기
      </button>

      {/* 2026-09-28: 테스트를 안 본 채로(홈 "로그인하기"로) 들어온 경우에도 회원가입 경로가
          보여야 해서, result 유무와 상관없이 항상 노출합니다. */}
      <button
        type="button"
        className="secondary"
        style={{ marginTop: 10 }}
        onClick={() => router.push("/signup/email")}
      >
        계정이 없으신가요? 회원가입하기
      </button>

      {toast && <div className="toast">{toast}</div>}

      {showNoResultModal && (
        <div className="confirm-overlay">
          <div className="confirm-box" style={{ position: "relative" }}>
            <button
              type="button"
              className="secondary"
              aria-label="닫기"
              onClick={() => setShowNoResultModal(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                fontSize: 16,
                lineHeight: 1,
                color: "var(--text3)",
              }}
            >
              ✕
            </button>
            <p className="confirm-msg">테스트를 보셔야 마이페이지로 갈 수 있어요. 먼저 테스트를 보고 와주세요. 5분밖에 안 걸려요!</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setShowNoResultModal(false)}>
                다음에 할래요
              </button>
              <button
                onClick={() => {
                  setShowNoResultModal(false);
                  reset();
                  router.push("/start");
                }}
              >
                테스트 하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
