// 2026-10-15: 로그인 없이 결제하는 "비회원(guest)" 흐름용 브라우저 쪽 도우미. 쏠 아스트로 하우스(ssol-astro-test)의
// 방식을 따릅니다 — Supabase 익명 로그인은 쓰지 않고(쿠키를 공유하는 쏘웰라 AuthGate가 익명 세션을 로그아웃시킴),
// 이 브라우저에만 있는 무작위 열쇠를 localStorage에 두고 요청마다 헤더로 보냅니다. 서버는 열쇠의 해시만 저장합니다.
export const GUEST_HEADER = "x-ssol-guest";
const STORAGE_KEY = "ssol_guest_v1";

let memoryKey: string | null = null; // localStorage를 못 쓰는 환경(사생활 보호 모드 등)에서 이 탭 동안만 유지

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 이 브라우저의 비회원 열쇠. create=true면 없을 때 새로 만듭니다. */
export function getGuestKey(create = false): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
    if (!create) return memoryKey;
    const fresh = randomKey();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    if (!memoryKey && create) memoryKey = randomKey();
    return memoryKey;
  }
}

/** 가져오기가 끝난 열쇠를 지웁니다(이후 비회원으로 다시 저장하면 새 열쇠가 만들어짐). */
export function clearGuestKey(): void {
  memoryKey = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장소를 못 쓰는 환경이면 지울 것도 없습니다. */
  }
}

/** fetch에 펼쳐서 쓰는 헤더. 열쇠가 없으면 빈 객체(=비회원 요청 아님). */
export function guestHeaders(create = false): Record<string, string> {
  const key = getGuestKey(create);
  return key ? { [GUEST_HEADER]: key } : {};
}

/** 로그인한 계정으로 이 브라우저의 비회원 결과·주문을 옮깁니다. 열쇠가 없으면 아무것도 하지 않습니다. */
export async function claimGuestData(): Promise<{ claimed: boolean }> {
  const headers = guestHeaders(false);
  if (!headers[GUEST_HEADER]) return { claimed: false };
  try {
    const res = await fetch("/api/results/claim", { method: "POST", headers });
    if (!res.ok) return { claimed: false }; // 로그인이 안 됐거나 일시 오류 — 열쇠는 남겨 둡니다.
    const data = await res.json().catch(() => null);
    clearGuestKey();
    return { claimed: !!data?.claimed };
  } catch {
    return { claimed: false };
  }
}
