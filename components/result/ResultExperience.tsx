"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { KakaoBubbleIcon } from "@/components/BrandIcons";
import MailReportModal from "@/components/result/MailReportModal";
import PayBar from "@/components/result/PayBar";
import PaymentConsentSheet from "@/components/result/PaymentConsentSheet";
import ResultPager, { type PagerSlide } from "@/components/result/ResultPager";
import { ProfileSlide, ReportIntroSlide, SectionSlide, TraitsMatchSlide } from "@/components/result/ResultSlides";
import { RESULT_PAGE_COUNT } from "@/components/result/resultPages";
import ShareSheet from "@/components/ShareSheet";
import { guestHeaders } from "@/lib/guest/client";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
import { createClient } from "@/lib/supabase/client";
import { DESSERT, DISCLAIMER, type Gender } from "@/lib/data";
import { leadInIndexFor, SECTION_TITLES, sectionTitlesForAxis } from "@/lib/reportV3/uiSections";
import { detectSpecialResult } from "@/lib/scoring";
import { SPECIAL_RESULTS } from "@/lib/specialResults";
import { useReportAccess } from "@/lib/useReportAccess";
import { useReportPayment } from "@/lib/useReportPayment";
import { trackQuizEvent } from "@/lib/trackQuizEvent";
import { useReportTeaser } from "@/lib/useReportTeaser";

const SOWELLA_URL = "https://app.ssolwellnesshouse.com";
// 2026-10-15: 마지막으로 본 장을 이 탭에 기억 — 결제창·로그인을 다녀와도 보던 장으로 돌아옵니다(점성술 앱의 "결제 후 같은 페이지로").
const SLIDE_KEY = "ssol_result_slide_v2";
// 무료로 읽는 1~3장(유형 정보 · 웰니스 프로파일 · 이런 사람/궁합)에는 결제 바를 보이지 않고, 유료 파트가 시작되는 4장(인덱스 3)부터 보입니다.
const PAY_BAR_FROM_SLIDE = 3;

// 2026-09-25: 로그인 화면에서 "결과 저장하기" 흐름을 마치고 돌아왔을 때(/result?saved=1),
// 저장됐다는 걸 잠깐 토스트로 알려줍니다. useSearchParams는 Suspense 경계 안에서만 정적
// 렌더링과 함께 쓸 수 있어 별도 컴포넌트로 뺐습니다(app/signup/page.tsx와 같은 패턴).
function SavedToastEffect({ onSaved }: { onSaved: () => void }) {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("saved") === "1") onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// v2 스펙 6.5, 10장 — 무료 결과 화면.
// 노출 순서: 디저트 이름 → 계열 태그 → 계열 설명 → 디저트별 대처방식 설명 →
// 영역/대처방식 한 줄 요약 → 오각형 그래프(무료 확정) → 고지문.
export default function ResultExperience({ page }: { page: number | null }) {
  const router = useRouter();
  const { userName, userGender, title, result, savedResultId, setProfile, setResult, setSavedResultId, setPendingAfterSignup, reset } = useQuiz();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailDefault, setMailDefault] = useState("");
  const [initialSlide, setInitialSlide] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  // 2026-09-25: result가 Context에 없을 때(로그인 직후 리다이렉트, 또는 로그인된 채로 이
  // 페이지를 직접 새로고침/주소창 진입한 경우) 바로 "/"로 튕겨내지 않고, 로그인 여부를 먼저
  // 확인해서 저장된 결과가 있으면 불러옵니다. Context는 메모리 상태라 새로고침하면 비어있는
  // 게 정상이라, 이 확인 없이는 로그인된 사용자도 계속 첫 화면으로 밀려나는 문제가 있었습니다.
  useEffect(() => {
    if (result) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // 2026-10-15: 로그인하지 않았어도 이 브라우저에서 저장·결제한 결과(비회원 열쇠)가 있으면 그걸 불러옵니다 —
      // 결제창이나 다른 앱을 다녀와 화면 메모리가 비었을 때 결과를 잃지 않게 하려는 것.
      if (!user && !guestHeaders(false)["x-ssol-guest"]) {
        // 2026-09-28: "비로그인으로 /result에 직접 들어가면 로그인 화면으로" 요청 — 이전엔
        // 첫 화면("/")으로 보냈는데, 여기서는 곧장 로그인 화면으로 보냅니다. /login은 로그인
        // 직후 저장된 결과가 있으면 자동으로 불러와서 다시 /result로 돌려보내는 로직을 이미
        // 갖고 있어서, 그대로 재사용하면 됩니다.
        if (!cancelled) router.replace("/login");
        return;
      }
      const res = await fetch("/api/results", { headers: guestHeaders(false) });
      if (!res.ok) {
        if (!cancelled) router.replace(user ? "/" : "/login");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setProfile(data.userName, data.gender as Gender);
      setResult({
        part1Answers: data.part1Answers,
        part2Answers: data.part2Answers,
        factorScores: data.factorScores,
        axisScores: data.axisScores,
        confirmedAxis: data.confirmedAxis,
        subScores: data.subScores,
        modeScores: data.modeScores,
        confirmedMode: data.confirmedMode,
        typeCode: data.typeCode,
      });
      setSavedResultId(data.id);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const showSavedToast = () => {
    setToast("저장되었습니다!");
    setTimeout(() => setToast(""), 2200);
  };

  // 2026-09-28: "로그인/로그아웃이 어디 보이면 좋겠다"는 요청 — 화면 맨 하단에 현재 로그인
  // 상태에 맞는 링크 하나를 둡니다. 위의 result-복원 effect와는 별개로, result가 이미 있는
  // 상태(방금 테스트를 마친 경우 등)에서도 로그인 여부를 알아야 하므로 따로 확인합니다.
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setIsLoggedIn(!!user);
        setMailDefault(user?.email ?? "");
        setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2026-09-25: "로그인된 상태에서 결과 저장하기를 눌렀는데 왜 다시 로그인/가입 화면으로
  // 보내냐"는 피드백 — 이미 로그인돼 있으면 화면 이동 없이 그 자리에서 바로 저장하고
  // 토스트만 띄웁니다. 로그인이 안 돼 있을 때만 기존처럼 /signup으로 보냅니다.
  const handleSaveClick = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/signup");
      return;
    }
    if (savedResultId) {
      showSavedToast();
      return;
    }
    // 2026-09-27: "이미 저장된 결과가 있는데 다시 저장하면 기존 결과가 사라진다"는 걸 미리
    // 알려달라는 요청 — 저장을 실행하기 전에, 이 계정에 이미 저장된 결과가 있는지 먼저 확인해서
    // 있으면 확인 창을 띄웁니다(진짜 첫 저장이면 확인 없이 바로 저장).
    const existingRes = await fetch("/api/results");
    if (existingRes.status === 200) {
      setConfirmOverwrite(true);
      return;
    }
    await doSave();
  };

  const doSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          gender: userGender,
          part1Answers: result.part1Answers,
          part2Answers: result.part2Answers,
          confirmedAxis: result.confirmedAxis,
          confirmedMode: result.confirmedMode,
          typeCode: result.typeCode,
          axisScores: result.axisScores,
          factorScores: result.factorScores,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error("결과 저장 실패:", res.status, err);
        setToast(`저장에 실패했어요 (${res.status}${err?.reason ? ": " + JSON.stringify(err.reason) : ""}). 다시 시도해주세요.`);
        setTimeout(() => setToast(""), 6000);
        return;
      }
      const data = await res.json();
      if (data?.id) setSavedResultId(data.id);
      showSavedToast();
    } finally {
      setSaving(false);
    }
  };

  // 2026-10-15: 스와이프 결과 화면에 필요한 상태. 훅은 아래 `if (!result) return null`보다 위에 있어야 합니다.
  const isSpecial = result ? !!detectSpecialResult(result.axisScores) : false;
  const viewerOn = !!result && !isSpecial;
  const { phase, assembled, refresh: refreshReport } = useReportAccess(savedResultId, viewerOn);
  const teaser = useReportTeaser(result, userName, userGender, viewerOn);
  const pay = useReportPayment({
    result,
    savedResultId,
    setSavedResultId,
    userName,
    userGender,
    dessertName: result ? DESSERT[result.typeCode].name : "",
    onToast: (m) => {
      setToast(m);
      setTimeout(() => setToast(""), 3500);
    },
  });
  const paywallViewed = useRef(false);

  // 2026-10-15: 장마다 주소가 있습니다(/result/1 ~ /result/10). 주소로 바로 들어오면 그 장이, /result로 들어오면
  // 이 탭에서 마지막으로 본 장(같은 결과일 때만)이나 1장이 열리고 주소가 /result/n으로 바뀝니다.
  const resultKey = result ? `${result.typeCode}|${userName}` : "";
  const pushedPages = useRef<Set<number>>(new Set()); // 우리가 주소를 바꿔 놓은 장 — 그 주소가 도착했을 때는 다시 넘기지 않기 위한 표시
  useEffect(() => {
    if (initialSlide !== null) return;
    if (page !== null) {
      setInitialSlide(Math.min(Math.max(page - 1, 0), RESULT_PAGE_COUNT - 1));
      return;
    }
    if (!result) return; // 결과를 불러오는 중
    let i = 0;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SLIDE_KEY) ?? "null") as { k?: string; i?: number } | null;
      if (saved && saved.k === resultKey && Number.isInteger(saved.i) && (saved.i as number) > 0 && (saved.i as number) < RESULT_PAGE_COUNT) i = saved.i as number;
    } catch {
      /* 기억된 장이 없으면 1장부터 */
    }
    setInitialSlide(i);
    router.replace(`/result/${i + 1}${window.location.search}`, { scroll: false });
  }, [page, result, resultKey, initialSlide, router]);

  const rememberSlide = (i: number) => {
    setCurrentSlide(i);
    try {
      sessionStorage.setItem(SLIDE_KEY, JSON.stringify({ k: resultKey, i }));
    } catch {
      /* 저장소를 못 쓰면 기억만 못 할 뿐입니다. */
    }
    if (i + 1 !== page) {
      pushedPages.current.add(i + 1);
      router.push(`/result/${i + 1}`, { scroll: false });
    }
  };
  // 주소가 우리가 바꾼 게 아니라(뒤로가기·링크) 바뀌었으면 그 장으로 넘기도록 pager에 알립니다.
  const [urlTarget, setUrlTarget] = useState<{ index: number } | undefined>(undefined);
  useEffect(() => {
    if (page === null) return;
    if (pushedPages.current.delete(page)) return;
    setUrlTarget({ index: Math.min(Math.max(page - 1, 0), RESULT_PAGE_COUNT - 1) });
  }, [page]);

  // 결제 전 화면(결제 바가 보이는 상태)에 처음 도달했을 때 한 번 센다(어느 단계에서 떨어지는지 보려는 카운터).
  useEffect(() => {
    if (phase === "locked" && viewerOn && currentSlide >= PAY_BAR_FROM_SLIDE && !paywallViewed.current) {
      paywallViewed.current = true;
      trackQuizEvent("paywall_view");
    }
  }, [phase, viewerOn, currentSlide]);

  if (!result || (!isSpecial && initialSlide === null)) return null;

  // 2026-09-29: 이스터에그 히든 결과 — 5개 영역이 전부 5.00점 또는 전부 1.00점이면 15유형
  // 체계를 벗어난 특별 결과를 보여줍니다. 심층 리포트가 필요 없는 유형이라 그 CTA와 "다른
  // 유형과의 관계" 섹션은 없고, 결과 저장·공유(생략)·다시 하기·로그인 상태 표시는 그대로 둡니다.
  const specialKey = detectSpecialResult(result.axisScores);
  if (specialKey) {
    const content = SPECIAL_RESULTS[specialKey];
    return (
      <div className="card">
        <Suspense fallback={null}>
          <SavedToastEffect onSaved={showSavedToast} />
        </Suspense>
        <div className="res-avatar">
          <Image src={content.image} alt={content.title} fill sizes="480px" priority style={{ objectFit: "contain" }} />
        </div>
        {content.tagBadge && (
          <p className="kicker kicker-sm" style={{ textAlign: "center" }}>
            {content.tagBadge}
          </p>
        )}
        <p className="type-reveal" style={{ textAlign: "center" }}>
          <span className="type-name-inline serif">{content.title}</span>
        </p>
        <p className="type-blurb" style={{ textAlign: "center", fontWeight: 600 }}>{content.subtitle}</p>

        {content.body.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">{content.listTitle}</p>
        <ul className="traits">
          {content.list.map((item, i) => (
            <li key={i}>
              <b>{item.label}:</b> {item.text}
            </li>
          ))}
        </ul>

        <div className="cta">
          <p className="cta-title">{content.calloutTitle}</p>
          <p>{content.callout}</p>
        </div>

        <p className="type-blurb" style={{ textAlign: "center", fontStyle: "italic", marginTop: 16 }}>
          &ldquo;{content.quote}&rdquo;
        </p>

        <div className="share-row">
          <button className="secondary" onClick={handleSaveClick} disabled={saving}>
            {saving ? "저장 중..." : "결과 저장하기"}
          </button>
        </div>
        {toast && <div className="toast">{toast}</div>}

        {confirmOverwrite && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <p className="confirm-msg">이미 저장된 결과가 있어요. 다시 저장할 경우 기존 결과는 사라집니다.</p>
              <div className="confirm-actions">
                <button className="secondary" onClick={() => setConfirmOverwrite(false)}>
                  취소
                </button>
                <button
                  onClick={() => {
                    setConfirmOverwrite(false);
                    doSave();
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          className="secondary restart"
          onClick={() => {
            reset();
            router.push("/");
          }}
        >
          다시 해보기
        </button>

        <div className="notice">{content.footnote ?? DISCLAIMER}</div>

        {authChecked && !isLoggedIn && (
          <button type="button" className="secondary" style={{ marginTop: 14 }} onClick={() => router.push("/login")}>
            로그인하고 저장하기
          </button>
        )}
      </div>
    );
  }

  const { confirmedAxis, typeCode } = result;
  const dessert = DESSERT[typeCode];
  const { sectionTitle3, sectionTitle4, sectionTitle5 } = sectionTitlesForAxis(confirmedAxis);
  const sectionMeta = [
    { num: 2, title: SECTION_TITLES[1], key: "section2" as const },
    { num: 3, title: sectionTitle3, key: "section3" as const },
    { num: 4, title: sectionTitle4, key: "section4" as const },
    { num: 5, title: sectionTitle5, key: "section5" as const },
    { num: 6, title: SECTION_TITLES[5], key: "section6" as const },
    { num: 7, title: SECTION_TITLES[6], key: "section7" as const },
    { num: 8, title: SECTION_TITLES[7], key: "section8" as const },
  ];

  // 2장부터 아래에 붙는 "카카오톡 공유 + 저장하기"
  const shareSaveRow = (
    <div className="share-row">
      {/* 2026-10-06: 눈에 잘 안 띈다는 피드백 — 카카오톡 노란색 + 말풍선 아이콘으로 강조(라벨은 그대로, 공유 창은 여러 곳으로 공유됨). */}
      <button className="kakao-share" onClick={() => setSheetOpen(true)}>
        <KakaoBubbleIcon width={18} height={18} />
        내 결과 공유하기
      </button>
      <button className="secondary" onClick={handleSaveClick} disabled={saving}>
        {saving ? "저장 중..." : "결과 저장하기"}
      </button>
    </div>
  );

  // 결제는 했지만 아직 가입하지 않은 사람에게: 이 기기에서만 볼 수 있다는 것과 가입 시 이어지는 혜택을 알려줍니다.
  const guestPaidNotice =
    phase !== "locked" && phase !== "checking" && authChecked && !isLoggedIn ? (
      <div className="cta guest-notice">
        <p className="cta-title">가입하면 리포트를 안전하게 보관해요</p>
        <p>지금은 이 기기에서만 볼 수 있어요. 가입하면 어디서든 열어볼 수 있고, 쏘웰라 1주일 체험권이 시작돼요.</p>
        <button
          onClick={() => {
            stashPendingQuizForOAuth({ userName, userGender, result, savedResultId, pendingAfterSignup: "/result" }, false);
            setPendingAfterSignup("/result");
            router.push("/signup");
          }}
        >
          가입하고 보관하기
        </button>
      </div>
    ) : null;

  const sectionSlides: PagerSlide[] = sectionMeta.map(({ num, title, key }, n) => {
    const raw = assembled?.[key];
    // 2026-09-30: 8번의 마지막 문단("이 리포트와 함께 AI 채팅 이용권이...")은 카드 안이 아니라 아래에 따로 강조해 보여줍니다.
    const paragraphs = raw ? (key === "section8" ? raw.slice(0, -1) : raw) : undefined;
    const isLast = key === "section8";
    return {
      key,
      label: title,
      node: (
        <>
          {n === 0 && guestPaidNotice}
          <SectionSlide
            num={num}
            title={title}
            phase={phase}
            dessertName={dessert.name}
            paragraphs={paragraphs}
            leadInIndex={raw ? leadInIndexFor(key, paragraphs ?? []) : null}
            teaser={teaser.sections?.find((t) => t.num === num)}
            teaserFailed={teaser.failed}
            onPay={pay.requestPay}
            onRetry={refreshReport}
            busy={pay.busy}
            extra={
              isLast && phase === "ready" && assembled && assembled.section8.length > 0 ? (
                <div className="section8-highlight">
                  <p>{assembled.section8[assembled.section8.length - 1]}</p>
                </div>
              ) : null
            }
          />
          {isLast && (
            <div className="report-actions">
              {phase === "ready" && (
                <>
                  <button className="secondary" style={{ width: "100%" }} onClick={() => setMailOpen(true)}>
                    메일로 보내기
                  </button>
                  <p className="tiny" style={{ textAlign: "center", margin: "10px 0 8px" }}>
                    가입하신 계정으로 쏘웰라를 그대로 이용하실 수 있어요.
                  </p>
                  <a className="link-btn-lg report-actions-sowella" href={SOWELLA_URL}>
                    AI 기반 웰니스 채팅 쏘웰라로 이동하기
                  </a>
                </>
              )}
              <button className="secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => router.push("/history")}>
                지난 테스트 결과 열람하기
              </button>
              <button
                className="secondary restart"
                onClick={() => {
                  reset();
                  router.push("/");
                }}
              >
                다시 해보기
              </button>
              <div className="notice">{DISCLAIMER}</div>
              {authChecked && !isLoggedIn && (
                <button type="button" className="secondary" style={{ marginTop: 14 }} onClick={() => router.push("/login")}>
                  로그인하고 저장하기
                </button>
              )}
            </div>
          )}
        </>
      ),
      bottom: shareSaveRow,
    };
  });

  const slides: PagerSlide[] = [
    {
      key: "profile",
      label: "나의 유형",
      node: <ProfileSlide userName={userName} title={title} result={result} />,
    },
    {
      key: "report-intro",
      label: "웰니스 프로파일",
      node: <ReportIntroSlide userName={userName} title={title} result={result} section1={phase === "ready" && assembled ? assembled.section1 : teaser.section1} />,
      bottom: shareSaveRow,
    },
    {
      key: "traits",
      label: "나와 잘 맞는 유형",
      node: <TraitsMatchSlide typeCode={typeCode} confirmedAxis={confirmedAxis} onMatch={() => router.push("/match")} />,
      bottom: shareSaveRow,
    },
    ...sectionSlides,
  ];

  return (
    <div className="card result-card">
      <Suspense fallback={null}>
        <SavedToastEffect onSaved={showSavedToast} />
      </Suspense>

      <ResultPager slides={slides} initialIndex={initialSlide ?? 0} onIndexChange={rememberSlide} target={urlTarget} />

      {toast && <div className="toast">{toast}</div>}

      {confirmOverwrite && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <p className="confirm-msg">이미 저장된 결과가 있어요. 다시 저장할 경우 기존 결과는 사라집니다.</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setConfirmOverwrite(false)}>
                취소
              </button>
              <button
                onClick={() => {
                  setConfirmOverwrite(false);
                  doSave();
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentConsentSheet open={pay.consentOpen} onClose={pay.closeConsent} onConfirm={pay.confirmAndPay} />
      <MailReportModal open={mailOpen} defaultEmail={mailDefault} resultId={savedResultId} onClose={() => setMailOpen(false)} onToast={setToast} />

      {/* 4장부터(심층 리포트 2번 파트부터 — 무료 장 1~3장 뒤) 결제 전이면 화면 아래에 고정되는 결제 바. 결제 확인이 끝나기 전(checking)에는 숨깁니다. */}
      {phase === "locked" && currentSlide >= PAY_BAR_FROM_SLIDE && (
        <>
          <div style={{ height: 84 }} aria-hidden="true" />
          <PayBar onPay={pay.requestPay} busy={pay.busy} />
        </>
      )}

      {sheetOpen && <ShareSheet typeCode={typeCode} onClose={() => setSheetOpen(false)} onToast={setToast} />}
    </div>
  );
}
