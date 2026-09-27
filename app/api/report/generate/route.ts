import { NextResponse } from "next/server";
import { AXIS_ORDER, DESSERT, type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { generateWithOpenAI } from "@/lib/openaiReport";
import { splitIntoParagraphs } from "@/lib/paragraphSplit";
import { buildSection6 } from "@/lib/reportAssembly";
import { REPORT_TEMPLATES } from "@/lib/reportTemplates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-25: v3deep-report-prompt-and-example.md + 15types-full-reports.md 반영.
// 2~7번 섹션은 이제 "15유형 대표 시나리오 템플릿"을 실제 사용자 점수·응답에 맞게 OpenAI가
// 조정하는 방식입니다. 1번(오각형 상세)은 여전히 결정론적 조립(lib/reportAssembly.ts)이라
// 무료로 즉시 제공됩니다. 같은 주문(order_id)에는 재호출하지 않고(ssol_reports에 저장된 값
// 재사용), 실제 점수가 템플릿과 충분히 가까우면 API를 아예 호출하지 않고 템플릿을 문단만
// 나눠서 그대로 씁니다(비용 절감).

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// 실제 점수가 템플릿(대표 시나리오)과 충분히 가까우면 API 호출 없이 템플릿을 그대로 씁니다.
function isCloseToTemplate(axisScores: Record<AxisKey, number>, template: { axisScores: Record<AxisKey, number> }): boolean {
  return AXIS_ORDER.every((a) => Math.abs(axisScores[a] - template.axisScores[a]) < 0.15);
}

async function assembleAndStore(admin: ReturnType<typeof createAdminClient>, resultId: string, orderId: string, userId: string) {
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("type_key, axis_scores, factor_scores, sub_scores, mode_scores, part1_answers, part2_answers")
    .eq("id", resultId)
    .single();
  if (resultError || !result) return null;

  const typeCode = result.type_key as TypeCode;
  const [confirmedAxis, confirmedMode] = typeCode.split("-") as [AxisKey, ModeKey];
  const template = REPORT_TEMPLATES[typeCode];
  const dessert = DESSERT[typeCode];

  // 1번(오각형 상세)은 무료로 이미 따로 제공되므로 여기서는 2~7번만 다룹니다.
  const flags = buildSection6(confirmedAxis, result.sub_scores, result.part2_answers, result.factor_scores);

  let sections: { section2: string[]; section3: string[]; section4: string[]; section5: string[]; section6: string[]; section7: string[] };

  // 2026-09-26: 응답 인용(개인화)을 위해 템플릿과 가까워도 AI를 호출합니다. 키가 없거나 실패하면 템플릿 그대로.
  if (!process.env.OPENAI_API_KEY && isCloseToTemplate(result.axis_scores, template)) {
    sections = {
      section2: splitIntoParagraphs(template.section2, 4),
      section3: splitIntoParagraphs(template.section3, 4),
      section4: splitIntoParagraphs(template.section4, 4),
      section5: splitIntoParagraphs(template.section5, 4),
      section6: flags.length ? splitIntoParagraphs(flags, 4) : [],
      section7: splitIntoParagraphs(template.section7, 4),
    };
  } else {
    try {
      const generated = await generateWithOpenAI({
        typeCode,
        dessertName: dessert.name,
        confirmedAxis,
        confirmedMode,
        axisScores: result.axis_scores,
        factorScores: result.factor_scores,
        modeScores: result.mode_scores,
        part1Answers: result.part1_answers,
        part2Answers: result.part2_answers,
        template,
      });
      // AI가 특수 플래그를 잘못 지어냈을 수 있으니, 실제 조건 판정 결과로 덮어씁니다.
      sections = { ...generated, section6: flags.length ? splitIntoParagraphs(flags, 4) : [] };
    } catch (err) {
      console.error("OpenAI 리포트 생성 실패 — 템플릿으로 대체:", err instanceof Error ? err.message : err);
      sections = {
        section2: splitIntoParagraphs(template.section2, 4),
        section3: splitIntoParagraphs(template.section3, 4),
        section4: splitIntoParagraphs(template.section4, 4),
        section5: splitIntoParagraphs(template.section5, 4),
        section6: flags.length ? splitIntoParagraphs(flags, 4) : [],
        section7: splitIntoParagraphs(template.section7, 4),
      };
    }
  }

  const assembled = {
    section2: sections.section2,
    section3: sections.section3.length ? sections.section3 : null,
    section4: sections.section4,
    section5: sections.section5.length ? sections.section5 : null,
    section6: sections.section6,
    section7: sections.section7.length ? sections.section7 : null,
  };

  const { data: saved, error: saveError } = await admin
    .from("ssol_reports")
    .upsert({ order_id: orderId, result_id: resultId, user_id: userId, status: "ready", assembled, ready_at: new Date().toISOString() }, { onConflict: "order_id" })
    .select("assembled")
    .single();
  if (saveError) {
    console.error("리포트 저장 실패:", saveError.message);
    return null;
  }
  return saved.assembled;
}

// 결제 여부 + 리포트 조립 상태 조회.
export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const resultId = new URL(req.url).searchParams.get("resultId");
  if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("ssol_orders")
    .select("id")
    .eq("result_id", resultId)
    .eq("user_id", user.id)
    .eq("status", "paid")
    .eq("report_kind", "solo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return NextResponse.json({ status: "none" });

  const { data: report } = await admin.from("ssol_reports").select("status, assembled").eq("order_id", order.id).maybeSingle();
  if (report?.assembled) return NextResponse.json({ status: "ready", assembled: report.assembled });

  // 결제는 됐지만 아직 조립된 적이 없는 경우 — 바로 조립해서 반환합니다(비용도 지연도 없으니
  // 기다릴 이유가 없습니다).
  const assembled = await assembleAndStore(admin, resultId, order.id, user.id);
  if (!assembled) return NextResponse.json({ status: "paid_needs_generation" });
  return NextResponse.json({ status: "ready", assembled });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  if (!resultId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = createAdminClient();

  const { data: result, error: resultError } = await admin.from("ssol_quiz_results").select("id, user_id").eq("id", resultId).single();
  if (resultError || !result || result.user_id !== user.id) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }

  const { data: order } = await admin
    .from("ssol_orders")
    .select("id")
    .eq("result_id", resultId)
    .eq("user_id", user.id)
    .eq("status", "paid")
    .eq("report_kind", "solo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "payment required" }, { status: 403 });

  const { data: existing } = await admin.from("ssol_reports").select("assembled").eq("order_id", order.id).maybeSingle();
  if (existing?.assembled) return NextResponse.json({ status: "ready", assembled: existing.assembled });

  const assembled = await assembleAndStore(admin, resultId, order.id, user.id);
  if (!assembled) return NextResponse.json({ error: "generation failed" }, { status: 500 });
  return NextResponse.json({ status: "ready", assembled });
}
