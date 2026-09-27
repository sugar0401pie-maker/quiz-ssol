"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
import { DESSERT, type TypeCode } from "@/lib/data";
import { buildRelationshipSections, type RelationshipSections } from "@/lib/relationshipReport";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

const SECTION_TITLES = ["두 사람 소개", "관계의 결", "대처 방식 비교", "함께 있을 때 좋은 점", "배려하면 좋은 점", "이번 주 제안"];

type ViewState = "locked" | "ready";

interface ReadyAssembled extends RelationshipSections {
  friendTypeCode: TypeCode;
  friendName: string;
}

// v2 스펙 8·9장 응용 — "유형간 관계성 보고서". /match에서 상대 유형을 고르고 나온 뒤,
// 3,500원을 내면 두 사람의 관계를 더 깊이 풀어서 보여줍니다. 1번(두 사람 소개)은 무료입니다.
function RelationshipReportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { result, savedResultId, setSavedResultId, userName, userGender, setPendingAfterSignup } = useQuiz();
  const [toast, setToast] = useState("");
  const [view, setView] = useState<ViewState>("locked");
  const [assembled, setAssembled] = useState<ReadyAssembled | null>(null);
  const [busy, setBusy] = useState(false);

  const friendTypeCode = params.get("friend") as TypeCode | null;
  const friendName = params.get("friendName") || (friendTypeCode ? DESSERT[friendTypeCode].name : "");

  useEffect(() => {
    if (!result || !friendTypeCode || !(friendTypeCode in DESSERT)) router.replace("/");
  }, [result, friendTypeCode, router]);

  const fetchReport = async (resultId: string, friend: TypeCode) => {
    const res = await fetch(`/api/relationship-report/generate?resultId=${resultId}&friend=${friend}&friendName=${encodeURIComponent(friendName)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === "ready" && data.assembled) {
      setAssembled(data.assembled);
      setView("ready");
    }
  };

  useEffect(() => {
    if (savedResultId && friendTypeCode) fetchReport(savedResultId, friendTypeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedResultId, friendTypeCode]);

  if (!result || !friendTypeCode || !(friendTypeCode in DESSERT)) return null;
  const { typeCode } = result;
  const overview = buildRelationshipSections(userName, typeCode, friendName, friendTypeCode).overview;

  const tapLocked = () => setToast("🔒 이 항목은 결제 후 열려요. 아래에서 3,500원 결제하고 전체를 확인해보세요.");

  type EnsureResult = { ok: true; id: string } | { ok: false; reason: "not_logged_in" | "save_failed" };
  const ensureSavedResult = async (): Promise<EnsureResult> => {
    if (savedResultId) return { ok: true, id: savedResultId };
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "not_logged_in" };
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
    if (!res.ok) return { ok: false, reason: "save_failed" };
    const data = await res.json();
    if (data?.id) {
      setSavedResultId(data.id);
      return { ok: true, id: data.id };
    }
    return { ok: false, reason: "save_failed" };
  };

  const returnPath = `/result/report/relationship?friend=${friendTypeCode}&friendName=${encodeURIComponent(friendName)}`;

  const payForReport = async () => {
    setBusy(true);
    const outcome = await ensureSavedResult();
    if (!outcome.ok) {
      setBusy(false);
      if (outcome.reason === "not_logged_in") {
        setPendingAfterSignup(returnPath);
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
        body: JSON.stringify({ resultId: outcome.id, reportKind: "relationship", friendTypeCode }),
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

      stashPendingQuizForOAuth({ userName, userGender, result, savedResultId: outcome.id, pendingAfterSignup: returnPath }, false);

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const widgets = toss.widgets({ customerKey: user.id });
      await widgets.setAmount({ currency: "KRW", value: amount });
      const paymentWindow = await widgets.renderPaymentWindow({
        variantKey: { paymentMethod: "DEFAULT", agreement: "AGREEMENT" },
      });
      paymentWindow.on("cancel", async () => {
        setBusy(false);
      });
      paymentWindow.on("paymentRequest", async () => {
        await widgets.requestPayment({
          orderId,
          orderName: `${DESSERT[typeCode].name} × ${friendName} 관계성 리포트`,
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

  // 개발자 전용: 토스 테스트 키가 없을 때 결제를 건너뛰고 생성 파이프라인만 테스트합니다.
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
      body: JSON.stringify({ resultId: outcome.id, reportKind: "relationship", friendTypeCode }),
    });
    setBusy(false);
    if (!orderRes.ok) {
      setToast("테스트 주문 생성에 실패했어요.");
      return;
    }
    await fetchReport(outcome.id, friendTypeCode);
  };

  const backBtn = (
    <button
      className="secondary"
      style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }}
      onClick={() => router.push("/match")}
    >
      ← 뒤로
    </button>
  );

  if (view === "ready" && assembled) {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">유형간 관계성 보고서</p>
        <h1 className="serif">{DESSERT[typeCode].name} × {assembled.friendName}</h1>

        <p className="traits-title">1. {SECTION_TITLES[0]}</p>
        {assembled.overview.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title" style={{ marginTop: 20 }}>2. {SECTION_TITLES[1]}</p>
        {assembled.section2.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">3. {SECTION_TITLES[2]}</p>
        {assembled.section3.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">4. {SECTION_TITLES[3]}</p>
        {assembled.section4.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">5. {SECTION_TITLES[4]}</p>
        {assembled.section5.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <div className="cta">
          <p className="cta-title">6. {SECTION_TITLES[5]}</p>
          {assembled.section6.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="card">
      {backBtn}
      <p className="kicker kicker-sm">유형간 관계성 보고서</p>
      <h1 className="serif">{DESSERT[typeCode].name} × {friendName}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        1번 항목은 무료로 전체 확인할 수 있어요. 나머지는 결제 후에 열려요.
      </p>

      <div className="report-section report-section-preview">
        <div className="report-section-head" style={{ cursor: "default" }}>
          <span className="r-num">1</span>
          <div>
            <p className="r-title">{SECTION_TITLES[0]}</p>
            <p className="r-teaser">무료로 전체 볼 수 있어요</p>
          </div>
        </div>
        <div className="report-section-body">
          {overview.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      {SECTION_TITLES.slice(1).map((title, i) => (
        <div key={title} className="report-section" onClick={tapLocked}>
          <div className="report-section-head">
            <span className="r-num">{i + 2}</span>
            <div>
              <p className="r-title">{title}</p>
            </div>
            <span className="r-lock">🔒</span>
          </div>
        </div>
      ))}

      <div className="report-paywall">
        <p className="report-paywall-title">유형간 관계성 보고서</p>
        <p className="report-paywall-price">3,500원</p>
        <button className="btn-lg" onClick={payForReport} disabled={busy}>
          3,500원 결제하고 전체 보기
        </button>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <button className="secondary" style={{ marginTop: 10 }} onClick={devSkipPayment} disabled={busy}>
          [개발자 전용] 결제 건너뛰고 바로 생성
        </button>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default function RelationshipReportPage() {
  return (
    <Suspense fallback={null}>
      <RelationshipReportInner />
    </Suspense>
  );
}
