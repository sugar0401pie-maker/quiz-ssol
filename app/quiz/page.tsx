"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import { PART1_INTRO, PART1_ITEMS, PART1_LABELS, PART1_ORDER } from "@/lib/data";
import { quizHint } from "@/lib/quizHints";
import { scorePart1, type Part1Answers } from "@/lib/scoring";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// v2 스펙 4.1, 10장 — 1부: 21문항, 동의형 5점, 세로 버튼 목록.
export default function Part1Page() {
  const router = useRouter();
  const { userName, userGender, title, setPart1 } = useQuiz();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => new Array(PART1_ORDER.length).fill(null));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userName || !userGender) router.replace("/");
  }, [userName, userGender, router]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!userName || !userGender) return null;

  const itemId = PART1_ORDER[current];
  const item = PART1_ITEMS[itemId];

  const selectAnswer = (val: number) => {
    if (timer.current) return;
    const next = answers.slice();
    next[current] = val;
    setAnswers(next);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (current < PART1_ORDER.length - 1) {
        setCurrent(current + 1);
      } else {
        const r: Part1Answers = {};
        PART1_ORDER.forEach((id, i) => {
          r[id] = next[i] || 3;
        });
        const scored = scorePart1(r);
        setPart1(r, scored);
        router.push("/quiz/confirm-axis");
      }
    }, 250);
  };

  const progress = Math.round((current / PART1_ORDER.length) * 100);

  const goBack = () => {
    if (current === 0) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setCurrent(current - 1);
  };

  const canGoForward = current < PART1_ORDER.length - 1 && answers[current] != null;
  const goForward = () => {
    if (!canGoForward) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setCurrent(current + 1);
  };

  return (
    <div className="card">
      <div className="progress-wrap">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      {(current > 0 || canGoForward) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {current > 0 && (
            <button className="secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }} onClick={goBack}>
              ← 이전 질문
            </button>
          )}
          {current < PART1_ORDER.length - 1 && (
            <button
              className="secondary"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12, opacity: canGoForward ? 1 : 0.4 }}
              onClick={goForward}
              disabled={!canGoForward}
            >
              다음 질문 →
            </button>
          )}
        </div>
      )}
      <div className="q-index">
        1부 · 질문 {current + 1} / {PART1_ORDER.length}
        {title ? ` · ${userName} ${title}님은` : ""}
      </div>
      <div className="q-text">{item.t}</div>
      <div className="likert">
        <div className="likert-labels">
          <span>← {PART1_LABELS[0]}</span>
          <span>{PART1_LABELS[PART1_LABELS.length - 1]} →</span>
        </div>
        <div className="likert-row">
          {PART1_LABELS.map((label, i) => (
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
        const hint = quizHint(current, PART1_ORDER.length);
        return hint ? <p className="q-hint">{hint}</p> : null;
      })()}
      {current === 0 && <p className="tiny" style={{ marginTop: 16 }}>{PART1_INTRO}</p>}
    </div>
  );
}
