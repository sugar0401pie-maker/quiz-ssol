"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { ReportParagraph } from "@/components/ReportParagraph";
import { useQuiz } from "@/lib/QuizContext";
import { DESSERT } from "@/lib/data";
import { ensureSavedResult as ensureSavedResultShared } from "@/lib/reportV3/ensureSavedResult";
import type { GeneratedSectionsV3 } from "@/lib/reportV3/types";
import { SECTION_TITLES, sectionTitlesForAxis } from "@/lib/reportV3/uiSections";
import { createClient } from "@/lib/supabase/client";

const SOWELLA_URL = "https://app.ssolwellnesshouse.com";
const SOWELLA_MESSAGE =
  "반갑습니다! 쏘웰라입니다. 테스트하실 때 가입하신 계정 아이디와 비밀번호로 쏘웰라 서비스를 그대로 이용할 수 있어요.";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-09-28: "심층보고서를 완전히 별도 페이지로" 요청 — 결제/대기 상태를 다루던
// /result/report와 분리해서, 이 페이지는 오직 "완성된 리포트 열람"만 담당합니다.
// /result/report(결제 확인)와 /result/report/generating(생성 대기)은 준비가 끝나면
// 전부 이 페이지로 리다이렉트합니다. 직접 이 URL로 들어온 경우(새로고침 등)에도
// 스스로 한 번 확인해서, 준비 안 됐으면 /result/report로 돌려보냅니다.
export default function ReportViewPage() {
  const router = useRouter();
  const { result, savedResultId, setSavedResultId, userName, userGender } = useQuiz();
  const [toast, setToast] = useState("");
  const [assembled, setAssembled] = useState<GeneratedSectionsV3 | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailAddr, setMailAddr] = useState("");
  const [mailBusy, setMailBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  useEffect(() => {
    if (!savedResultId) {
      router.replace("/result/report");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/report/generate?resultId=${savedResultId}`);
        const data = res.ok ? await res.json() : null;
        if (data?.status === "ready" && data.assembled) {
          setAssembled(data.assembled);
          setChecked(true);
        } else {
          // 아직 준비 안 됐거나(새로고침 등) 결제 확인이 필요한 경우 — 원래 흐름으로.
          router.replace("/result/report");
        }
      } catch {
        router.replace("/result/report");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedResultId]);

  if (!result || !checked || !assembled) return null;
  const { typeCode, confirmedAxis, axisScores } = result;
  const dessert = DESSERT[typeCode];
  const { sectionTitle3, sectionTitle4, sectionTitle5 } = sectionTitlesForAxis(confirmedAxis);

  const handleSaveResult = async () => {
    setBusy(true);
    const outcome = await ensureSavedResultShared({ savedResultId, setSavedResultId, userName, userGender, result });
    setBusy(false);
    setToast(outcome.ok ? "저장되었습니다!" : "저장 확인에 실패했어요. 잠시 후 다시 시도해주세요.");
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

  return (
    <div className="card">
      <button
        className="secondary"
        style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }}
        onClick={() => router.push("/result")}
      >
        ← 뒤로
      </button>
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>

      <RadarChart scores={axisScores} />

      <p className="traits-title" style={{ marginTop: 20 }}>1. {SECTION_TITLES[0]}</p>
      {assembled.section1.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}

      <p className="traits-title">2. {SECTION_TITLES[1]}</p>
      {assembled.section2.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}

      <p className="traits-title">3. {sectionTitle3}</p>
      {assembled.section3.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}

      <p className="traits-title">4. {sectionTitle4}</p>
      {assembled.section4.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}

      <p className="traits-title">5. {sectionTitle5}</p>
      {assembled.section5.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}

      <p className="traits-title">6. {SECTION_TITLES[5]}</p>
      {assembled.section6.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}

      <p className="traits-title">7. {SECTION_TITLES[6]}</p>
      {assembled.section7.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}

      <p className="traits-title">8. {SECTION_TITLES[7]}</p>
      {assembled.section8.map((p, i) =>
        i === assembled.section8.length - 1 ? (
          <div key={i} className="section8-highlight">
            <p>{p}</p>
          </div>
        ) : (
          <ReportParagraph key={i} text={p} className="type-blurb" />
        )
      )}

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
