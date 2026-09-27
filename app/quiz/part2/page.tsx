"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import { AXIS_KR, PART2_ITEMS, PART2_LABELS, PART2_ORDER, part2Intro } from "@/lib/data";
import { quizHint } from "@/lib/quizHints";
import { scorePart2, type Part2Answers } from "@/lib/scoring";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// v2 스펙 4.2, 10장 — 2부: 12문항, 빈도형 5점, 가로 1~5 숫자 그리드.
export default function Part2Page() {
  const router = useRouter();
  const { part1Answers, part1Result, confirmedAxis, setPart2Answers, setResult } = useQuiz();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => new Array(PART2_ORDER.length).fill(null));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!part1Answers || !part1Result || !confirmedAxis) router.replace("/");
  }, [part1Answers, part1Result, confirmedAxis, router]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!part1Answers || !part1Result || !confirmedAxis) return null;

  const itemId = PART2_ORDER[current];
  const item = PART2_ITEMS[itemId];

  const finish = (next: (number | null)[]) => {
    const r2: Part2Answers = {};
    PART2_ORDER.forEach((id, i) => {
      r2[id] = next[i] || 3;
    });
    setPart2Answers(r2);
    const scored = scorePart2(r2);
    if (scored.leaders.length > 1) {
      // 이 시점의 scorePart2 결과는 confirm-mode 화면에서 다시 계산하므로 여기선 answers만 저장.
      router.push("/quiz/confirm-mode");
      return;
    }
    const confirmedMode = scored.leaders[0];
    setResult({
      part1Answers,
      part2Answers: r2,
      factorScores: part1Result.factorScores,
      axisScores: part1Result.axisScores,
      confirmedAxis,
      subScores: scored.subScores,
      modeScores: scored.modeScores,
      confirmedMode,
      typeCode: `${confirmedAxis}-${confirmedMode}`,
    });
    router.push("/result");
  };

  const selectAnswer = (val: number) => {
    if (timer.current) return;
    const next = answers.slice();
    next[current] = val;
    setAnswers(next);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (current < PART2_ORDER.length - 1) {
        setCurrent(current + 1);
      } else {
        finish(next);
      }
    }, 250);
  };

  const progress = Math.round((current / PART2_ORDER.length) * 100);

  return (
    <div className="card">
      <div className="progress-wrap">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="q-index">
        2부 · 질문 {current + 1} / {PART2_ORDER.length}
      </div>
      <div className="q-text">{item.t}</div>
      <div className="likert">
        <div className="likert-labels">
          <span>← {PART2_LABELS[0]}</span>
          <span>{PART2_LABELS[PART2_LABELS.length - 1]} →</span>
        </div>
        <div className="likert-row">
          {PART2_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              className={answers[current] === i + 1 ? "selected" : undefined}
              onClick={() => selectAnswer(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      {(() => {
        const hint = quizHint(current, PART2_ORDER.length);
        return hint ? <p className="q-hint">{hint}</p> : null;
      })()}
      {current === 0 && (
        <p className="tiny" style={{ marginTop: 16 }}>
          {part2Intro(AXIS_KR[confirmedAxis])}
        </p>
      )}
    </div>
  );
}
