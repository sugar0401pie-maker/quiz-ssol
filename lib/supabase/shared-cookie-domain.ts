// ssolwellnesshouse.com과 그 서브도메인(app.ssolwellnesshouse.com — 별도로 배포된 AI 웰니스
// 채팅 앱)이 같은 Supabase 프로젝트를 쓰면서 로그인 세션(쿠키)도 공유하도록, 두 도메인의 공통
// 상위 도메인에 쿠키를 심습니다. 이 값은 두 앱 모두 똑같이 맞춰야 세션이 공유됩니다.
//
// 로컬 개발(localhost)이나 Vercel 프리뷰 배포(*.vercel.app)에서는 이 도메인으로 쿠키를 심을 수
// 없어서(브라우저가 거부합니다) 그 경우엔 undefined를 돌려줘서 기본 동작(host-only 쿠키)이 되게 합니다.
const ROOT_DOMAIN = "ssolwellnesshouse.com";

export function sharedCookieDomain(hostname: string | null | undefined): string | undefined {
  if (!hostname) return undefined;
  const host = hostname.split(":")[0]; // 혹시 포트가 붙어 있으면 제거
  return host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`) ? `.${ROOT_DOMAIN}` : undefined;
}
