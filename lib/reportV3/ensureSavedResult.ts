// 2026-09-29: app/result/report/page.tsx와 app/result/report/view/page.tsx가 각자
// 거의 동일한 ensureSavedResult()를 갖고 있던 걸(반환 타입만 다름) 하나로 합쳤습니다 —
// /api/results로 보내는 저장 payload가 바뀌면 이 파일 하나만 고치면 됩니다.
import type { Gender } from "@/lib/data";
import type { QuizResultV2 } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/client";

export type EnsureSavedResultOutcome = { ok: true; id: string } | { ok: false; reason: "not_logged_in" | "save_failed" };

interface EnsureSavedResultParams {
  savedResultId: string | null;
  setSavedResultId: (id: string) => void;
  userName: string;
  userGender: Gender | "";
  result: QuizResultV2;
}

/** 이미 저장된 결과가 있으면 그대로 재사용하고, 없으면 로그인 확인 후 /api/results로 저장합니다. */
export async function ensureSavedResult({
  savedResultId,
  setSavedResultId,
  userName,
  userGender,
  result,
}: EnsureSavedResultParams): Promise<EnsureSavedResultOutcome> {
  if (savedResultId) return { ok: true, id: savedResultId };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_logged_in" };
  const res = await fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
