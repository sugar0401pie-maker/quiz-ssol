/** @type {import('next').NextConfig} */
const nextConfig = {
  // 2026-09-29: 이메일용 오각형 그래프 PNG 렌더링(@resvg/resvg-js)이 네이티브 바이너리(.node)를
  // 포함하는데, webpack이 이걸 번들에 넣으려다 실패합니다("Unexpected character" 에러). 서버
  // 전용 패키지로 지정해서 번들링하지 않고 런타임에 node_modules에서 그대로 require하게 합니다.
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
  // 2026-09-24: Vercel 엣지 캐시가 새 배포 이후에도 옛날 HTML을 계속 내려주는 문제가 있었습니다
  // (재배포/강제 캐시 무시/도메인 우회 전부 시도해도 재현됨 — Vercel 쪽 이슈로 보입니다).
  // 원인이 해소될 때까지, 페이지(HTML) 응답에 캐시 금지 헤더를 직접 박아서 엣지가 절대
  // 오래 들고 있지 못하게 강제합니다. 정적 자원(_next/static, images)은 그대로 캐시되게 둡니다.
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|images|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
