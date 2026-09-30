"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuiz } from "@/lib/QuizContext";
import { createClient } from "@/lib/supabase/client";
import type { Gender } from "@/lib/data";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

type HistoryItem = {
  resultId: string;
  createdAt: string;
  typeCode: string | null;
  dessertName: string | null;
  hasReport: boolean;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 2026-09-30: "지난 테스트 결과 열람하기" 요청 — /result 화면(내 결과 공유하기·결과
// 저장하기 아래)에서 들어오는 별도 페이지입니다. 로그인한 계정으로 저장된 응시 기록을
// 최신순으로 보여주고, 각 기록마다 언제 봤는지·무슨 유형이었는지·심층보고서가 있는지
// 보여줍니다. 항목을 누르면 그 기록을 Context에 불러와 /result 화면 자체가 그 과거
// 결과에 맞게 나오도록 합니다(/result는 Context의 result를 그대로 쓰므로, 최근에 막
// 테스트를 마친 경우와 똑같이 동작합니다).
export default function HistoryPage() {
  const router = useRouter();
  const { setProfile, setResult, setSavedResultId } = useQuiz();
  const [state, setState] = useState<"checking" | "login-required" | "ready">("checking");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState("login-required");
        return;
      }
      try {
        const res = await fetch("/api/history");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setItems(data.items ?? []);
        setState("ready");
      } catch {
        setError("기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        setState("ready");
      }
    })();
  }, []);

  const openResult = async (resultId: string) => {
    if (openingId) return;
    setOpeningId(resultId);
    try {
      const res = await fetch(`/api/results?resultId=${resultId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
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
      router.push("/result");
    } catch {
      setError("이 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      setOpeningId(null);
    }
  };

  const backBtn = (
    <button className="secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }} onClick={() => router.push("/result")}>
      ← 뒤로
    </button>
  );

  if (state === "checking") {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">지난 테스트 결과</p>
        <h1 className="serif">불러오는 중...</h1>
      </div>
    );
  }

  if (state === "login-required") {
    return (
      <div className="card">
        {backBtn}
        <p className="kicker kicker-sm">지난 테스트 결과</p>
        <h1 className="serif">로그인이 필요해요</h1>
        <p className="muted" style={{ marginTop: 8 }}>로그인하면 그동안 저장한 응시 기록을 볼 수 있어요.</p>
        <button className="btn-lg" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {backBtn}
      <p className="kicker kicker-sm">지난 테스트 결과</p>
      <h1 className="serif">지난 테스트 결과 열람하기</h1>

      {error && <p className="muted" style={{ marginTop: 12 }}>{error}</p>}

      {!error && items.length === 0 && (
        <p className="muted" style={{ marginTop: 12 }}>아직 저장된 응시 기록이 없어요.</p>
      )}

      {items.map((item) => (
        <div
          key={item.resultId}
          className="history-row"
          role="button"
          tabIndex={0}
          onClick={() => openResult(item.resultId)}
          style={{ cursor: openingId ? "default" : "pointer", opacity: openingId && openingId !== item.resultId ? 0.5 : 1 }}
        >
          <div>
            <p className="history-row-date">{formatDate(item.createdAt)}</p>
            <p className="history-row-type">{item.dessertName ?? "히든 결과"}</p>
          </div>
          <span className={item.hasReport ? "history-badge history-badge-on" : "history-badge"}>
            {openingId === item.resultId ? "불러오는 중..." : item.hasReport ? "심층보고서 있음" : "심층보고서 없음"}
          </span>
        </div>
      ))}
    </div>
  );
}
