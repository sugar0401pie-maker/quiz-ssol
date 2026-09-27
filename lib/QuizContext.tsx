"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { GENDER_TITLE, type AxisKey, type Gender } from "./data";
import type { Part1Answers, Part2Answers, QuizResultV2, ScorePart1Result } from "./scoring";

interface QuizState {
  userName: string;
  userGender: Gender | "";
  result: QuizResultV2 | null;
  /** "{이름} {호칭}님" 형태 (호칭이 없으면 빈 문자열) */
  title: string;
  /** ssol_quiz_results 에 저장된 뒤 받은 id. 심층 리포트 생성은 이 id가 있어야 가능합니다. */
  savedResultId: string | null;
  /** 가입 화면으로 보내기 직전에 저장해두는, 가입 완료 후 돌아갈 경로. */
  pendingAfterSignup: string | null;

  // ---- v2: 1부→확인→2부→확인 흐름 사이에 화면 간 전달되는 중간 상태 ----
  part1Answers: Part1Answers | null;
  part1Result: ScorePart1Result | null;
  confirmedAxis: AxisKey | null;
  part2Answers: Part2Answers | null;

  setProfile: (name: string, gender: Gender) => void;
  setResult: (result: QuizResultV2) => void;
  setSavedResultId: (id: string) => void;
  setPendingAfterSignup: (path: string | null) => void;
  setPart1: (answers: Part1Answers, scored: ScorePart1Result) => void;
  setConfirmedAxis: (axis: AxisKey) => void;
  setPart2Answers: (answers: Part2Answers) => void;
  reset: () => void;
}

const QuizContext = createContext<QuizState | null>(null);

// 카카오/네이버 로그인은 외부 사이트로 갔다가 돌아오는 방식(완전한 페이지 새로고침)이라,
// 이동하는 동안 이 Context의 메모리 상태가 전부 사라집니다. 그래서 이동 직전에 여기 잠깐
// 담아뒀다가, 로그인이 끝나고 돌아오는 착지 페이지(/auth/finish)에서 되살립니다.
//
// 주의: 이 값을 QuizProvider의 초기 state에서(예: useState(() => ...)) 곧바로 읽으면 안 됩니다.
// 서버 렌더링 결과물(sessionStorage 없음)과 클라이언트 첫 렌더 결과물(sessionStorage 있음)이
// 달라져서 React가 "hydration mismatch" 오류를 내고, 화면이 깨지면서 상태가 유실됩니다.
// 그래서 복원은 오직 /auth/finish 페이지의 useEffect(마운트 후, 클라이언트에서만 실행)에서만
// readAndClearPendingQuiz()를 호출해 수행합니다.
const PENDING_KEY = "ssol_pending_quiz_v1";

export interface PendingQuizState {
  userName: string;
  userGender: Gender | "";
  result: QuizResultV2 | null;
  pendingAfterSignup: string | null;
  /** true면, 복원 직후 로그인 여부를 확인해서 결과를 자동으로 한 번 저장합니다. */
  autoSave?: boolean;
  /**
   * 이미 저장된 결과의 id. 토스페이먼츠처럼 "이미 저장된 결과로 결제하러 가는" 흐름에서 꼭
   * 같이 담아야 합니다 — 안 그러면 결제 후 돌아왔을 때(autoSave=false라 재저장도 안 하는데)
   * savedResultId가 없어서 리포트 생성 폴링이 아예 시작되지 않고, 실제로 결제한 사용자가
   * 잠금 화면에 그대로 갇히는 문제가 있었습니다(2026-09-24 발견).
   */
  savedResultId?: string | null;
}

/**
 * 카카오/네이버 로그인, 토스페이먼츠 결제처럼 외부 사이트로 갔다 돌아오는 흐름 직전에 호출하세요.
 * autoSave: 로그인/가입 흐름에서만 true로 두세요(복원 직후 결과를 저장합니다). 이미 저장된 결과를
 * 들고 결제하러 가는 경우처럼 다시 저장할 필요가 없으면 false를 넘기세요.
 */
export function stashPendingQuizForOAuth(state: Omit<PendingQuizState, "autoSave">, autoSave = true) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...state, autoSave }));
  } catch {
    // 세션 스토리지를 못 쓰는 환경(사파리 프라이빗 모드 등)이면 그냥 넘어갑니다 — 로그인 자체는 됩니다.
  }
}

/** /auth/finish 에서만 호출하세요 (한 번 읽으면 즉시 지워집니다). */
export function readAndClearPendingQuiz(): PendingQuizState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as PendingQuizState;
  } catch {
    return null;
  }
}

// 퀴즈 응답·계산된 점수·확정 유형·이름/호칭을 화면 간에 유지합니다.
export function QuizProvider({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState("");
  const [userGender, setUserGender] = useState<Gender | "">("");
  const [result, setResultState] = useState<QuizResultV2 | null>(null);
  const [savedResultId, setSavedResultIdState] = useState<string | null>(null);
  const [pendingAfterSignup, setPendingAfterSignupState] = useState<string | null>(null);

  const [part1Answers, setPart1Answers] = useState<Part1Answers | null>(null);
  const [part1Result, setPart1Result] = useState<ScorePart1Result | null>(null);
  const [confirmedAxis, setConfirmedAxisState] = useState<AxisKey | null>(null);
  const [part2Answers, setPart2AnswersState] = useState<Part2Answers | null>(null);

  const setProfile = useCallback((name: string, gender: Gender) => {
    setUserName(name);
    setUserGender(gender);
  }, []);
  const setResult = useCallback((r: QuizResultV2) => setResultState(r), []);
  const setSavedResultId = useCallback((id: string) => setSavedResultIdState(id), []);
  const setPendingAfterSignup = useCallback((path: string | null) => setPendingAfterSignupState(path), []);
  const setPart1 = useCallback((answers: Part1Answers, scored: ScorePart1Result) => {
    setPart1Answers(answers);
    setPart1Result(scored);
  }, []);
  const setConfirmedAxis = useCallback((axis: AxisKey) => setConfirmedAxisState(axis), []);
  const setPart2Answers = useCallback((answers: Part2Answers) => setPart2AnswersState(answers), []);
  const reset = useCallback(() => {
    setUserName("");
    setUserGender("");
    setResultState(null);
    setSavedResultIdState(null);
    setPendingAfterSignupState(null);
    setPart1Answers(null);
    setPart1Result(null);
    setConfirmedAxisState(null);
    setPart2AnswersState(null);
  }, []);

  const value = useMemo<QuizState>(() => {
    const t = userGender ? GENDER_TITLE[userGender] : "";
    return {
      userName,
      userGender,
      result,
      title: t,
      savedResultId,
      pendingAfterSignup,
      part1Answers,
      part1Result,
      confirmedAxis,
      part2Answers,
      setProfile,
      setResult,
      setSavedResultId,
      setPendingAfterSignup,
      setPart1,
      setConfirmedAxis,
      setPart2Answers,
      reset,
    };
  }, [
    userName,
    userGender,
    result,
    savedResultId,
    pendingAfterSignup,
    part1Answers,
    part1Result,
    confirmedAxis,
    part2Answers,
    setProfile,
    setResult,
    setSavedResultId,
    setPendingAfterSignup,
    setPart1,
    setConfirmedAxis,
    setPart2Answers,
    reset,
  ]);

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz(): QuizState {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuiz must be used within QuizProvider");
  return ctx;
}
