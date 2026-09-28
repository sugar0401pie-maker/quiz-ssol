"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  kakao: "카카오 로그인 중 문제가 생겼어요. 다시 시도해주세요.",
  naver_not_configured: "네이버 로그인이 아직 설정되지 않았어요.",
  naver_state: "네이버 로그인 요청이 만료됐어요. 다시 시도해주세요.",
  naver_token: "네이버 인증에 실패했어요. 다시 시도해주세요.",
  naver_email: "네이버 계정에 이메일 제공 동의가 필요해요.",
  naver_user: "네이버 계정으로 가입하지 못했어요.",
  naver_link: "네이버 로그인 처리에 실패했어요.",
  naver_session: "네이버 로그인 세션을 만들지 못했어요.",
  naver_unknown: "네이버 로그인 중 알 수 없는 문제가 생겼어요.",
};

// useSearchParams는 Suspense 경계 안에서만 정적 렌더링과 함께 쓸 수 있어 별도 컴포넌트로 뺐습니다.
function OAuthErrorToast({ onMessage }: { onMessage: (msg: string) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    const code = params.get("error");
    if (code) onMessage(OAUTH_ERROR_MESSAGES[code] ?? "로그인 중 문제가 생겼어요. 다시 시도해주세요.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// 2026-09-25: 카카오·네이버 로그인이 아직 준비되지 않아 잠시 숨겨뒀던 플래그.
// 2026-09-28: 카카오/네이버 콘솔 설정 완료 확인 후 다시 켬.
const SOCIAL_LOGIN_ENABLED = true;

// 6. 계정 만들기 선택
export default function SignupPage() {
  const router = useRouter();
  const { result, userName, userGender, pendingAfterSignup } = useQuiz();
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  if (!result) return null;

  // 카카오/네이버는 외부 사이트로 이동했다 돌아오므로, 떠나기 직전에 지금 상태를 잠깐 담아둡니다.
  const goToOAuth = (url: string) => {
    setBusy(true);
    stashPendingQuizForOAuth({ userName, userGender, result, pendingAfterSignup });
    window.location.href = url;
  };

  const signupWithKakao = async () => {
    setBusy(true);
    stashPendingQuizForOAuth({ userName, userGender, result, pendingAfterSignup });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
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

  return (
    <div className="card">
      <Suspense fallback={null}>
        <OAuthErrorToast onMessage={setToast} />
      </Suspense>
      <button
        className="secondary"
        style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }}
        onClick={() => router.push("/result")}
      >
        ← 뒤로
      </button>
      <p className="kicker">결과 저장하기</p>
      <h1 className="serif">계정을 만들면 결과가 저장돼요</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        다음에 다시 와도 이전 결과와 리포트를 이어서 볼 수 있어요.
      </p>

      {SOCIAL_LOGIN_ENABLED && (
        <>
          <button type="button" className="signup-opt signup-kakao" onClick={signupWithKakao} disabled={busy}>
            <span>💬</span> 카카오톡 아이디로 가입 및 로그인하기
          </button>
          <button type="button" className="signup-opt signup-naver" onClick={() => goToOAuth("/api/auth/naver")} disabled={busy}>
            <span>N</span> 네이버 아이디로 가입하기
          </button>
        </>
      )}
      <button type="button" className="signup-opt signup-email" onClick={() => router.push("/signup/email")}>
        <span>✉️</span> 계정 만들어서 가입하기
      </button>

      <button
        type="button"
        className="secondary"
        style={{ marginTop: 10 }}
        onClick={() => router.push("/login")}
      >
        이미 계정이 있으신가요? 로그인
      </button>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
