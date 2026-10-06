"use client";

import { useEffect, useRef, useState } from "react";
import { DESSERT, TYPE_LINE2, type TypeCode } from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";
import { InstagramIcon, KakaoBubbleIcon, LinkIcon, NaverIcon, SendIcon, XIcon } from "@/components/BrandIcons";

const KAKAO_BUTTON_ID = "ssol-kakao-share-btn";

interface Props {
  typeCode: TypeCode;
  onClose: () => void;
  onToast: (msg: string) => void;
}

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

  // 링크 복사로 대신할 때 공통으로 쓰는 함수.
  const linkCopyFallback = async (message: string) => {
    try {
      await copyText(shareText + " " + shareUrl);
      onToast(message);
    } catch {
      onToast("복사에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
    onClose();
  };

  // 2026-09-28: "카카오톡 공유 누르면 오류난다" 재확인 결과 — 예전 방식(onClick 안에서
  // Kakao.Share.sendDefault()를 나중에 호출)은 브라우저 입장에서 "방금 사용자가 클릭한
  // 동작"으로 인식되지 않을 때가 많아서, 카카오 SDK가 내부적으로 여는 팝업이 자주 막혔습니다
  // (그 결과 "Cannot read properties of null (reading 'focus')"). 카카오 SDK가 공식
  // 제공하는 createDefaultButton()으로 바꿨습니다 — 이건 카카오가 버튼에 직접 클릭 리스너를
  // 붙이는 방식이라, 실제 클릭으로 인식되어 팝업이 훨씬 안정적으로 열립니다.
  const kakaoBoundRef = useRef(false);
  useEffect(() => {
    kakaoBoundRef.current = false;
    const kakao = typeof window !== "undefined" ? window.Kakao : undefined;
    if (!kakao?.isInitialized()) return;
    try {
      kakao.Share.createDefaultButton({
        container: `#${KAKAO_BUTTON_ID}`,
        objectType: "feed",
        content: {
          title: `${dessert.name} · ${TYPE_LINE2[typeCode]}`,
          description: shareText,
          imageUrl: shareUrl.replace(/\/$/, "") + `/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [{ title: "나도 테스트하기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
      });
      kakaoBoundRef.current = true;
    } catch (err) {
      console.error("카카오 공유 버튼 바인딩 실패:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCode]);

  // 카카오 버튼에 createDefaultButton이 성공적으로 붙었으면 카카오 SDK가 알아서 클릭을
  // 처리하니 여기서는 그냥 시트를 닫기만 합니다. 아직 못 붙었으면(키 없음 등) 링크 복사로
  // 대신합니다.
  const shareToKakao = async () => {
    if (kakaoBoundRef.current) {
      setTimeout(onClose, 250);
      return;
    }
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

  // 2026-10-05: 인스타그램 공유 방식 변경. 예전엔 문구를 복사하고 instagram://camera(스토리 카메라
  // 화면)를 열었는데, 누를 때마다 "스토리 추가하기 카메라"로만 넘어가서 공유가 안 되는 것처럼 보였다.
  // 인스타그램은 웹페이지가 글·사진을 미리 채워 열게 해주지 않으므로, 모바일에서는 기기 공유 창
  // (Web Share API)에 결과 이미지를 파일로 넘겨 거기서 인스타그램(스토리·피드·DM)을 고르게 한다.
  // 지원하지 않는 환경(데스크톱, 일부 인앱 브라우저)에서는 문구를 복사하고 인스타그램 홈을 연다.
  //
  // 공유 이미지: 인스타그램 스토리용 세로 카드(app/api/share/story-card) — 이미지는 시트가 열릴 때 미리 받아둔다 — 누른 뒤에 받으면(await) 일부 브라우저(특히 iOS Safari)가
  // "사용자가 방금 누른 동작"으로 인정하지 않아 share()가 거부되기 때문이다.
  const shareImageRef = useRef<File | null>(null);
  // 인스타그램을 누른 직후, 기기 공유 창이 열려 있는 동안 "인스타그램 → 스토리를 고르세요" 안내를 보여준다.
  const [igGuide, setIgGuide] = useState(false);
  useEffect(() => {
    shareImageRef.current = null;
    let cancelled = false;
    (async () => {
      try {
        // 인스타그램 스토리용 세로 카드(1080×1920)를 우선 쓰고, 못 받으면 캐릭터 이미지로 대신한다.
        let res = await fetch(`/api/share/story-card?type=${typeCode}`);
        let ext = "png";
        if (!res.ok) {
          res = await fetch(`/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`);
          ext = "jpg";
        }
        if (!res.ok) return;
        const blob = await res.blob();
        if (!cancelled) shareImageRef.current = new File([blob], `${dessert.name}.${ext}`, { type: blob.type || (ext === "png" ? "image/png" : "image/jpeg") });
      } catch {
        // 이미지를 못 받아도 아래에서 문구 복사 방식으로 대신하니 무시한다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [typeCode, dessert.icon, dessert.name]);

  const instagramCopyFallback = async () => {
    try {
      await copyText(shareText + " " + shareUrl);
      onToast("공유 문구가 복사됐어요. 인스타그램에서 붙여넣어 올려보세요.");
    } catch {
      onToast("인스타그램 앱을 열게요. 문구는 직접 입력해주세요.");
    }
    openAppOrWeb("instagram://app", "https://www.instagram.com/");
    onClose();
  };

  const shareToInstagram = () => {
    const file = shareImageRef.current;
    const data: ShareData | null = file ? { files: [file], text: shareText + " " + shareUrl } : null;
    const canShareFiles = !!data && typeof navigator !== "undefined" && typeof navigator.share === "function" && !!navigator.canShare?.(data);
    if (!data || !canShareFiles) {
      void instagramCopyFallback();
      return;
    }
    // 클릭과 같은 순간에 시작해야 한다(share는 await 없이 바로 호출). 링크 복사는 동시에 시작해 둔다.
    // 스토리의 링크 스티커에 그대로 붙여넣을 수 있도록 문구 없이 링크만 복사한다(문구는 카드 이미지 안에 있다).
    const copied = copyText(shareUrl).then(
      () => true,
      () => false
    );
    setIgGuide(true);
    navigator
      .share(data)
      .then(async () => {
        setIgGuide(false);
        onToast(
          (await copied)
            ? "링크가 복사됐어요. 인스타그램 스토리의 링크 스티커에 붙여넣어 보세요."
            : "공유 창에서 인스타그램을 골라주세요."
        );
        onClose();
      })
      .catch((err: unknown) => {
        setIgGuide(false);
        // 사용자가 공유 창을 닫은 경우는 오류가 아니라 취소 — 조용히 닫는다.
        if (err instanceof DOMException && err.name === "AbortError") {
          onClose();
          return;
        }
        console.error("인스타그램 공유 실패:", err);
        void instagramCopyFallback();
      });
  };

  // 2026-10-05: 유튜브 버튼 자리를 "링크로 보내기"로 교체. 이미지 없이 문구+링크만 기기 공유 창에 넘기면
  // 인스타그램 DM·문자·메신저가 카카오톡 공유처럼 "저는 ○○ 유형이에요. 당신은 어떤 유형일까요? + 링크"를
  // 한 번에 받는다(이미지가 있으면 인스타 스토리·피드는 글을 버리기 때문에 이 버튼은 일부러 이미지 없이 보낸다).
  // 공유 창을 못 쓰는 환경에서는 같은 문구를 복사한다.
  const sendLink = () => {
    const text = shareText + "\n" + shareUrl;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      navigator
        .share({ text })
        .then(() => onClose())
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            onClose();
            return;
          }
          console.error("링크 보내기 실패:", err);
          void linkCopyFallback("공유 창을 열지 못해 링크를 복사했어요. 원하는 곳에 붙여넣어 보내보세요.");
        });
      return;
    }
    void linkCopyFallback("링크가 복사됐어요. 원하는 곳에 붙여넣어 보내보세요.");
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
        {igGuide && (
          <p className="share-guide" role="status">
            공유 창을 여는 중이에요. 열리면 <strong>인스타그램 → 스토리</strong>를 선택해 주세요.
          </p>
        )}
        <div className="share-grid">
          <button type="button" id={KAKAO_BUTTON_ID} className="share-opt" onClick={shareToKakao}>
            <span className="share-opt-icon" style={{ background: "#FEE500", color: "#3A2E1F" }}>
              <KakaoBubbleIcon width={26} height={26} />
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
          <button type="button" className="share-opt" onClick={sendLink}>
            <span className="share-opt-icon" style={{ background: "var(--navy)", color: "#fff" }}>
              <SendIcon width={22} height={22} />
            </span>
            <span className="lbl">링크로 보내기</span>
          </button>
        </div>
        <button type="button" className="secondary sheet-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
