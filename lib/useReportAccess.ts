"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { guestHeaders } from "@/lib/guest/client";
import type { GeneratedSectionsV3 } from "@/lib/reportV3/types";

// 2026-10-15: 스와이프 결과 화면(app/result/page.tsx)이 "이 결과의 심층 리포트가 결제됐는지·만들어졌는지"를 알기 위한 훅.
// 예전에는 /result/report(확인) → /generating(대기) → /view(열람) 별도 페이지로 나뉘어 있던 상태를 한곳에 모았습니다.
//   checking   : 서버 확인 중(결제 버튼을 보여주지 않음 — 결제한 사람에게 결제 버튼이 잠깐 뜨는 이중결제 위험 방지)
//   locked     : 서버가 "결제된 주문 없음"을 확인해 준 경우에만
//   generating : 결제 완료, 리포트 작성 중
//   ready      : 완성(assembled 사용 가능)
//   failed     : 작성 실패(결제는 정상 — 다시 시도 가능)
export type ReportPhase = "checking" | "locked" | "generating" | "ready" | "failed";

const POLL_MS = 4000;

export function useReportAccess(savedResultId: string | null, enabled: boolean) {
  const [phase, setPhase] = useState<ReportPhase>("checking");
  const [assembled, setAssembled] = useState<GeneratedSectionsV3 | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0); // refresh()가 올려서 확인을 처음부터 다시 시작

  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) return;
    if (!savedResultId) {
      // 서버에 저장된 결과가 아직 없으면 결제된 주문도 있을 수 없습니다.
      setPhase("locked");
      return;
    }
    let cancelled = false;
    const check = async () => {
      let data: { status?: string; assembled?: GeneratedSectionsV3 } | null = null;
      try {
        const res = await fetch(`/api/report/generate?resultId=${savedResultId}`, { headers: guestHeaders(false) });
        if (!res.ok) return; // 타임아웃 등 — 다음 확인 때 다시
        data = await res.json();
      } catch {
        return; // 네트워크 오류 — 다음 확인 때 다시
      }
      if (cancelled) return;
      if (data?.status === "ready" && data.assembled) {
        setAssembled(data.assembled);
        setPhase("ready");
        stop();
      } else if (data?.status === "generating") {
        setPhase("generating");
      } else if (data?.status === "failed") {
        setPhase("failed");
        stop();
      } else if (data?.status === "none") {
        setPhase("locked");
        stop();
      }
    };
    setPhase((p) => (p === "ready" ? p : "checking"));
    check();
    timer.current = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [savedResultId, enabled, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { phase, assembled, refresh };
}
