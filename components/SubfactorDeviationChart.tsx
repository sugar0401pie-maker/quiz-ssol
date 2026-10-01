import { FACTOR_KR, type FactorKey } from "@/lib/data";
import { FACTOR_AVERAGE_V1, FACTOR_DISPLAY_ORDER } from "@/lib/reportV3/factorAverages";

// 2026-10-01: "전체 유형 평균 대비 차이_심층보고서용 그래프" 전달 문서 기준 덤벨 차트.
// 외부 라이브러리 없이 순수 SVG로 그립니다(RadarChart.tsx와 같은 방식). 디자인 스펙(트랙
// 좌표, 점 색상·크기, 행 높이)은 renderSubfactorDeviationChart.js 원본 그대로 옮겼습니다 —
// 점 색상(연한 핑크=평균, 진한 핑크=개인)은 테마와 무관하게 고정합니다(README: "와인색 계열
// 금지, 비비드 핑크 유지" — likert-row 버튼의 빨강/파랑처럼 이 사이트에서 데이터 포인트
// 색상은 라이트/다크 모드 공통으로 고정하는 기존 관례를 따릅니다).
const COLOR_AVG = "#F4C0D1";
const COLOR_IND = "#D4537E";
const TRACK_X0 = 200;
const TRACK_X1 = 680;
const ROW_HEIGHT = 34;
const TOP_PAD = 34;

const scoreToX = (s: number) => TRACK_X0 + (s - 1) * ((TRACK_X1 - TRACK_X0) / 4);

export default function SubfactorDeviationChart({
  individual,
  indLabel,
}: {
  individual: Record<FactorKey, number>;
  indLabel: string;
}) {
  const height = TOP_PAD + FACTOR_DISPLAY_ORDER.length * ROW_HEIGHT + 30;

  return (
    <div role="img" aria-label="하위요인별 평균 대비 내 위치 그래프" style={{ width: "100%" }}>
      <svg viewBox={`0 0 700 ${height}`} width={700} height={height} style={{ width: "100%", height: "auto", display: "block" }} xmlns="http://www.w3.org/2000/svg">
        <circle cx={210} cy={10} r={5} fill={COLOR_AVG} />
        <text x={222} y={14} fontSize={11} fill="var(--text2)">15유형 평균</text>
        <circle cx={330} cy={10} r={6} fill={COLOR_IND} />
        <text x={344} y={14} fontSize={11} fill="var(--text2)">{indLabel}</text>

        {[TRACK_X0, (TRACK_X0 + TRACK_X1) / 2, TRACK_X1].map((x) => (
          <line key={x} x1={x} y1={TOP_PAD} x2={x} y2={height - 30} stroke="var(--border)" strokeWidth={1} strokeDasharray="3,3" />
        ))}

        {FACTOR_DISPLAY_ORDER.map((f, i) => {
          const y = TOP_PAD + 16 + i * ROW_HEIGHT;
          const avgX = scoreToX(FACTOR_AVERAGE_V1[f]);
          const indX = scoreToX(individual[f]);
          return (
            <g key={f}>
              <text x={195} y={y + 6} textAnchor="end" fontSize={13} fill="var(--ink)">{FACTOR_KR[f]}</text>
              <line x1={TRACK_X0} y1={y} x2={TRACK_X1} y2={y} stroke="var(--border)" strokeWidth={1} />
              <line x1={Math.min(avgX, indX)} y1={y} x2={Math.max(avgX, indX)} y2={y} stroke={COLOR_IND} strokeWidth={3} opacity={0.4} />
              <circle cx={avgX} cy={y} r={5} fill={COLOR_AVG} />
              <circle cx={indX} cy={y} r={6} fill={COLOR_IND} />
              <text x={indX} y={y - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
                {individual[f].toFixed(1)}
              </text>
            </g>
          );
        })}

        <text x={TRACK_X0} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--text3)">1점</text>
        <text x={(TRACK_X0 + TRACK_X1) / 2} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--text3)">3점</text>
        <text x={TRACK_X1} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--text3)">5점</text>
      </svg>
    </div>
  );
}
