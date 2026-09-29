"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { useQuiz } from "@/lib/QuizContext";
import { DESSERT } from "@/lib/data";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

type LocalState = "waiting" | "ready";

// 2026-09-29: "작성하고 있어요..." 한 문구만 계속 떠 있으면 실제로 얼마나 진행됐는지 알 수
// 없어 더 오래 걸리는 것처럼 느껴진다는 피드백 — 경과 시간에 따라 문구가 단계적으로
// 바뀌도록 했습니다. 60초를 넘기면(생성이 유독 오래 걸리는 케이스) 지연을 인정하는
// 문구로 바뀝니다.
function waitingMessage(elapsedSec: number, dessertName: string): string {
  if (elapsedSec < 10) return "당신의 답변을 하나씩 살펴보고 있어요....";
  if (elapsedSec < 25) return `${dessertName}만의 레시피를 쓰는 중이에요....`;
  if (elapsedSec < 40) return "오븐에 천천히 굽고 있어요 — 좋은 건 원래 좀 걸려요.....";
  if (elapsedSec < 60) return "마지막으로 예쁘게 플레이팅하는 중이에요, 조금만 더요.....";
  return "정성 들이느라 평소보다 조금 늦어지고 있어요. 곧 나와요!";
}

// 2026-09-28: "작성하고 있어요" 화면을 /result/report에서 별도 페이지로 뗐습니다 — 결제 후
// 바로 이 페이지로 오고, 완료되면 완성된 리포트 전용 페이지(/result/report/view)로
// 자동으로 넘어갑니다("보고서 완성!" 버튼으로 바로 갈 수도 있어요). 실패하면 그 상태도
// 전용 페이지(/result/report/failed)로 보냅니다 — 이 페이지 안에서 중복으로 다루지 않습니다.
export default function ReportGeneratingPage() {
  const router = useRouter();
  const { result, savedResultId } = useQuiz();
  const [state, setState] = useState<LocalState>("waiting");
  const [elapsedSec, setElapsedSec] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  useEffect(() => {
    if (state !== "waiting") return;
    const tick = () => setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state]);

  const poll = async (resultId: string) => {
    let data: { status?: string } | null = null;
    try {
      const res = await fetch(`/api/report/generate?resultId=${resultId}`);
      if (!res.ok) return; // 타임아웃 등 — 다음 폴링에서 재시도
      data = await res.json();
    } catch {
      return; // 네트워크 오류 — 다음 폴링에서 재시도
    }
    if (data?.status === "ready") {
      setState("ready");
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      // 완료 메시지를 잠깐 보여준 뒤 자동으로 완성된 리포트 페이지로 넘어갑니다.
      redirectTimer.current = setTimeout(() => router.push("/result/report/view"), 1600);
    } else if (data?.status === "failed") {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      router.replace("/result/report/failed");
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

  return (
    <div className="card">
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
      <RadarChart scores={axisScores} />
      {state === "waiting" ? (
        <div className="cta">
          <p className="cta-title pulse-text">{waitingMessage(elapsedSec, dessert.name)}</p>
          <p>완료되면 이 화면이 저절로 넘어가요. 잠깐만 기다려주세요.</p>
        </div>
      ) : (
        <>
          <button className="btn-lg" style={{ marginTop: 20 }} onClick={() => router.push("/result/report/view")}>
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
