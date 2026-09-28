"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { useQuiz } from "@/lib/QuizContext";
import { DESSERT, GENDER_TITLE } from "@/lib/data";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

interface AssembledV3 {
  [key: string]: string[];
}

type LocalState = "waiting" | "ready" | "failed";

// 2026-09-28: "작성하고 있어요" 화면을 /result/report에서 별도 페이지로 뗐습니다 — 결제 후
// 바로 이 페이지로 오고, 완료되면 /result/report로 자동으로 넘어갑니다(넘어가기 전에도
// "보고서 완성!" 버튼을 눌러 바로 갈 수 있어요).
export default function ReportGeneratingPage() {
  const router = useRouter();
  const { result, savedResultId, userName, userGender } = useQuiz();
  const [state, setState] = useState<LocalState>("waiting");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  const poll = async (resultId: string) => {
    let data: { status?: string; assembled?: AssembledV3 } | null = null;
    try {
      const res = await fetch(`/api/report/generate?resultId=${resultId}`);
      if (!res.ok) return; // 타임아웃 등 — 다음 폴링에서 재시도
      data = await res.json();
    } catch {
      return; // 네트워크 오류 — 다음 폴링에서 재시도
    }
    if (data?.status === "ready" && data.assembled) {
      setState("ready");
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      // 완료 메시지를 잠깐 보여준 뒤 자동으로 리포트 화면으로 넘어갑니다.
      redirectTimer.current = setTimeout(() => router.push("/result/report"), 1600);
    } else if (data?.status === "failed") {
      setState("failed");
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    } else if (data?.status === "none") {
      // 결제 확인이 안 된 상태(예: 이 페이지로 잘못 들어온 경우) — 리포트 화면으로 돌려보냅니다.
      router.replace("/result/report");
    }
    // "generating"이면 계속 대기 — 다음 폴링에서 다시 확인합니다.
  };

  useEffect(() => {
    if (!savedResultId) {
      router.replace("/result/report");
      return;
    }
    poll(savedResultId);
    pollTimer.current = setInterval(() => poll(savedResultId), 4000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedResultId]);

  if (!result) return null;
  const { typeCode, axisScores } = result;
  const dessert = DESSERT[typeCode];
  const honorific = `${userName}${GENDER_TITLE[userGender || "none"]}님`;

  if (state === "failed") {
    return (
      <div className="card">
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
        <div className="cta">
          <p className="cta-title">리포트를 쓰는 중에 문제가 생겼어요</p>
          <p>결제는 정상 처리됐어요 — 아래 버튼으로 다시 시도해주세요.</p>
        </div>
        <button
          className="btn-lg"
          style={{ marginTop: 16 }}
          onClick={() => {
            setState("waiting");
            if (savedResultId) {
              poll(savedResultId);
              pollTimer.current = setInterval(() => poll(savedResultId), 4000);
            }
          }}
        >
          다시 시도하기
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
      <RadarChart scores={axisScores} />
      {state === "waiting" ? (
        <div className="cta">
          <p className="cta-title pulse-text">{honorific}의 심층 보고서를 작성하고 있어요...</p>
          <p>완료되면 이 화면이 저절로 넘어가요. 잠깐만 기다려주세요.</p>
        </div>
      ) : (
        <>
          <button className="btn-lg" style={{ marginTop: 20 }} onClick={() => router.push("/result/report")}>
            보고서 완성! 지금 읽어보세요
          </button>
          <p className="muted" style={{ textAlign: "center", marginTop: 8, fontSize: 12.5 }}>
            자동으로 넘어가지 않을 경우 눌러주세요.
          </p>
        </>
      )}
    </div>
  );
}
