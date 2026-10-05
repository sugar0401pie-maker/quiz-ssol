// 심층 리포트 가격(원). 결제 주문 생성(app/api/orders), 관리자 지급 기록, 결과 화면 안내
// 문구가 모두 이 값 하나를 쓰게 해서, 화면에 보이는 가격과 실제 결제 금액이 어긋나지 않게 합니다.
// 서버가 주문 금액을 정하는 원칙(클라이언트가 보낸 금액은 믿지 않음)은 그대로입니다.
export const REPORT_PRICE = 3500;

export function formatWon(amount: number): string {
  return amount.toLocaleString("ko-KR");
}
