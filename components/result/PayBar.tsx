"use client";

import { REPORT_PRICE, formatWon } from "@/lib/pricing";

// 2026-10-07 결제 바(스크롤해도 따라다님)를 스와이프 결과 화면용으로 옮긴 것. 실제 가격만 보여줍니다
// (카운트다운·"지금만" 같은 압박 문구 없음 — 쏠 아스트로 하우스와 같은 원칙).
export default function PayBar({ onPay, busy }: { onPay: () => void; busy: boolean }) {
  return (
    <div className="paywall-bar">
      <div className="paywall-bar-inner">
        <div className="paywall-bar-price">
          <strong>심층 리포트 {formatWon(REPORT_PRICE)}원</strong>
          쏘웰라 1주일 체험권 포함
        </div>
        <button className="btn-lg" onClick={onPay} disabled={busy}>
          이어서 읽기
        </button>
      </div>
    </div>
  );
}
