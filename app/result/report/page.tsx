"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { ReportParagraph } from "@/components/ReportParagraph";
import ReportTeaser from "@/components/ReportTeaser";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
import { DESSERT } from "@/lib/data";
import { ensureSavedResult as ensureSavedResultShared } from "@/lib/reportV3/ensureSavedResult";
import { REPORT_PRICE, formatWon } from "@/lib/pricing";
import type { TeaserSection } from "@/lib/reportV3/teaser";
import { SECTION_TITLES, sectionTitlesForAxis } from "@/lib/reportV3/uiSections";
import { trackQuizEvent } from "@/lib/trackQuizEvent";
import { createClient } from "@/lib/supabase/client";
import { EUL_REUL, I_GA } from "@/lib/josa";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-09-28: "심층보고서를 완전히 별도 페이지로 만들고 거기로 리디렉션" 요청 — 이 페이지는
// 이제 결제 확인·잠금(paywall)·실패 상태만 다룹니다. 완성된 리포트는 항상
// /result/report/view로, 생성 대기는 /result/report/generating으로 리다이렉트합니다
// (이 두 상태만 각자의 별도 페이지를 가지고, 여기 남는 건 "아직 안 끝난" 상태들뿐입니다).
// "결제했는데도 잠금 화면이 계속 보인다" 문제 — 서버 응답 중 "none"(아직 결제 확인 전)
// 케이스를 처리하는 분기가 없어서, 한 번이라도 이 응답을 받으면 화면이 "locked"에 멈춰
// 결제 버튼이 계속 활성화돼 있을 수 있었습니다(이중결제 위험). "locked"는 이제 서버가
// "결제된 주문 없음"을 명시적으로 확인해준 경우에만 들어가고, 그 전에는 중립적인 "checking"
// 상태를 보여줍니다(결제 버튼 없음).
type ViewState = "checking" | "locked";

export default function ReportPage() {
  const router = useRouter();
  const { result, savedResultId, setSavedResultId, userName, userGender, setPendingAfterSignup } = useQuiz();
  const [toast, setToast] = useState("");
  const [view, setView] = useState<ViewState>("checking");
  const [busy, setBusy] = useState(false);
  const [section1, setSection1] = useState<string[] | null>(null);
  const [teaser, setTeaser] = useState<TeaserSection[] | null>(null);
  const paywallViewed = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 2026-09-28: "결제해야 열려요" 안내가 결제 후에도 계속 보이던 버그 — 토스트가 한 번 뜨면
  // 스스로 사라지지 않고 다음 화면까지 그대로 남아있었습니다. 일정 시간 뒤 자동으로 지웁니다.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  // gpt-6-sol(reasoning) 생성 중엔 서버가 "generating" 락 상태를 반환합니다 — 완성/대기
  // 상태는 각자의 별도 페이지로 바로 넘어가고, 여기서는 그 신호가 올 때까지만 기다립니다.
  const fetchReport = async (resultId: string) => {
    let data: { status?: string } | null = null;
    try {
      const res = await fetch(`/api/report/generate?resultId=${resultId}`);
      if (!res.ok) return; // 타임아웃 등 — 다음 폴링에서 재시도
      data = await res.json();
    } catch {
      return; // 네트워크 오류 — 다음 폴링에서 재시도
    }
    if (data?.status === "ready") {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      router.replace("/result/report/view");
    } else if (data?.status === "generating") {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      router.replace("/result/report/generating");
    } else if (data?.status === "failed") {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      router.replace("/result/report/failed");
    } else if (data?.status === "none") {
      // 서버가 "결제된 주문이 없다"고 명시적으로 확인해준 경우에만 잠금 화면(결제 버튼)을 보여줍니다.
      setView("locked");
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }
    // 그 외(네트워크 오류·타임아웃 등)는 view를 바꾸지 않고 다음 폴링에서 재시도합니다.
  };

  useEffect(() => {
    // 저장된 결과 자체가 없으면(아직 로그인/저장 전) 확인할 주문이 없으니 바로 잠금 화면입니다.
    if (!savedResultId) {
      setView("locked");
      return;
    }
    fetchReport(savedResultId);
    pollTimer.current = setInterval(() => fetchReport(savedResultId), 4000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedResultId]);

  // 2026-09-28: 섹션 1(웰니스 프로파일) 무료 공개 — 결제 전에도 로그인+저장된 결과만 있으면
  // AI가 쓴 전체 내용을 볼 수 있습니다(한 번 생성하면 서버에 캐싱돼요).
  // 2026-09-29: view === "locked"일 때만 호출하도록 제한 — 그 전엔 "checking" 상태라
  // 결제 확인 중이거나 곧 /generating·/view로 리다이렉트될 수 있는데, 그런 경우까지 매번
  // 이 fetch가 나가면 화면에 보여주지도 않을 섹션1을 AI가 새로 쓰고(비용 발생) 바로 버려집니다.
  useEffect(() => {
    if (view !== "locked" || !savedResultId) return;
    (async () => {
      try {
        const res = await fetch(`/api/report/preview?resultId=${savedResultId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.section1) setSection1(data.section1);
      } catch {
        // 실패해도 잠금 목록에 1번을 다시 보여주는 것으로 자연스럽게 대체됩니다.
      }
    })();
  }, [view, savedResultId]);

  // 2026-10-07: 결제 전 화면에 처음 도달했을 때 한 번 센다(어느 단계에서 떨어지는지 보려는 카운터).
  useEffect(() => {
    if (view === "locked" && !paywallViewed.current) {
      paywallViewed.current = true;
      trackQuizEvent("paywall_view");
    }
  }, [view]);

  // 2026-10-07: 블러 미리보기 문장 — 로그인하지 않았어도 응답만 있으면 서버가 점수를 다시 계산해 만들어 준다(저장 안 함).
  useEffect(() => {
    if (view !== "locked" || !result || teaser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/report/teaser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName,
            gender: userGender,
            part1Answers: result.part1Answers,
            part2Answers: result.part2Answers,
            confirmedAxis: result.confirmedAxis,
            confirmedMode: result.confirmedMode,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.sections)) setTeaser(data.sections);
      } catch {
        // 미리보기를 못 받으면 예전처럼 제목만 있는 잠금 카드를 보여준다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, result, teaser, userName, userGender]);

  if (!result) return null;
  const { typeCode, confirmedAxis, axisScores } = result;
  const dessert = DESSERT[typeCode];

  const ensureSavedResult = () => ensureSavedResultShared({ savedResultId, setSavedResultId, userName, userGender, result });

  const payForReport = async () => {
    trackQuizEvent("pay_click");
    setBusy(true);
    const outcome = await ensureSavedResult();
    if (!outcome.ok) {
      setBusy(false);
      if (outcome.reason === "not_logged_in") {
        trackQuizEvent("signup_wall");
        setPendingAfterSignup("/result/report");
        router.push("/signup");
        return;
      }
      setToast("결과를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
      setBusy(false);
      setToast("결제 기능은 곧 열릴 예정이에요. 잠시만 기다려주세요!");
      return;
    }
    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: outcome.id }),
      });
      if (!orderRes.ok) {
        setToast("주문을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
        setBusy(false);
        return;
      }
      const { orderId, amount } = await orderRes.json();

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setToast("로그인이 필요해요.");
        setBusy(false);
        return;
      }

      stashPendingQuizForOAuth({ userName, userGender, result, savedResultId: outcome.id, pendingAfterSignup: "/result/report" }, false);

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const widgets = toss.widgets({ customerKey: user.id });
      await widgets.setAmount({ currency: "KRW", value: amount });
      const paymentWindow = await widgets.renderPaymentWindow({
        variantKey: { paymentMethod: "DEFAULT", agreement: "AGREEMENT" },
      });
      trackQuizEvent("pay_window");
      paymentWindow.on("cancel", async () => {
        setBusy(false);
      });
      paymentWindow.on("paymentRequest", async () => {
        await widgets.requestPayment({
          orderId,
          orderName: `${dessert.name} 심층 리포트`,
          successUrl: `${window.location.origin}/api/payments/confirm`,
          failUrl: `${window.location.origin}/auth/finish`,
          customerEmail: user.email ?? undefined,
        });
      });
      setBusy(false);
    } catch (err) {
      console.error("결제 시작 실패:", err);
      setToast("결제가 진행되지 않았어요. 취소했거나 문제가 생겼을 수 있어요.");
      setBusy(false);
    }
  };

  // 개발자 전용: 토스 테스트 키가 아직 없을 때 결제를 건너뛰고 생성 파이프라인만 테스트합니다.
  const devSkipPayment = async () => {
    setBusy(true);
    const outcome = await ensureSavedResult();
    if (!outcome.ok) {
      setBusy(false);
      setToast("결과 저장에 실패했어요.");
      return;
    }
    const orderRes = await fetch("/api/dev/report-test-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: outcome.id }),
    });
    setBusy(false);
    if (!orderRes.ok) {
      setToast("테스트 주문 생성에 실패했어요.");
      return;
    }
    await fetchReport(outcome.id);
  };

  const backBtn = (
    <button className="secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }} onClick={() => router.push("/result")}>
      ← 뒤로
    </button>
  );

  const { sectionTitle3, sectionTitle4, sectionTitle5 } = sectionTitlesForAxis(confirmedAxis);

  if (view === "checking") {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          미리 구워놓은 {dessert.name}{I_GA(dessert.name)} 있는지 찾고 있어요...
        </p>
      </div>
    );
  }

  // locked (기본 상태) — 섹션 1(웰니스 프로파일)은 로그인+저장된 결과가 있으면 무료로 전체
  // 공개되고(AI가 쓴 내용 그대로), 2~8번은 결제 후 열립니다.
  return (
    <div className="card">
      {backBtn}
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>

      <RadarChart scores={axisScores} />

      {savedResultId && (
        <>
          <p className="traits-title" style={{ marginTop: 20 }}>1. {SECTION_TITLES[0]}</p>
          {section1 ? (
            section1.map((p, i) => (
              <ReportParagraph key={i} text={p} className="type-blurb" />
            ))
          ) : (
            <p className="muted pulse-text">
              {dessert.name}
              {EUL_REUL(dessert.name)} 정성껏 굽고 있어요...
            </p>
          )}
        </>
      )}

      {teaser ? (
        <ReportTeaser sections={teaser} priceLabel={`${formatWon(REPORT_PRICE)}원`} onPay={payForReport} busy={busy} />
      ) : (
        <>
      <p className="muted" style={{ margin: "20px 0" }}>
            결제하면 나머지 섹션까지 전체가 열려요.
          </p>
    
          {[
            { num: 1, title: SECTION_TITLES[0] },
            { num: 2, title: SECTION_TITLES[1] },
            { num: 3, title: sectionTitle3 },
            { num: 4, title: sectionTitle4 },
            { num: 5, title: sectionTitle5 },
            { num: 6, title: SECTION_TITLES[5] },
            { num: 7, title: SECTION_TITLES[6] },
            { num: 8, title: SECTION_TITLES[7] },
          ]
            .filter((s) => !(savedResultId && s.num === 1)) // 1번은 위에서 이미 무료로 열려 있으니 잠금 목록에서 뺍니다.
            .map(({ num, title }) => (
              <div
                key={num}
                className="report-section"
                onClick={() => setToast("🔒 이 항목은 결제 후 열려요. 아래에서 3,500원 결제하고 전체를 확인해보세요.")}
              >
                <div className="report-section-head">
                  <span className="r-num">{num}</span>
                  <div>
                    <p className="r-title">{title}</p>
                  </div>
                  <span className="r-lock">🔒</span>
                </div>
              </div>
            ))}
        </>
      )}

      <div className="report-paywall">
        <p className="report-paywall-promo">
          출시 기념 한정 기간동안 단 3,500원에 테스트 결과 심층 리포트 + 웰니스 채팅 &lsquo;쏘웰라&rsquo; 1주일 무료 멤버십까지 이용하실 수 있어요.
        </p>
        <button className="btn-lg" onClick={payForReport} disabled={busy}>
          결제하고 보고서 바로 열람하기
        </button>
        <p className="report-paywall-note">버튼을 누르면 결제 창으로 연결돼요.</p>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <button className="secondary" style={{ marginTop: 10 }} onClick={devSkipPayment} disabled={busy}>
          [개발자 전용] 결제 건너뛰고 바로 생성
        </button>
      )}
      {toast && <div className="toast">{toast}</div>}

      {/* 2026-10-07: 스크롤해도 따라다니는 결제 바(결제율 개선). 가격을 항상 보여준다. */}
      <div style={{ height: 84 }} aria-hidden="true" />
      <div className="paywall-bar">
        <div className="paywall-bar-inner">
          <div className="paywall-bar-price">
            <strong>심층 리포트 {formatWon(REPORT_PRICE)}원</strong>
            쏘웰라 1주일 체험권 포함
          </div>
          <button className="btn-lg" onClick={payForReport} disabled={busy}>
            이어서 읽기
          </button>
        </div>
      </div>
    </div>
  );
}
