import { NextResponse } from "next/server";
import { DESSERT, type TypeCode } from "@/lib/data";
import { buildRelationshipSections } from "@/lib/relationshipReport";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 2026-09-25: "유형간 관계성 보고서" 결제·조회. /result/report/relationship 페이지에서 씁니다.
// lib/reportAssembly.ts처럼 결정론적 조립이라 대기 없이 결제 즉시 나갑니다.

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function assembleAndStore(
  admin: ReturnType<typeof createAdminClient>,
  resultId: string,
  orderId: string,
  userId: string,
  friendTypeCode: TypeCode,
  friendName: string
) {
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("type_key, user_name")
    .eq("id", resultId)
    .single();
  if (resultError || !result) return null;

  const myTypeCode = result.type_key as TypeCode;
  const sections = buildRelationshipSections(result.user_name, myTypeCode, friendName, friendTypeCode);

  const assembled = {
    overview: sections.overview,
    section2: sections.section2,
    section3: sections.section3,
    section4: sections.section4,
    section5: sections.section5,
    section6: sections.section6,
    friendTypeCode,
    friendName,
  };

  const { data: saved, error: saveError } = await admin
    .from("ssol_reports")
    .upsert(
      {
        order_id: orderId,
        result_id: resultId,
        user_id: userId,
        status: "ready",
        assembled,
        report_kind: "relationship",
        friend_type_code: friendTypeCode,
        ready_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
    )
    .select("assembled")
    .single();
  if (saveError) {
    console.error("관계성 리포트 저장 실패:", saveError.message);
    return null;
  }
  return saved.assembled;
}

export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const url = new URL(req.url);
  const resultId = url.searchParams.get("resultId");
  const friendTypeCode = url.searchParams.get("friend") as TypeCode | null;
  if (!resultId || !friendTypeCode || !(friendTypeCode in DESSERT)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const friendName = url.searchParams.get("friendName") || DESSERT[friendTypeCode].name;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("ssol_orders")
    .select("id")
    .eq("result_id", resultId)
    .eq("user_id", user.id)
    .eq("status", "paid")
    .eq("report_kind", "relationship")
    .eq("friend_type_code", friendTypeCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return NextResponse.json({ status: "none" });

  const { data: report } = await admin.from("ssol_reports").select("status, assembled").eq("order_id", order.id).maybeSingle();
  if (report?.assembled) return NextResponse.json({ status: "ready", assembled: report.assembled });

  const assembled = await assembleAndStore(admin, resultId, order.id, user.id, friendTypeCode, friendName);
  if (!assembled) return NextResponse.json({ status: "paid_needs_generation" });
  return NextResponse.json({ status: "ready", assembled });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string; friend?: string; friendName?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  const friendTypeCode = body?.friend as TypeCode | undefined;
  if (!resultId || !friendTypeCode || !(friendTypeCode in DESSERT)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const friendName = body?.friendName || DESSERT[friendTypeCode].name;

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
    .eq("report_kind", "relationship")
    .eq("friend_type_code", friendTypeCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "payment required" }, { status: 403 });

  const { data: existing } = await admin.from("ssol_reports").select("assembled").eq("order_id", order.id).maybeSingle();
  if (existing?.assembled) return NextResponse.json({ status: "ready", assembled: existing.assembled });

  const assembled = await assembleAndStore(admin, resultId, order.id, user.id, friendTypeCode, friendName);
  if (!assembled) return NextResponse.json({ error: "generation failed" }, { status: 500 });
  return NextResponse.json({ status: "ready", assembled });
}
