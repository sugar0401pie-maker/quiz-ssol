"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
import { AXES, AXIS_KR, AXIS_ORDER, DESSERT, FACTOR_KR, type AxisKey } from "@/lib/data";
import { buildSection2, type AssembledReport } from "@/lib/reportAssembly";
import { fmtScore } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

const SECTION_TITLES = [
  "오각형 상세",
  "주 고민 영역 해부",
  "프로파일 모양",
  "대처 상세",
  "고민과 대처의 궁합",
  "특수 플래그",
  "이번 주 제안",
];

type ViewState = "locked" | "ready";

// v2 스펙 8장 — 심층 리포트. 결정론적 조립이라 결제만 확인되면 즉시 전체 내용을 받아옵니다
// (LLM 호출·생성 대기 없음).
export default function ReportPage() {
  const router = useRouter();
  const { result, savedResultId, setSavedResultId, userName, userGender, setPendingAfterSignup } = useQuiz();
  const [toast, setToast] = useState("");
  const [view, setView] = useState<ViewState>("locked");
  const [assembled, setAssembled] = useState<AssembledReport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  const fetchReport = async (resultId: string) => {
    const res = await fetch(`/api/report/generate?resultId=${resultId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === "ready" && data.assembled) {
      setAssembled(data.assembled);
      setView("ready");
    }
  };

  useEffect(() => {
    if (savedResultId) fetchReport(savedResultId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedResultId]);

  if (!result) return null;
  const { typeCode, factorScores, axisScores, part1Answers } = result;
  const dessert = DESSERT[typeCode];

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

  const payForReport = async () => {
    setBusy(true);
    const outcome = await ensureSavedResult();
    if (!outcome.ok) {
      setBusy(false);
      if (outcome.reason === "not_logged_in") {
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

  const backBtn = (onClick: () => void) => (
    <button className="secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }} onClick={onClick}>
      ← 뒤로
    </button>
  );

  // 2026-09-25: "1번 문항을 눌렀을 때 점수만 나오고 설명이 없다"는 피드백 반영 — 유료 리포트
  // 2번 섹션과 같은 알고리즘(buildSection2)을 그대로 재사용해, 어떤 영역을 펼치든 그 영역에 대한
  // 실제 해석 문장이 나오게 합니다. (확정된 주 고민 영역이 아니어도 축 하나를 넣으면 그대로 동작해요.)
  const axisInterpretation = (axis: AxisKey) => buildSection2(axis, factorScores, axisScores, part1Answers).text;

  const factorBars = (axis: AxisKey) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 4px 4px" }}>
      {AXES[axis].map((f) => (
        <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="tiny" style={{ width: 92, flexShrink: 0 }}>{FACTOR_KR[f]}</span>
          <div style={{ flex: 1, height: 6, background: "var(--sky-bg)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${(factorScores[f] / 5) * 100}%`, height: "100%", background: "var(--navy)" }} />
          </div>
          <span className="tiny" style={{ width: 32, textAlign: "right" }}>{fmtScore(factorScores[f])}</span>
        </div>
      ))}
      {axisInterpretation(axis).map((p, i) => (
        <p key={i} className="type-blurb" style={{ fontSize: 14, marginTop: i === 0 ? 8 : 8, marginBottom: 0 }}>
          {p}
        </p>
      ))}
    </div>
  );

  // 2026-09-25: "1번을 클릭해야만 조금씩 보인다"는 피드백 — 5개 영역을 아코디언으로 하나씩
  // 펼쳐야 하던 걸, 처음부터 전부 펼쳐진 상태로 한 번에 읽을 수 있게 바꿨습니다.
  const pentagonSection = (
    <>
      <RadarChart scores={axisScores} />
      {AXIS_ORDER.map((axis) => (
        <div key={axis} className="report-section" style={{ marginBottom: 8, cursor: "default" }}>
          <div className="report-section-head" style={{ cursor: "default" }}>
            <p className="r-title">
              {AXIS_KR[axis]} — {fmtScore(axisScores[axis])}
            </p>
          </div>
          {factorBars(axis)}
        </div>
      ))}
    </>
  );

  if (view === "ready" && assembled) {
    return (
      <div className="card">
        {backBtn(() => router.push("/result"))}
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>

        <p className="traits-title">1. {SECTION_TITLES[0]}</p>
        {pentagonSection}

        <p className="traits-title" style={{ marginTop: 20 }}>2. {SECTION_TITLES[1]}</p>
        {assembled.section2.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        {assembled.section3 && (
          <>
            <p className="traits-title">3. {SECTION_TITLES[2]}</p>
            <p className="type-blurb">{assembled.section3}</p>
          </>
        )}

        <p className="traits-title">4. {SECTION_TITLES[3]}</p>
        {assembled.section4.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        {assembled.section5 && (
          <>
            <p className="traits-title">5. {SECTION_TITLES[4]}</p>
            <p className="type-blurb">{assembled.section5}</p>
          </>
        )}

        {assembled.section6.length > 0 && (
          <>
            <p className="traits-title">6. {SECTION_TITLES[5]}</p>
            <ul className="traits">
              {assembled.section6.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </>
        )}

        {assembled.section7 && (
          <div className="cta">
            <p className="cta-title">7. {SECTION_TITLES[6]}</p>
            <p>{assembled.section7}</p>
          </div>
        )}

        <button className="secondary" style={{ marginTop: 16 }} onClick={() => router.push("/match")}>
          친구와 궁합 보기
        </button>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // locked (기본 상태) — 1번(오각형 상세)은 무료로 펼쳐볼 수 있고, 2~7번은 결제 후 열립니다.
  return (
    <div className="card">
      {backBtn(() => router.push("/result"))}
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
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
        <div className="report-section-body">{pentagonSection}</div>
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
        <p className="report-paywall-title">전체 심층 리포트</p>
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
