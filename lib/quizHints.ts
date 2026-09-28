// 2026-09-25: 문항 진행 중간중간 짧은 안내/응원 문구. current는 0-index, total은 전체 문항 수.
export function quizHint(current: number, total: number): string | null {
  if (current === 0) return "정답은 없어요. 너무 오래 고민하지 말고 떠오르는 대로 골라주세요.";
  const ratio = (current + 1) / total;
  if (ratio >= 0.95) return "얼마 안 남았어요!";
  if (ratio >= 0.68 && ratio < 0.8) return "거의 다 왔어요! 조금만 더 힘내주세요.";
  return null;
}
