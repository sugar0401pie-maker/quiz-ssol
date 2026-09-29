import { NextResponse } from "next/server";
import {
  AXIS_ORDER,
  DESSERT,
  MODE_ORDER,
  PART1_ITEMS,
  PART2_ITEMS,
  type AxisKey,
  type Gender,
  type ModeKey,
  type TypeCode,
} from "@/lib/data";
import { detectSpecialResult, scorePart1, scorePart2 } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GENDERS: Gender[] = ["female", "male", "none"];

// 2026-09-25: 첫 화면 "이미 테스트를 보셨다면 로그인하기" 흐름용 — 로그인한 사용자가 이전에
// 저장해둔 가장 최근 결과를 돌려줍니다. 저장된 결과가 없으면 404로, 아예 로그인이 안 됐으면
// 401로 응답합니다.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ssol_quiz_results")
    .select("id, user_name, gender, part1_answers, part2_answers, axis_scores, factor_scores, sub_scores, mode_scores, type_key, special_key")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("fetch latest result failed:", error.message);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "no saved result" }, { status: 404 });

  const [confirmedAxis, confirmedMode] = data.type_key.split("-");
  return NextResponse.json({
    id: data.id,
    userName: data.user_name,
    gender: data.gender,
    part1Answers: data.part1_answers,
    part2Answers: data.part2_answers,
    axisScores: data.axis_scores,
    factorScores: data.factor_scores,
    subScores: data.sub_scores,
    modeScores: data.mode_scores,
    typeCode: data.type_key,
    confirmedAxis,
    confirmedMode,
    specialKey: data.special_key,
  });
}

// 테스트 결과 저장: 로그인한 사용자만 저장할 수 있습니다.
// v2: 채점은 화면(클라이언트)에서 계산한 것과 서버가 응답값으로부터 재계산한 것이 같은지
// 대조합니다. 동점 확인 화면에서의 "사용자 선택"은 서버가 재현할 수 없는 정당한 선택이므로,
// confirmedAxis/confirmedMode는 각각 그 시점에 유효했던 후보(options/leaders) 안에 있는지만
// 검증합니다(무작위 요소가 없는 v2에서는 이 정도로 충분히 엄격합니다).
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: Record<string, unknown> | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { userName, gender, part1Answers, part2Answers, confirmedAxis, confirmedMode, typeCode, axisScores, factorScores } =
    (body ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  const validShape =
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
    MODE_ORDER.includes(confirmedMode) &&
    typeof typeCode === "string" &&
    typeCode in DESSERT;
  if (!validShape) {
    console.error("save result: bad shape", { hasName: !!userName, nameLen: typeof userName === "string" ? userName.length : null, gender, confirmedAxis, confirmedMode, typeCode });
    return NextResponse.json({ error: "bad request", reason: "shape" }, { status: 400 });
  }

  const scored1 = scorePart1(part1Answers);
  const scored2 = scorePart2(part2Answers);

  const axisScoresMatch = AXIS_ORDER.every((a) => Math.abs(scored1.axisScores[a] - axisScores?.[a]) < 1e-6);
  const factorScoresMatch = Object.keys(scored1.factorScores).every(
    (f) => Math.abs((scored1.factorScores as Record<string, number>)[f] - factorScores?.[f]) < 1e-6
  );
  // 2026-09-27: confirm-axis 화면은 "다른 영역이에요"/"기타"를 누르면 계산상의 후보가 아닌
  // 축도 사용자가 직접 고를 수 있게 해줍니다(의도된 기능). 그래서 여기서는 축이 유효한 5개 중
  // 하나인지만 보고(=validShape에서 이미 확인됨), 계산 후보와 같아야 한다는 제약은 걸지 않습니다.
  // (예전엔 이 제약 때문에, 직접 다른 영역을 고른 사용자의 저장이 전부 거부되고 있었습니다.)
  const axisValid = AXIS_ORDER.includes(confirmedAxis as AxisKey);
  // 확정 대처방식도 마찬가지로, 동점이었던 방식들(또는 유일한 1위) 중 하나여야 합니다.
  const modeValid = scored2.leaders.includes(confirmedMode as ModeKey);
  const typeCodeValid = typeCode === `${confirmedAxis}-${confirmedMode}`;

  if (!axisScoresMatch || !factorScoresMatch || !axisValid || !modeValid || !typeCodeValid) {
    const reason = { axisScoresMatch, factorScoresMatch, axisValid, modeValid, typeCodeValid };
    console.error("save result: score mismatch", reason);
    return NextResponse.json({ error: "score mismatch", reason }, { status: 400 });
  }

  const admin = createAdminClient();
  const row = {
    user_id: user.id,
    user_name: userName.trim(),
    gender,
    part1_answers: part1Answers,
    part2_answers: part2Answers,
    axis_scores: scored1.axisScores,
    factor_scores: scored1.factorScores,
    sub_scores: scored2.subScores,
    mode_scores: scored2.modeScores,
    type_key: typeCode as TypeCode,
    // 2026-09-29: 이스터에그 히든 결과 — 클라이언트 값이 아니라 방금 서버가 재계산한
    // scored1.axisScores로 판정합니다(신뢰 경계).
    special_key: detectSpecialResult(scored1.axisScores),
  };

  // 2026-09-26: 이미 저장된 결과가 있는 사용자가 다시 테스트하고 저장하면 "덮어쓰기"로 처리합니다.
  // 단, 그 결과로 이미 결제한 리포트가 있으면 덮어쓰지 않고 새 행으로 남깁니다(결제한 리포트가
  // 새 응답으로 바뀌어 보이는 걸 막기 위해).
  const { data: latest } = await admin
    .from("ssol_quiz_results")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest) {
    const { count: paidCount } = await admin
      .from("ssol_orders")
      .select("id", { count: "exact", head: true })
      .eq("result_id", latest.id)
      .eq("status", "paid");
    if (!paidCount) {
      const { data: updated, error: updateError } = await admin
        .from("ssol_quiz_results")
        .update(row)
        .eq("id", latest.id)
        .select("id, share_id")
        .single();
      if (updateError) {
        console.error("overwrite result failed:", updateError.message);
        return NextResponse.json({ error: "save failed", reason: updateError.message }, { status: 500 });
      }
      return NextResponse.json(updated);
    }
  }

  const { data, error } = await admin.from("ssol_quiz_results").insert(row).select("id, share_id").single();
  if (error) {
    console.error("save result failed:", error.message);
    return NextResponse.json({ error: "save failed", reason: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
