import { NextResponse } from "next/server";
import { AXIS_ORDER, MODE_ORDER, PART1_ITEMS, PART2_ITEMS, type AxisKey, type Gender, type ModeKey } from "@/lib/data";
import { buildReportV3Input } from "@/lib/reportV3/buildInput";
import { buildReportTeaser } from "@/lib/reportV3/teaser";
import { scorePart1, scorePart2 } from "@/lib/scoring";

// 2026-10-07: 결제 전 "블러 미리보기" 문장(lib/reportV3/teaser.ts). 로그인하지 않은 사람도 볼 수 있도록
// 로그인·DB 없이, 보낸 응답으로 점수를 다시 계산해서 문장만 만들어 돌려줍니다(저장하지 않음). 계산은 가볍고
// 결과는 개인 맞춤 문장 일부일 뿐이라(결제해야 볼 수 있는 본문은 여기 없음) 별도 인증은 두지 않습니다.
const GENDERS: Gender[] = ["female", "male", "none"];

export async function POST(req: Request) {
  let body: Record<string, unknown> | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { userName, gender, part1Answers, part2Answers, confirmedAxis, confirmedMode } = (body ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  const valid =
    typeof userName === "string" &&
    userName.trim().length > 0 &&
    userName.length <= 12 &&
    GENDERS.includes(gender) &&
    part1Answers &&
    typeof part1Answers === "object" &&
    Object.keys(PART1_ITEMS).every((id) => Number.isInteger(part1Answers[id]) && part1Answers[id] >= 1 && part1Answers[id] <= 5) &&
    part2Answers &&
    typeof part2Answers === "object" &&
    Object.keys(PART2_ITEMS).every((id) => Number.isInteger(part2Answers[id]) && part2Answers[id] >= 1 && part2Answers[id] <= 5) &&
    AXIS_ORDER.includes(confirmedAxis) &&
    MODE_ORDER.includes(confirmedMode);
  if (!valid) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const s1 = scorePart1(part1Answers);
  const s2 = scorePart2(part2Answers);
  const input = buildReportV3Input({
    userName: userName.trim(),
    gender,
    axis: confirmedAxis as AxisKey,
    mode: confirmedMode as ModeKey,
    axisScores: s1.axisScores,
    factorScores: s1.factorScores,
    modeScores: s2.modeScores,
    copingSubScores: s2.subScores,
    part1Answers,
    part2Answers,
  });
  return NextResponse.json({ sections: buildReportTeaser(input) }, { headers: { "Cache-Control": "no-store" } });
}
