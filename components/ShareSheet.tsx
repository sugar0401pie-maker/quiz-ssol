"use client";

import { DESSERT, TYPE_LINE2, type TypeCode } from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";
import { InstagramIcon, KakaoTalkIcon, LinkIcon, NaverIcon, XIcon, YoutubeIcon } from "@/components/BrandIcons";

interface Props {
  typeCode: TypeCode;
  onClose: () => void;
  onToast: (msg: string) => void;
}

// TODO: 2단계에서 실제 연동 — 유튜브 채널 주소를 쏠 웰니스 하우스 실제 공식 채널 주소로 교체
const YOUTUBE_URL = "https://youtube.com/@ssolwellness";

// 모바일에서는 앱이 깔려 있으면 앱으로, 없으면 웹으로 열리도록 시도합니다.
// 원리: 커스텀 URL 스킴(appUrl)으로 이동을 시도하고, 잠시 후에도 페이지가 그대로면
// (= 다른 앱으로 전환되지 않았다면) 앱이 없는 것으로 보고 webUrl로 대신 이동합니다.
// 데스크톱에서는 애초에 앱이 없으니 바로 웹으로 엽니다.
function openAppOrWeb(appUrl: string, webUrl: string) {
  if (typeof window === "undefined") return;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) {
    window.open(webUrl, "_blank");
    return;
  }
  let switchedApp = false;
  const onVisibility = () => {
    if (document.hidden) switchedApp = true;
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.location.href = appUrl;
  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibility);
    if (!switchedApp) window.location.href = webUrl;
  }, 1200);
}

// navigator.clipboard 는 https/localhost 에서만 동작하므로, 그 외 환경을 위해 execCommand 로 한 번 더 시도합니다.
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error("copy failed");
  }
}

export default function ShareSheet({ typeCode, onClose, onToast }: Props) {
  const dessert = DESSERT[typeCode];
  const shareText =
    '저는 쏠 웰니스 유형 테스트에서 "' + dessert.name + '" 가 나왔어요. 당신은 어떤 유형일까요?';
  // 결과 화면은 응답 상태(메모리)에 의존하므로, 공유 링크는 테스트 시작 주소(사이트 루트)를 사용합니다.
  // TODO: 2단계에서 실제 연동 — 결과 저장 후 결과별 공유 URL(/r/[id])과 OG 이미지로 교체
  const shareUrl = typeof window !== "undefined" ? window.location.origin + "/" : "";

  // 카카오톡 공유가 안 된다는 의견이 있어 확인해보니: PC 브라우저(또는 카카오톡/인스타그램 인앱
  // 브라우저처럼 팝업 자체를 막는 환경)에서는 Kakao.Share.sendDefault()가 sharer.kakao.com을 새
  // 창으로 여는데, 그 팝업이 차단되면 카카오 SDK 내부에서 "Cannot read properties of null
  // (reading 'focus')" 에러가 처리되지 않은 채로 터지면서 아무 반응도 없는 것처럼 보였습니다.
  // → 미리 빈 팝업을 하나 띄워봐서 막혀 있는지 먼저 확인하고, 막혀 있으면 SDK를 아예 부르지 않고
  //   바로 링크 복사로 대신합니다(사용자에게는 항상 뭔가는 되는 것처럼 보여야 하니까요).
  const linkCopyFallback = async (message: string) => {
    try {
      await copyText(shareText + " " + shareUrl);
      onToast(message);
    } catch {
      onToast("링크 복사에 실패했어요. 브라우저의 팝업 차단을 해제한 뒤 다시 시도해주세요.");
    }
    onClose();
  };

  const shareToKakao = async () => {
    const kakao = typeof window !== "undefined" ? window.Kakao : undefined;
    if (kakao?.isInitialized()) {
      const probe = window.open("", "_blank");
      if (!probe) {
        await linkCopyFallback("카카오톡 공유 팝업이 차단돼 있어요. 대신 링크가 복사됐어요 — 카카오톡에 붙여넣어 보내보세요.");
        return;
      }
      probe.close();

      // 팝업 확인을 통과해도, 카카오 SDK가 내부적으로 창을 다시 여는 시점이 늦어지면 그 사이에
      // 브라우저가 뒤늦게 막아버리는 경우가 남아있어요. 그때 SDK 내부에서 던지는 처리 안 된
      // 에러가 사용자에게 그대로 노출되지 않도록 잠깐만 감시해서 조용히 안내로 바꿔치기합니다.
      const onUnhandled = (e: PromiseRejectionEvent) => {
        const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
        if (msg.includes("focus")) {
          e.preventDefault();
          linkCopyFallback("카카오톡 공유창을 열지 못했어요. 대신 링크가 복사됐어요 — 카카오톡에 붙여넣어 보내보세요.");
        }
      };
      window.addEventListener("unhandledrejection", onUnhandled);
      setTimeout(() => window.removeEventListener("unhandledrejection", onUnhandled), 3000);

      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `${dessert.name} · ${TYPE_LINE2[typeCode]}`,
          description: shareText,
          imageUrl: shareUrl.replace(/\/$/, "") + `/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [{ title: "나도 테스트하기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
      });
      onClose();
      return;
    }
    // 카카오 JS 키가 아직 없으면(NEXT_PUBLIC_KAKAO_JS_KEY 미설정) 링크 복사로 대신합니다.
    await linkCopyFallback("카카오톡 공유는 준비 중이에요. 대신 링크가 복사됐어요 — 카카오톡에 붙여넣어 보내보세요.");
  };

  const copyResultLink = async () => {
    try {
      await copyText(shareText + " " + shareUrl);
      onToast("링크가 복사됐어요.");
    } catch {
      onToast("복사에 실패했어요.");
    }
    onClose();
  };

  const shareToNaverBlog = () => {
    const url =
      "https://share.naver.com/web/shareView?url=" + encodeURIComponent(shareUrl) + "&title=" + encodeURIComponent(shareText);
    window.open(url, "_blank");
    onClose();
  };

  const shareToTwitter = () => {
    const webUrl =
      "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText) + "&url=" + encodeURIComponent(shareUrl);
    const appUrl = "twitter://post?message=" + encodeURIComponent(shareText + " " + shareUrl);
    openAppOrWeb(appUrl, webUrl);
    onClose();
  };

  // 인스타그램은 외부 웹페이지가 게시물 내용을 미리 채워 넣도록 허용하지 않습니다 (Instagram 플랫폼
  // 자체 제약 — 사진/글 자동 첨부는 인스타그램 앱 SDK를 쓰는 네이티브 앱에서만 가능해요).
  // 그래서 여기서는 문구를 클립보드에 복사해두고, 본인 계정으로 카메라/스토리 작성 화면을 열어드려요.
  // 붙여넣기는 사용자가 직접 해야 해요.
  const shareToInstagram = async () => {
    try {
      await copyText(shareText + " " + shareUrl);
      onToast("공유 문구가 복사됐어요. 인스타그램에서 붙여넣어 올려보세요.");
    } catch {
      onToast("인스타그램 앱을 열게요. 문구는 직접 입력해주세요.");
    }
    openAppOrWeb("instagram://camera", "https://www.instagram.com/");
    onClose();
  };

  const goYoutube = () => {
    openAppOrWeb(YOUTUBE_URL.replace("https://", "vnd.youtube://"), YOUTUBE_URL);
    onClose();
  };

  return (
    <div
      className="sheet-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-handle" />
        <p className="sheet-title">결과 공유하기</p>
        <div className="share-grid">
          <button type="button" className="share-opt" onClick={shareToKakao}>
            <span className="share-opt-icon" style={{ background: "#FEE500", color: "#3A2E1F" }}>
              <KakaoTalkIcon width={24} height={24} />
            </span>
            <span className="lbl">카카오톡</span>
          </button>
          <button type="button" className="share-opt" onClick={copyResultLink}>
            <span className="share-opt-icon" style={{ background: "var(--sky-bg)", color: "var(--navy-soft)" }}>
              <LinkIcon width={22} height={22} />
            </span>
            <span className="lbl">링크 복사</span>
          </button>
          <button type="button" className="share-opt" onClick={shareToNaverBlog}>
            <span className="share-opt-icon" style={{ background: "#03C75A", color: "#fff" }}>
              <NaverIcon width={20} height={20} />
            </span>
            <span className="lbl">네이버 블로그</span>
          </button>
          <button type="button" className="share-opt" onClick={shareToTwitter}>
            <span className="share-opt-icon" style={{ background: "var(--ink)", color: "#fff" }}>
              <XIcon width={20} height={20} />
            </span>
            <span className="lbl">트위터</span>
          </button>
          <button type="button" className="share-opt" onClick={shareToInstagram}>
            <span
              className="share-opt-icon"
              style={{ background: "linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)", color: "#fff" }}
            >
              <InstagramIcon width={22} height={22} />
            </span>
            <span className="lbl">인스타그램</span>
          </button>
          <button type="button" className="share-opt" onClick={goYoutube}>
            <span className="share-opt-icon" style={{ background: "#FF0000", color: "#fff" }}>
              <YoutubeIcon width={24} height={24} />
            </span>
            <span className="lbl">유튜브</span>
          </button>
        </div>
        <button type="button" className="secondary sheet-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
