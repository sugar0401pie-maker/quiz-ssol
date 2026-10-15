import { NextResponse } from "next/server";
import { startOrGetGeneration } from "@/lib/reportV3/generateOrGet";
import { claimGuestRows } from "@/lib/guest/claim";
import { guestHashFrom, ownerGuestHash, ownerUserId, ownsRow, resolveOwner, type Owner } from "@/lib/guest/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 2026-09-28: gpt-6-sol(reasoning, medium effort)로 전환하면서 생성 시간이 더 늘어날 수
// 있어(Pro 플랜 기준 최대 300초까지 허용) 여유를 크게 둡니다. 그래도 함수가 중간에 죽는
// 경우를 대비해 lib/reportV3/generateOrGet.ts에 "generating" 락 + 오래된 락 무시 로직을 둡니다.
export const maxDuration = 300;

// 2026-09-28: deep-report-prompt-8section-v6.md 반영. 1~8번 섹션 전부를 매번 OpenAI가
// 생성합니다(섹션 1도 이제 AI가 씀 — 더 이상 결제 전 무료 미리보기 없음). 같은 주문
// (order_id)에는 재호출하지 않고 ssol_reports에 저장된 값을 재사용합니다.
// 2026-10-01: 실제 생성 로직(startOrGetGeneration)은 lib/reportV3/generateOrGet.ts로
// 뺐습니다 — app/api/admin/grant-report/route.ts(관리자용 무료 리포트 생성)도 같은 로직을
// 씁니다.

// 2026-10-15: 비회원(로그인 없이 결제)도 자기 주문/리포트를 조회·생성할 수 있도록, 주문 찾기를 "소유자" 기준으로
// 합니다 — 로그인 사용자는 user_id, 비회원은 이 브라우저 열쇠의 해시(guest_token_hash)로 찾습니다.
async function findPaidSoloOrder(admin: ReturnType<typeof createAdminClient>, resultId: string, owner: Owner) {
  const base = admin
    .from("ssol_orders")
    .select("id")
    .eq("result_id", resultId)
    .eq("status", "paid")
    .eq("report_kind", "solo");
  const { data } = await (owner.kind === "user" ? base.eq("user_id", owner.userId) : base.is("user_id", null).eq("guest_token_hash", owner.hash))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// 비회원으로 결제한 직후 가입·로그인해서 이 요청이 로그인 상태로 오면, 결제한 주문이 아직 계정으로 안 옮겨져 있을 수 있습니다
// (가입 직후 화면과 가져오기 요청이 거의 동시에 나가는 경우). "결제 안 됨"으로 잘못 보이지 않게 여기서 먼저 옮깁니다.
async function claimGuestDataIfAny(req: Request, admin: ReturnType<typeof createAdminClient>, owner: Owner) {
  if (owner.kind !== "user") return;
  const hash = guestHashFrom(req);
  if (hash) await claimGuestRows(admin, owner.userId, hash);
}

// 결제 여부 + 리포트 조립 상태 조회.
export async function GET(req: Request) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "login required" }, { status: 401 });

  const resultId = new URL(req.url).searchParams.get("resultId");
  if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });

  const admin = createAdminClient();
  await claimGuestDataIfAny(req, admin, owner);
  const order = await findPaidSoloOrder(admin, resultId, owner);
  if (!order) return NextResponse.json({ status: "none" });

  const outcome = await startOrGetGeneration(admin, resultId, order.id, ownerUserId(owner), ownerGuestHash(owner));
  if (outcome.status === "failed") return NextResponse.json({ status: "failed" });
  if (outcome.status === "generating") return NextResponse.json({ status: "generating" });
  return NextResponse.json({ status: "ready", assembled: outcome.assembled });
}

export async function POST(req: Request) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: { resultId?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const resultId = body?.resultId;
  if (!resultId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = createAdminClient();
  await claimGuestDataIfAny(req, admin, owner);

  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select(owner.kind === "guest" ? "id, user_id, guest_token_hash" : "id, user_id")
    .eq("id", resultId)
    .single();
  const resultRow = result as unknown as { id: string; user_id: string | null; guest_token_hash?: string | null } | null;
  if (resultError || !resultRow || !ownsRow(owner, resultRow)) {
    return NextResponse.json({ error: "result not found" }, { status: 404 });
  }

  const order = await findPaidSoloOrder(admin, resultId, owner);
  if (!order) return NextResponse.json({ error: "payment required" }, { status: 403 });

  const outcome = await startOrGetGeneration(admin, resultId, order.id, ownerUserId(owner), ownerGuestHash(owner));
  if (outcome.status === "failed") return NextResponse.json({ error: "generation failed" }, { status: 500 });
  if (outcome.status === "generating") return NextResponse.json({ status: "generating" });
  return NextResponse.json({ status: "ready", assembled: outcome.assembled });
}
