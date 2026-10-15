"use client";

import { useState } from "react";
import { REPORT_PRICE, formatWon } from "@/lib/pricing";
import { WITHDRAWAL_CHECK_LABEL, WITHDRAWAL_NOTICE_LINES } from "@/lib/withdrawal";

// 2026-10-15: 결제 전 청약철회 제한 고지·동의. 체크해야 결제로 넘어가고, 서버도 주문을 만들 때 동의(withdrawalAck)를 다시 확인합니다.
export default function PaymentConsentSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const [checked, setChecked] = useState(false);
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-box consent-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="결제 전 안내">
        <p className="confirm-msg">결제하기 전에 확인해 주세요</p>
        {WITHDRAWAL_NOTICE_LINES.map((line, i) => (
          <p key={i} className="consent-line">
            {line}
          </p>
        ))}
        <p className="consent-line">
          <a href="/legal#terms" target="_blank" rel="noopener noreferrer">
            이용약관 보기
          </a>
        </p>
        <label className="consent-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{WITHDRAWAL_CHECK_LABEL}</span>
        </label>
        <div className="confirm-actions">
          <button className="secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-lg"
            disabled={!checked}
            onClick={() => {
              setChecked(false);
              onConfirm();
            }}
          >
            {formatWon(REPORT_PRICE)}원 결제하기
          </button>
        </div>
      </div>
    </div>
  );
}
