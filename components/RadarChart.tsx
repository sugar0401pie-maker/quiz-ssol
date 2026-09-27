"use client";

import { useRef, useState } from "react";
import { AXIS_KR, AXIS_ORDER, type AxisKey } from "@/lib/data";
import { fmtScore } from "@/lib/scoring";

// 외부 차트 라이브러리 없이 순수 SVG 로 좌표를 직접 계산해서 그립니다.
// v2: 점수는 이제 도메인 합계(0~20)가 아니라 영역 점수(하위요인 평균의 평균, 1~5)입니다.
const CX = 142;
const CY = 100;
const MAX_R = 72;
const MAX_SCORE = 5;
const N = AXIS_ORDER.length;
const angleFor = (i: number) => ((-90 + i * (360 / N)) * Math.PI) / 180;
const pointAt = (i: number, r: number): [number, number] => {
  const a = angleFor(i);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

interface Tip {
  text: string;
  x: number;
  y: number;
}

export default function RadarChart({ scores }: { scores: Record<AxisKey, number> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const dataPts = AXIS_ORDER.map((d, i) => pointAt(i, (Math.max(0, Math.min(scores[d], MAX_SCORE)) / MAX_SCORE) * MAX_R));

  const textOf = (i: number) => `${AXIS_KR[AXIS_ORDER[i]]}: ${fmtScore(scores[AXIS_ORDER[i]])}점`;

  // 마우스 위치(커서 근처)에 툴팁 표시
  const showAtMouse = (e: React.MouseEvent, i: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ text: textOf(i), x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // 탭(모바일): 점 위치 기준으로 표시
  const showAtPoint = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const scaleX = r.width / svg.viewBox.baseVal.width;
    const scaleY = r.height / svg.viewBox.baseVal.height;
    setTip({ text: textOf(i), x: dataPts[i][0] * scaleX, y: dataPts[i][1] * scaleY });
  };

  return (
    <div className="radar-box" ref={boxRef} onClick={() => setTip(null)}>
      <div role="img" aria-label="웰니스 프로파일 오각형 그래프" style={{ width: "100%" }}>
        <svg
          ref={svgRef}
          viewBox="0 0 295 195"
          width={295}
          height={195}
          style={{ width: "100%", height: "auto", display: "block" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {[0.34, 0.67, 1].map((level) => (
            <polygon
              key={level}
              points={AXIS_ORDER.map((_, i) => pointAt(i, MAX_R * level).join(",")).join(" ")}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          {AXIS_ORDER.map((d, i) => {
            const p = pointAt(i, MAX_R);
            return <line key={d} x1={CX} y1={CY} x2={p[0]} y2={p[1]} stroke="var(--border)" strokeWidth={1} />;
          })}
          <polygon
            points={dataPts.map((p) => p.join(",")).join(" ")}
            fill="var(--navy)"
            fillOpacity={0.18}
            stroke="var(--navy)"
            strokeWidth={2}
          />
          {dataPts.map((p, i) => (
            <circle
              key={AXIS_ORDER[i]}
              className="radar-pt"
              cx={p[0]}
              cy={p[1]}
              r={5.5}
              fill="var(--navy)"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => showAtMouse(e, i)}
              onMouseMove={(e) => showAtMouse(e, i)}
              onMouseLeave={() => setTip(null)}
              onClick={(e) => showAtPoint(e, i)}
            />
          ))}
          {AXIS_ORDER.map((d, i) => {
            const p = pointAt(i, MAX_R + 18);
            let anchor: "start" | "middle" | "end" = "middle";
            if (p[0] < CX - 8) anchor = "end";
            else if (p[0] > CX + 8) anchor = "start";
            return (
              <text
                key={d}
                x={p[0]}
                y={p[1]}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={11.5}
                fill="var(--text2)"
                fontFamily="var(--font-noto), Noto Sans KR, sans-serif"
              >
                {AXIS_KR[d]}
              </text>
            );
          })}
        </svg>
      </div>
      {tip && (
        <div className="radar-tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
