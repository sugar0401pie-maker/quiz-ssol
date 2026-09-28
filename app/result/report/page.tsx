"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { stashPendingQuizForOAuth, useQuiz } from "@/lib/QuizContext";
import { AXIS_KR, DESSERT, GENDER_TITLE } from "@/lib/data";
import { EUL_REUL } from "@/lib/josa";
import { createClient } from "@/lib/supabase/client";

const SOWELLA_URL = "https://app.ssolwellnesshouse.com";
const SOWELLA_MESSAGE =
  "반갑습니다! 쏘웰라입니다. 테스트하실 때 가입하신 계정 아이디와 비밀번호로 쏘웰라 서비스를 그대로 이용할 수 있어요.";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-09-28: deep-report-prompt-8section-v6.md 기준 제목으로 갱신
// (6번 "궁합"→"관계성", 8번 "이번주 당장 할거!"→"바로 지금, 작은 변화를 만들어봐요").
const SECTION_TITLES = [
  "당신의 웰니스 프로파일",
  "주목할 만한 부분은",
  "", // 3번은 영역에 따라 제목이 바뀜(아래 sectionTitle3 참고)
  "더 자세히 들여다보면",
  "", // 5번도 영역 이름이 들어감(아래 sectionTitle5 참고)
  "다른 유형과의 관계성",
  "앞으로 나아갈 방향",
  "바로 지금, 작은 변화를 만들어봐요",
];

interface AssembledV3 {
  section1: string[];
  section2: string[];
  section3: string[];
  section4: string[];
  section5: string[];
  section6: string[];
  section7: string[];
  section8: string[];
}

type ViewState = "locked" | "ready" | "generating" | "failed";

// "....." 부분이 움직이도록(400ms마다 1~4개 순환) — 로딩 문구 애니메이션.
function useAnimatedDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v % 4) + 1), 400);
    return () => clearInterval(t);
  }, []);
  return ".".repeat(n);
}

// v6 프롬프트 — 심층 리포트 8섹션 전부(1~8번)를 결제 후 OpenAI가 생성합니다(더 이상 무료
// 미리보기 없음 — 오각형 그래프만 /result에서 이미 무료로 보여주고 있어 별도 예고편은 유지).
export default function ReportPage() {
  const router = useRouter();
  const { result, savedResultId, setSavedResultId, userName, userGender, setPendingAfterSignup } = useQuiz();
  const [toast, setToast] = useState("");
  const [view, setView] = useState<ViewState>("locked");
  const [assembled, setAssembled] = useState<AssembledV3 | null>(null);
  const [busy, setBusy] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailAddr, setMailAddr] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const dots = useAnimatedDots();
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  // gpt-6-sol(reasoning) 생성 중엔 서버가 "generating" 락 상태를 반환합니다 — 준비될 때까지
  // 보고서 페이지만 몇 초 간격으로 조용히 다시 물어보고(자동 새로고침), 완료되면 바로 화면을 바꿉니다.
  const fetchReport = async (resultId: string) => {
    let data: { status?: string; assembled?: AssembledV3 } | null = null;
    try {
      const res = await fetch(`/api/report/generate?resultId=${resultId}`);
      if (!res.ok) return; // 타임아웃 등 — 다음 폴링에서 재시도
      data = await res.json();
    } catch {
      return; // 네트워크 오류 — 다음 폴링에서 재시도
    }
    if (data?.status === "ready" && data.assembled) {
      setAssembled(data.assembled);
      setView("ready");
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    } else if (data?.status === "generating") {
      setView((v) => (v === "ready" ? v : "generating"));
    } else if (data?.status === "failed") {
      setView("failed");
    }
  };

  useEffect(() => {
    if (!savedResultId) return;
    fetchReport(savedResultId);
    pollTimer.current = setInterval(() => fetchReport(savedResultId), 4000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedResultId]);

  if (!result) return null;
  const { typeCode, confirmedAxis, axisScores } = result;
  const dessert = DESSERT[typeCode];
  const axisKR = AXIS_KR[confirmedAxis];

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

  // "결과 저장하기" — 이미 자동으로 계정에 저장돼 있지만, 혹시 몰라 눈에 보이는 확인 버튼을 둡니다.
  const handleSaveResult = async () => {
    setBusy(true);
    const outcome = await ensureSavedResult();
    setBusy(false);
    setToast(outcome.ok ? "결과가 계정에 저장돼 있어요." : "저장 확인에 실패했어요. 잠시 후 다시 시도해주세요.");
  };

  const openMailModal = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMailAddr(user?.email ?? "");
    setMailOpen(true);
  };

  const sendMail = async () => {
    if (!savedResultId || !mailAddr.trim() || !mailAddr.includes("@")) {
      setToast("이메일 주소를 확인해주세요.");
      return;
    }
    setMailBusy(true);
    const res = await fetch("/api/report/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: savedResultId, email: mailAddr.trim() }),
    });
    setMailBusy(false);
    setMailOpen(false);
    setToast(res.ok ? `${mailAddr.trim()}(으)로 보냈어요.` : "메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.");
  };

  const goSowella = () => {
    setToast(SOWELLA_MESSAGE);
    setTimeout(() => {
      window.location.href = SOWELLA_URL;
    }, 1800);
  };

  const backBtn = (
    <button className="secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }} onClick={() => router.push("/result")}>
      ← 뒤로
    </button>
  );

  const sectionTitle3 = `${axisKR}${EUL_REUL(axisKR)} 다루는 나의 방식`;
  const sectionTitle4 = "더 자세히 들여다보면";
  const sectionTitle5 = `${axisKR}${EUL_REUL(axisKR)} 고민하는 나의 모습`;

  if (view === "ready" && assembled) {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>

        <RadarChart scores={axisScores} />

        <p className="traits-title" style={{ marginTop: 20 }}>1. {SECTION_TITLES[0]}</p>
        {assembled.section1.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">2. {SECTION_TITLES[1]}</p>
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

        <div className="report-actions">
          <div className="report-actions-row">
            <button className="secondary" onClick={handleSaveResult} disabled={busy}>
              결과 저장하기
            </button>
            <button className="secondary" onClick={openMailModal}>
              메일로 보내기
            </button>
          </div>
          <button className="btn-lg report-actions-sowella" onClick={goSowella}>
            웰니스 채팅 &lsquo;쏘웰라&rsquo; 이용하기
          </button>
        </div>

        {mailOpen && (
          <div className="confirm-overlay" onClick={() => !mailBusy && setMailOpen(false)}>
            <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
              <p className="confirm-msg">이 메일 주소로 보낼게요</p>
              <p className="mail-field-label">이메일</p>
              <input
                type="email"
                className="text-input"
                value={mailAddr}
                onChange={(e) => setMailAddr(e.target.value)}
                placeholder="example@email.com"
                style={{ marginBottom: 16 }}
              />
              <div className="confirm-actions">
                <button className="secondary" onClick={() => setMailOpen(false)} disabled={mailBusy}>
                  취소
                </button>
                <button className="btn-lg" onClick={sendMail} disabled={mailBusy}>
                  {mailBusy ? "보내는 중…" : "보내기"}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  if (view === "generating") {
    const honorific = `${userName}${GENDER_TITLE[userGender || "none"]}님`;
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
        <RadarChart scores={axisScores} />
        <div className="cta">
          <p className="cta-title">
            {honorific}의 심층 보고서를 작성하고 있어요{dots}
          </p>
          <p>완료되면 이 화면이 저절로 새로고침돼요. 잠깐만 기다려주세요.</p>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  if (view === "failed") {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">심층 리포트</p>
        <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
        <div className="cta">
          <p className="cta-title">리포트를 쓰는 중에 문제가 생겼어요</p>
          <p>결제는 정상 처리됐어요 — 아래 버튼으로 다시 시도해주세요.</p>
        </div>
        <button className="btn-lg" style={{ marginTop: 16 }} onClick={() => savedResultId && fetchReport(savedResultId)}>
          다시 시도하기
        </button>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // locked (기본 상태) — v6부터는 무료 미리보기가 없습니다. 오각형 그래프는 /result에서
  // 이미 무료로 보여주므로, 여기서는 8개 섹션 제목만 예고편으로 보여주고 전부 결제 후 열립니다.
  return (
    <div className="card">
      {backBtn}
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        결제하면 8개 섹션 전체가 열려요.
      </p>

      {[SECTION_TITLES[0], SECTION_TITLES[1], sectionTitle3, sectionTitle4, sectionTitle5, SECTION_TITLES[5], SECTION_TITLES[6], SECTION_TITLES[7]].map(
        (title, i) => (
          <div
            key={title}
            className="report-section"
            onClick={() => setToast("🔒 이 항목은 결제 후 열려요. 아래에서 3,500원 결제하고 전체를 확인해보세요.")}
          >
            <div className="report-section-head">
              <span className="r-num">{i + 1}</span>
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
