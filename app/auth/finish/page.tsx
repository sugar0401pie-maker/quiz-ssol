"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readAndClearPendingQuiz, useQuiz } from "@/lib/QuizContext";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 카카오/네이버 로그인이 끝나고 돌아오는 착지 화면.
// 세션 스토리지에 잠깐 담아뒀던 퀴즈 상태를 여기서 한 번에 복원하고, 로그인이 실제로
// 됐는지 확인해서 결과를 저장한 뒤, 원래 있던 화면으로 돌려보냅니다.
// (복원을 QuizProvider 초기 state에서 하면 서버/클라이언트 렌더링이 달라져 hydration 오류가
// 나므로, 반드시 이 페이지의 useEffect — 마운트 후 클라이언트에서만 — 에서 처리합니다.)
export default function AuthFinishPage() {
  const router = useRouter();
  const { setProfile, setResult, setSavedResultId } = useQuiz();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const pending = readAndClearPendingQuiz();
      const target = pending?.pendingAfterSignup || "/result";

      if (pending?.result) {
        if (pending.userGender) setProfile(pending.userName, pending.userGender);
        setResult(pending.result);
      }
      // 토스페이먼츠 결제처럼 "이미 저장된 결과"를 들고 나갔다가 돌아온 경우(autoSave=false)
      // savedResultId도 같이 복원해야, /result/report의 "결제 후 리포트 생성" 폴링이 이어집니다.
      if (pending?.savedResultId) {
        setSavedResultId(pending.savedResultId);
      }

      if (pending?.autoSave && pending.result) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const res = await fetch("/api/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userName: pending.userName,
              gender: pending.userGender,
              part1Answers: pending.result.part1Answers,
              part2Answers: pending.result.part2Answers,
              confirmedAxis: pending.result.confirmedAxis,
              confirmedMode: pending.result.confirmedMode,
              typeCode: pending.result.typeCode,
              axisScores: pending.result.axisScores,
              factorScores: pending.result.factorScores,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.id) setSavedResultId(data.id);
          }
        } else {
          // 로그인이 안 된 채로 여기 온 경우 (사용자가 로그인 화면에서 취소한 등) —
          // 복원할 결과가 없으면 계속 진행해도 의미가 없으니 계정 선택 화면으로 되돌립니다.
          setFailed(true);
          return;
        }
      }

      router.replace(target);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <p className="kicker kicker-sm">로그인</p>
      <h1 className="serif">{failed ? "로그인이 완료되지 않았어요" : "로그인 처리 중이에요…"}</h1>
      {failed && (
        <button className="btn-lg" style={{ marginTop: 16 }} onClick={() => router.replace("/signup")}>
          다시 시도하기
        </button>
      )}
    </div>
  );
}
