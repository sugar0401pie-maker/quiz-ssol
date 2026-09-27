"use client";

import Script from "next/script";

// 카카오톡 공유하기용 JS SDK 로드. Script의 onLoad는 클라이언트 컴포넌트 안에서만 쓸 수 있어
// 루트 레이아웃(서버 컴포넌트)과 분리했습니다. 키가 없으면 초기화만 건너뛰고,
// 공유 버튼은 ShareSheet에서 링크 복사로 대체됩니다.
export default function KakaoInit() {
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (jsKey && window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(jsKey);
        }
      }}
    />
  );
}
