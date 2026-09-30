import { AXIS_ORDER } from "./data";

// 2026-09-30: 화면(components/RadarChart.tsx)과 이메일용 PNG(app/api/report/radar-image/
// route.ts)가 "같은 기하 계산"이라는 주석만 믿고 각자 상수를 하드코딩하고 있었는데, 실제로는
// CX가 142/147로 이미 어긋나 있었습니다(둘 다 viewBox는 "0 0 295 195"로 동일한데도) —
// 화면과 이메일에 보이는 오각형 그래프 중심이 달라지는 버그였습니다. 두 곳 다 이 파일
// 하나에서 좌표를 계산하도록 합쳐서, 앞으로 기하를 바꿀 일이 있으면 한 곳만 고치면
// 됩니다(다시 어긋날 수 없음).
export const RADAR_W = 295;
export const RADAR_H = 195;
export const RADAR_CX = 142;
export const RADAR_CY = 100;
export const RADAR_MAX_R = 72;
export const RADAR_MAX_SCORE = 5;

const N = AXIS_ORDER.length;

export function radarAngleFor(i: number): number {
  return ((-90 + i * (360 / N)) * Math.PI) / 180;
}

export function radarPointAt(i: number, r: number): [number, number] {
  const a = radarAngleFor(i);
  return [RADAR_CX + r * Math.cos(a), RADAR_CY + r * Math.sin(a)];
}
