// 2026-09-29: app/result/report/page.tsx와 app/result/report/view/page.tsx가 각자
// 거의 동일한 ensureSavedResult()를 갖고 있던 걸(반환 타입만 다름) 하나로 합쳤습니다 —
// /api/results로 보내는 저장 payload가 바뀌면 이 파일 하나만 고치면 됩니다.
import type { Gender } from "@/lib/data";
import type { QuizResultV2 } from "@/lib/scoring";
import { guestHeaders } from "@/lib/guest/client";

export type EnsureSavedResultOutcome = { ok: true; id: string } | { ok: false; reason: "not_logged_in" | "save_failed" };

interface EnsureSavedResultParams {
  savedResultId: string | null;
  setSavedResultId: (id: string) => void;
  userName: string;
  userGender: Gender | "";
  result: QuizResultV2;
}

/**
 * 이미 저장된 결과가 있으면 그대로 재사용하고, 없으면 /api/results로 저장합니다.
 * 2026-10-15: 로그인하지 않았어도 저장됩니다 — 이 브라우저의 비회원 열쇠(없으면 새로 만듦)에 묶이고, 가입하면 계정으로 옮겨집니다.
 * (로그인한 사용자의 요청에도 같은 헤더가 같이 가지만, 서버는 로그인을 먼저 보고 열쇠는 비회원 기록을 가져올 때만 씁니다.)
 */
export async function ensureSavedResult({
  savedResultId,
  setSavedResultId,
  userName,
  userGender,
  result,
}: EnsureSavedResultParams): Promise<EnsureSavedResultOutcome> {
  if (savedResultId) return { ok: true, id: savedResultId };
  const res = await fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...guestHeaders(true) },
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
  if (!res.ok) return { ok: false, reason: "save_failed" };
  const data = await res.json();
  if (data?.id) {
    setSavedResultId(data.id);
    return { ok: true, id: data.id };
  }
  return { ok: false, reason: "save_failed" };
}

/**
 * 화면이 들고 있는 savedResultId가 "지금 로그인한 계정의 저장된 결과"이고 내용도 지금 결과와 같은지 서버에서 확인합니다.
 * 비회원으로 저장·결제한 사람이 로그인하면 그 결과가 계정으로 옮겨지는데(lib/guest/claim.ts), 누가 먼저 옮기든(가입 화면의
 * 가져오기 요청이든 서버의 자동 가져오기든) 이 확인만으로 "이미 내 결과로 저장돼 있다"를 알 수 있어, 같은 결과를 한 번 더
 * 새로 저장해 결제한 주문과 떨어진 복사본이 생기는 것을 막습니다. 다른 계정의 id이거나 내용이 다르면 false(=예전처럼 저장).
 */
export async function alreadySavedForMe(savedResultId: string | null, result: QuizResultV2): Promise<boolean> {
  if (!savedResultId) return false;
  try {
    const res = await fetch(`/api/results?resultId=${encodeURIComponent(savedResultId)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return (
      data?.id === savedResultId &&
      data?.typeCode === result.typeCode &&
      JSON.stringify(data.part1Answers) === JSON.stringify(result.part1Answers) &&
      JSON.stringify(data.part2Answers) === JSON.stringify(result.part2Answers)
    );
  } catch {
    return false;
  }
}
