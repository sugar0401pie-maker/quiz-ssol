import "server-only";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

// 2026-10-15: 비회원(guest) 결제용 서버 도우미. lib/guest/client.ts의 열쇠(64자리 16진수)를 헤더로 받아
// sha256 해시만 DB(guest_token_hash)에 저장합니다 — 열쇠 원본은 서버에 남지 않습니다.
export const GUEST_HEADER = "x-ssol-guest";

export type Owner = { kind: "user"; userId: string } | { kind: "guest"; hash: string };

export function guestHashFrom(req: Request): string | null {
  const key = req.headers.get(GUEST_HEADER);
  if (!key || !/^[a-f0-9]{64}$/.test(key)) return null;
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** 로그인한 사용자가 먼저, 없으면 비회원 열쇠. 둘 다 없으면 null(=401). */
export async function resolveOwner(req: Request): Promise<Owner | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { kind: "user", userId: user.id };
  const hash = guestHashFrom(req);
  return hash ? { kind: "guest", hash } : null;
}

type OwnedRow = { user_id: string | null; guest_token_hash?: string | null };

export function ownsRow(owner: Owner, row: OwnedRow): boolean {
  if (owner.kind === "user") return row.user_id === owner.userId;
  return row.user_id === null && row.guest_token_hash === owner.hash;
}

export const ownerUserId = (owner: Owner): string | null => (owner.kind === "user" ? owner.userId : null);
export const ownerGuestHash = (owner: Owner): string | null => (owner.kind === "guest" ? owner.hash : null);

/** insert할 때 소유자 칸. 로그인 사용자 요청에는 guest 칸을 넣지 않습니다(마이그레이션 전에도 기존 흐름이 그대로 동작). */
export function ownerColumns(owner: Owner): { user_id: string } | { user_id: null; guest_token_hash: string } {
  return owner.kind === "user" ? { user_id: owner.userId } : { user_id: null, guest_token_hash: owner.hash };
}
