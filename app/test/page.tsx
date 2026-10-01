"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import {
  AXES,
  AXIS_KR,
  AXIS_ORDER,
  DESSERT,
  MODE_KR,
  MODE_ORDER,
  type AxisKey,
  type CopingSubKey,
  type FactorKey,
  type Gender,
  type ModeKey,
  type TypeCode,
} from "@/lib/data";
import SubfactorDeviationChart from "@/components/SubfactorDeviationChart";
import { buildAverageComparisonText } from "@/lib/reportV3/averageComparison";
import type { QuizResultV2 } from "@/lib/scoring";

// 2026-10-01: 33문항을 매번 직접 풀지 않고도 결과/심층 화면을 바로 미리볼 수 있도록 만든
// QA 전용 페이지입니다. 실제 서비스 네비게이션 어디서도 링크하지 않습니다(URL을 아는 사람만
// 접근). 데이터는 실제 채점 로직을 타지 않고 그럴듯한 값을 즉석에서 지어내는 것뿐이라,
// 서버에는 아무것도 저장되지 않습니다(결과 저장하기를 누르기 전까지는 서버에 아무것도 남지 않습니다).
export const dynamic = "force-dynamic";

const P1_IDS = Array.from({ length: 21 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`);
const P2_IDS = Array.from({ length: 12 }, (_, i) => `Q${String(i + 1).padStart(2, "0")}`);

const ALL_FACTORS: FactorKey[] = [
  "job_fit", "partner_fit", "attachment", "boundary", "global_worth",
  "values", "meaning", "tension_tol", "competence_cw", "approval_cw",
];
// 대처방식별 하위요인 2개(lib/scoring.ts 구조와 동일한 짝)
const SUBS_FOR_MODE: Record<ModeKey, CopingSubKey[]> = {
  primary: ["problem_solving", "support"],
  secondary: ["reframing", "acceptance"],
  disengage: ["cog_avoid", "beh_avoid"],
};
const ALL_SUBS: CopingSubKey[] = ["problem_solving", "support", "reframing", "acceptance", "cog_avoid", "beh_avoid"];

function buildFakeResult(axis: AxisKey, mode: ModeKey): QuizResultV2 {
  const lowFactors = new Set(AXES[axis]);
  const factorScores = Object.fromEntries(
    ALL_FACTORS.map((f) => [f, lowFactors.has(f) ? 2.3 : 3.6])
  ) as Record<FactorKey, number>;

  const axisScores = Object.fromEntries(
    AXIS_ORDER.map((a) => [a, a === axis ? 2.3 : 3.7])
  ) as Record<AxisKey, number>;

  const highSubs = new Set(SUBS_FOR_MODE[mode]);
  const subScores = Object.fromEntries(
    ALL_SUBS.map((s) => [s, highSubs.has(s) ? 4.0 : 2.5])
  ) as Record<CopingSubKey, number>;

  const modeScores = Object.fromEntries(
    MODE_ORDER.map((m) => [m, m === mode ? 4.1 : m === "disengage" && mode !== "disengage" ? 2.0 : 3.0])
  ) as Record<ModeKey, number>;

  const part1Answers = Object.fromEntries(P1_IDS.map((id) => [id, 3]));
  const part2Answers = Object.fromEntries(P2_IDS.map((id) => [id, 3]));

  return {
    part1Answers,
    part2Answers,
    factorScores,
    axisScores,
    confirmedAxis: axis,
    subScores,
    modeScores,
    confirmedMode: mode,
    typeCode: `${axis}-${mode}` as TypeCode,
  };
}

export default function TestPreviewPage() {
  const router = useRouter();
  const { setProfile, setResult, reset } = useQuiz();
  const [name, setName] = useState("기밍");
  const [gender, setGender] = useState<Gender>("female");
  const [chartType, setChartType] = useState<TypeCode | null>(null);

  const preview = (axis: AxisKey, mode: ModeKey) => {
    reset();
    setProfile(name.trim() || "테스트", gender);
    setResult(buildFakeResult(axis, mode));
    router.push("/result");
  };

  const titleFor = (g: Gender) => (g === "female" ? "공주" : g === "male" ? "왕자" : "공작");
  const chartResult = chartType ? buildFakeResult(chartType.split("-")[0] as AxisKey, chartType.split("-")[1] as ModeKey) : null;
  const chartComparison = chartResult
    ? buildAverageComparisonText(
        name.trim() || "테스트",
        titleFor(gender),
        chartResult.factorScores,
        chartResult.confirmedAxis,
        AXIS_KR[chartResult.confirmedAxis],
        DESSERT[chartResult.typeCode].name
      )
    : null;

  return (
    <div className="card">
      <p className="kicker kicker-sm">QA 전용</p>
      <h1 className="serif">테스트 미리보기</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        33문항을 직접 풀지 않고, 유형을 골라 바로 결과 화면으로 이동합니다. 실제로 저장되지는
        않아요(결과 저장하기를 누르기 전까지는 서버에 아무것도 남지 않습니다).
      </p>

      <p className="field-label" style={{ marginTop: 0 }}>닉네임</p>
      <input type="text" className="text-input" value={name} onChange={(e) => setName(e.target.value)} />

      <p className="field-label">호칭</p>
      <div className="gender-row" style={{ marginBottom: 20 }}>
        {(["female", "male", "none"] as Gender[]).map((g) => (
          <button
            key={g}
            type="button"
            className={`gender-btn${gender === g ? " selected" : ""}`}
            onClick={() => setGender(g)}
          >
            {g === "female" ? "공주" : g === "male" ? "왕자" : "공작"}
          </button>
        ))}
      </div>

      {AXIS_ORDER.map((axis) => (
        <div key={axis} style={{ marginBottom: 16 }}>
          <p className="field-label" style={{ marginTop: 0 }}>{AXIS_KR[axis]}</p>
          <div className="gender-row">
            {MODE_ORDER.map((mode) => {
              const type = `${axis}-${mode}` as TypeCode;
              return (
                <button
                  key={type}
                  type="button"
                  className="gender-btn"
                  style={{ flex: "1 1 30%", fontSize: 14 }}
                  onClick={() => preview(axis, mode)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setChartType(type);
                  }}
                >
                  {DESSERT[type].name}
                  <br />
                  <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7 }}>{MODE_KR[mode]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="muted" style={{ marginTop: 4 }}>
        (유형 버튼을 우클릭하면 결과 화면으로 가지 않고, 아래에 평균 대비 그래프만 바로 미리볼 수 있어요.)
      </p>

      {chartResult && chartComparison && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p className="field-label" style={{ marginTop: 0 }}>
            평균 대비 그래프 미리보기 — {DESSERT[chartResult.typeCode].name}
          </p>
          {chartComparison.intro.map((p, i) => (
            <p key={i} className="type-blurb">{p}</p>
          ))}
          <SubfactorDeviationChart individual={chartResult.factorScores} indLabel={`나의 점수(${DESSERT[chartResult.typeCode].name})`} />
          {chartComparison.deviationNote.map((p, i) => (
            <p key={i} className="type-blurb">{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}
