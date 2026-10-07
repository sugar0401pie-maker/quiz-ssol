"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useQuiz } from "@/lib/QuizContext";
import { trackQuizEvent } from "@/lib/trackQuizEvent";
import { MODE_CONFIRM_OPTIONS, MODE_CONFIRM_QUESTION, MODE_ORDER, type ModeKey } from "@/lib/data";
import { scorePart2 } from "@/lib/scoring";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// v2 스펙 4.4, 10장 — 2부 종료 후 대처방식 확인 화면. 동점일 때만 나옵니다.
export default function ConfirmModePage() {
  const router = useRouter();
  const { part1Answers, part1Result, confirmedAxis, part2Answers, setResult } = useQuiz();

  const scored = useMemo(() => (part2Answers ? scorePart2(part2Answers) : null), [part2Answers]);

  useEffect(() => {
    if (!part1Answers || !part1Result || !confirmedAxis || !part2Answers || !scored) {
      router.replace("/");
    }
  }, [part1Answers, part1Result, confirmedAxis, part2Answers, scored, router]);

  if (!part1Answers || !part1Result || !confirmedAxis || !part2Answers || !scored) return null;

  const choose = (mode: ModeKey) => {
    setResult({
      part1Answers,
      part2Answers,
      factorScores: part1Result.factorScores,
      axisScores: part1Result.axisScores,
      confirmedAxis,
      subScores: scored.subScores,
      modeScores: scored.modeScores,
      confirmedMode: mode,
      typeCode: `${confirmedAxis}-${mode}`,
    });
    trackQuizEvent("complete", `${confirmedAxis}-${mode}`);
    router.push("/result");
  };

  return (
    <div className="card">
      <p className="kicker kicker-sm">잠깐 확인할게요</p>
      <h1 className="serif">{MODE_CONFIRM_QUESTION}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MODE_ORDER.filter((m) => scored.leaders.includes(m)).map((mode) => (
          <button key={mode} className="secondary" style={{ textAlign: "left" }} onClick={() => choose(mode)}>
            {MODE_CONFIRM_OPTIONS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
