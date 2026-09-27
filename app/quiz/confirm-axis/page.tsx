"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import { AXIS_CONFIRM_ALL_HIGH, AXIS_CONFIRM_SINGLE, AXIS_CONFIRM_TIE, AXIS_KR, AXIS_ORDER, type AxisKey } from "@/lib/data";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-09-25: "5개 중 고르기" 화면(전체 5개 버튼)에서만 쓰는, 조금 더 구체적인 버튼 문구.
// 다른 화면(레이더 차트, 결과 화면 등)의 AXIS_KR은 그대로 두고 여기서만 풀어씁니다.
const AXIS_PICKER_LABEL: Record<AxisKey, string> = {
  CAR: "직장 및 커리어",
  LOV: "연애 및 결혼",
  REL: "친구 및 인간관계",
  SLF: "내 성격과 성향",
  DIR: "삶의 방향과 미래",
};

// v2 스펙 4.4, 10장 — 1부 종료 후 주 고민 영역 확인 화면. 단일/동점/전체고득점 3분기.
export default function ConfirmAxisPage() {
  const router = useRouter();
  const { part1Result, setConfirmedAxis } = useQuiz();
  const [showAllFive, setShowAllFive] = useState(false);
  const [etcNotice, setEtcNotice] = useState(false);

  useEffect(() => {
    if (!part1Result) router.replace("/");
  }, [part1Result, router]);

  if (!part1Result) return null;

  const choose = (axis: AxisKey) => {
    setConfirmedAxis(axis);
    router.push("/quiz/part2");
  };

  const { mode, options, axisScores } = part1Result;

  // "기타"를 처음 누르면 안내만 보여주고, 그래도 다시 누르면 점수상 가장 가까운(=가장 낮은) 영역으로 그냥 진행합니다.
  const closestAxis = AXIS_ORDER.reduce((best, axis) =>
    axisScores[axis] < axisScores[best] ? axis : best
  );
  const handleEtcClick = () => {
    if (etcNotice) {
      choose(closestAxis);
    } else {
      setEtcNotice(true);
    }
  };

  // 기본(단일): "다른 영역이에요"를 누르면 5개 중 선택하는 화면으로 전환
  if (mode === "single" && !showAllFive) {
    const axis = options[0];
    return (
      <div className="card">
        <p className="kicker kicker-sm">잠깐 확인할게요</p>
        <h1 className="serif">{AXIS_CONFIRM_SINGLE(AXIS_KR[axis])}</h1>
        <button className="btn-lg" onClick={() => choose(axis)}>
          맞아요
        </button>
        <button className="secondary" style={{ marginTop: 10 }} onClick={() => setShowAllFive(true)}>
          다른 영역이에요
        </button>
      </div>
    );
  }

  // 동점: 동점 영역만 표시
  if (mode === "tie" && !showAllFive) {
    return (
      <div className="card">
        <p className="kicker kicker-sm">잠깐 확인할게요</p>
        <h1 className="serif">{AXIS_CONFIRM_TIE(AXIS_KR[options[0]], AXIS_KR[options[1]])}</h1>
        <div className="gender-row" style={{ flexWrap: "wrap", rowGap: 8 }}>
          {options.map((axis) => (
            <button key={axis} className="gender-btn" style={{ flex: "1 1 45%" }} onClick={() => choose(axis)}>
              {AXIS_KR[axis]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 전체 4.0 이상, 또는 "다른 영역이에요"를 눌러서 5개 중 선택하는 화면
  return (
    <div className="card">
      <p className="kicker kicker-sm">잠깐 확인할게요</p>
      <h1 className="serif">{mode === "all_high" ? AXIS_CONFIRM_ALL_HIGH : "그럼 어떤 영역이 더 마음에 걸리세요?"}</h1>
      <div className="gender-row" style={{ flexWrap: "wrap", rowGap: 8 }}>
        {AXIS_ORDER.map((axis) => (
          <button key={axis} className="gender-btn" style={{ flex: "1 1 45%" }} onClick={() => choose(axis)}>
            {AXIS_PICKER_LABEL[axis]}
          </button>
        ))}
        <button
          className="gender-btn"
          style={{ flex: "1 1 45%" }}
          onClick={handleEtcClick}
        >
          기타
        </button>
      </div>
      {etcNotice && (
        <p className="tiny" style={{ marginTop: 10, color: "var(--sky-bg)" }}>
          가장 가까운 걸 하나 골라보는건 어때요? 그래도 기타를 누르면 그냥 넘어갈게요.
        </p>
      )}
    </div>
  );
}
