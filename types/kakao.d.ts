// 카카오 JS SDK(https://t1.kakaocdn.net/kakao_js_sdk/...)가 만드는 전역 객체.
// 공식 타입 패키지가 없어 여기서 필요한 만큼만 최소로 선언합니다.
export {};

declare global {
  interface Window {
    Kakao?: {
      init: (jsKey: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: {
          objectType: "feed";
          content: {
            title: string;
            description: string;
            imageUrl: string;
            link: { mobileWebUrl: string; webUrl: string };
          };
          buttons?: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
        }) => void;
        // 2026-09-28: 팝업 차단 회피용으로 추가 — 버튼에 카카오가 직접 클릭 리스너를 붙입니다.
        createDefaultButton: (options: {
          container: string;
          objectType: "feed";
          content: {
            title: string;
            description: string;
            imageUrl: string;
            link: { mobileWebUrl: string; webUrl: string };
          };
          buttons?: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
        }) => void;
      };
    };
  }
}
