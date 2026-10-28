// 2026-10-28: 방문자가 어디서 들어왔는지(유입 경로) 기록 — 응시 시작·완료 카운터(lib/trackQuizEvent.ts)에 함께 실어 보냅니다.
// 사이트에 처음 들어온 순간(세션의 첫 화면)에만 한 번 읽어 sessionStorage에 두고, 이후 화면 이동에서는 그대로 씁니다.
// 개인정보를 쓰지 않습니다: 주소의 utm 표시 3가지와 "어느 사이트에서 왔는지(도메인)"만 남기고, 경로·검색어·IP는 보지 않습니다.
//
// 우선순위: utm_source가 있으면 그것(공유 링크·광고 링크에 붙인 표시) → 없으면 이전 사이트 도메인으로 추정 → 없으면 "direct"(주소 직접 입력·
// 북마크·카카오톡·문자처럼 출처를 알려주지 않는 앱).
const KEY = "ssol_attr_v1";

export interface Attribution {
  src: string; // 정리된 출처 이름(예: instagram, kakao, share, www, direct)
  med: string; // utm_medium(예: story, profile, kakao) — 없으면 빈 문자열
  camp: string; // utm_campaign — 없으면 빈 문자열
  ref: string; // 이전 사이트 도메인만(예: l.instagram.com) — 없으면 빈 문자열
}

const clean = (v: string | null | undefined, max = 40) => (v ?? "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, max);

// 이전 사이트 도메인 → 출처 이름. 우리 사이트끼리의 이동(랜딩 www, 쏘웰라 app, 점성술 astro)도 구분합니다.
const REFERRER_SOURCES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(kakao\.com|kakaocdn\.net|kakaotalk\.com)$/, "kakao"],
  [/(^|\.)naver\.(com|me)$/, "naver"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)(facebook|fb)\.com$/, "facebook"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)(twitter|x)\.com$/, "twitter"],
  [/(^|\.)t\.co$/, "twitter"],
  [/(^|\.)youtube\.com$/, "youtube"],
  [/(^|\.)daum\.net$/, "daum"],
  [/^www\.ssolwellnesshouse\.com$/, "www"],
  [/^app\.ssolwellnesshouse\.com$/, "app"],
  [/^astro\.ssolwellnesshouse\.com$/, "astro"],
];

function fromReferrer(host: string): string {
  for (const [re, name] of REFERRER_SOURCES) if (re.test(host)) return name;
  return "referral";
}

/** 세션의 첫 화면에서 한 번 부르세요. 이미 기록돼 있으면 건드리지 않습니다. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    let ref = "";
    try {
      const u = document.referrer ? new URL(document.referrer) : null;
      if (u && u.hostname !== window.location.hostname) ref = clean(u.hostname, 80);
    } catch {
      /* 이전 주소를 못 읽으면 출처 없음 */
    }
    const utm = clean(params.get("utm_source"));
    const attr: Attribution = {
      src: utm || (ref ? fromReferrer(ref) : "direct"),
      med: clean(params.get("utm_medium")),
      camp: clean(params.get("utm_campaign")),
      ref,
    };
    sessionStorage.setItem(KEY, JSON.stringify(attr));
  } catch {
    /* 저장소를 못 쓰는 환경이면 출처 기록만 건너뜁니다. */
  }
}

export function readAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}
