"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
import { AXIS_KR, DESSERT } from "@/lib/data";
import { EUL_REUL } from "@/lib/josa";
import { buildDomainProfile, EXPERT_NOTICE_TEXT } from "@/lib/reportV3/domainProfile";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

const SECTION_TITLES = [
  "당신의 웰니스 프로파일",
  "주목할 만한 부분은",
  "", // 3번은 영역에 따라 제목이 바뀜(아래 sectionTitle3 참고)
  "더 자세히 들여다보면",
  "", // 5번도 영역 이름이 들어감(아래 sectionTitle5 참고)
  "다른 유형과의 궁합",
  "앞으로 나아갈 방향",
  "이번주 당장 할거!",
];

interface AssembledV3 {
  section2: string[];
  section3: string[];
  section4: string[];
  section5: string[];
  section6: string[];
  section7: string[];
  section8: string[];
}

type ViewState = "locked" | "ready" | "generating";

// v3 인계서 — 심층 리포트 8섹션. 1번(웰니스 프로파일)은 결정론적 조립이라 결제 없이 무료로
// 즉시 보여주고, 2~8번은 결제 후 OpenAI가 생성합니다(대기 필요 — "generating" 상태로 폴링).
export default function ReportPage() {
  const router = useRouter();
  const { result, savedResultId, setSavedResultId, userName, userGender, setPendingAfterSignup } = useQuiz();
  const [toast, setToast] = useState("");
  const [view, setView] = useState<ViewState>("locked");
  const [assembled, setAssembled] = useState<AssembledV3 | null>(null);
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
    } else if (data.status === "paid_needs_generation") {
      setView("generating");
      setToast("리포트를 새로 쓰는 중이에요. 잠시만 기다려주세요… (약 10~20초)");
    }
  };

  useEffect(() => {
    if (savedResultId) fetchReport(savedResultId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedResultId]);

  if (!result) return null;
  const { typeCode, confirmedAxis, axisScores } = result;
  const dessert = DESSERT[typeCode];
  const axisKR = AXIS_KR[confirmedAxis];

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

  const backBtn = (
    <button className="secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }} onClick={() => router.push("/result")}>
      ← 뒤로
    </button>
  );

  const profile = buildDomainProfile(typeCode, confirmedAxis, axisScores);
  const sectionTitle3 = `${axisKR}${EUL_REUL(axisKR)} 다루는 나의 방식`;
  const sectionTitle4 = "더 자세히 들여다보면";
  const sectionTitle5 = `${axisKR}${EUL_REUL(axisKR)} 고민하는 나의 모습`;

  // 1번(웰니스 프로파일) — 무료. 결제 여부와 무관하게 항상 전부 펼쳐진 상태로 보여줍니다.
  const profileSection = (
    <>
      <RadarChart scores={axisScores} />
      <p className="type-blurb" style={{ fontWeight: 700 }}>{profile.scoreLine}</p>
      <p className="type-blurb">{profile.introLine}</p>
      {profile.blocks.map((b) => (
        <div key={b.label} style={{ marginBottom: 14 }}>
          <p className="r-title" style={{ marginBottom: 4 }}>{b.label}</p>
          <p className="type-blurb" style={{ marginBottom: 0 }}>{b.text}</p>
        </div>
      ))}
      {profile.expertNotice && <p className="type-blurb">{EXPERT_NOTICE_TEXT}</p>}
    </>
  );

  if (view === "ready" && assembled) {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>

        <p className="traits-title">1. {SECTION_TITLES[0]}</p>
        {profileSection}

        <p className="traits-title" style={{ marginTop: 20 }}>2. {SECTION_TITLES[1]}</p>
        {assembled.section2.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">3. {sectionTitle3}</p>
        {assembled.section3.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">4. {sectionTitle4}</p>
        {assembled.section4.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">5. {sectionTitle5}</p>
        {assembled.section5.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">6. {SECTION_TITLES[5]}</p>
        {assembled.section6.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">7. {SECTION_TITLES[6]}</p>
        {assembled.section7.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <div className="cta">
          <p className="cta-title">8. {SECTION_TITLES[7]}</p>
          {assembled.section8.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <button className="secondary" style={{ marginTop: 16 }} onClick={() => router.push("/match")}>
          다른 유형과 나의 관계는 어떨까?!
        </button>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  if (view === "generating") {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
        <p className="traits-title">1. {SECTION_TITLES[0]}</p>
        {profileSection}
        <div className="cta">
          <p className="cta-title">2~8번 리포트를 쓰고 있어요…</p>
          <p>보통 10~20초 걸려요. 이 화면을 잠깐만 기다려주세요.</p>
        </div>
        <button
          className="secondary"
          style={{ marginTop: 16 }}
          onClick={() => savedResultId && fetchReport(savedResultId)}
        >
          다시 확인하기
        </button>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // locked (기본 상태) — 1번(웰니스 프로파일)은 무료로 펼쳐볼 수 있고, 2~8번은 결제 후 열립니다.
  return (
    <div className="card">
      {backBtn}
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
        <div className="report-section-body">{profileSection}</div>
      </div>

      {[SECTION_TITLES[1], sectionTitle3, sectionTitle4, sectionTitle5, SECTION_TITLES[5], SECTION_TITLES[6], SECTION_TITLES[7]].map(
        (title, i) => (
          <div key={title} className="report-section" onClick={tapLocked}>
            <div className="report-section-head">
              <span className="r-num">{i + 2}</span>
              <div>
                <p className="r-title">{title}</p>
              </div>
              <span className="r-lock">🔒</span>
            </div>
          </div>
        )
      )}

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
