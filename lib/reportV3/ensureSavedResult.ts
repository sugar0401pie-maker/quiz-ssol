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
