"use client";

import { useState } from "react";
import { guestHeaders } from "@/lib/guest/client";

// 완성된 심층 리포트를 메일로 받는 창(예전 /result/report/view의 "메일로 보내기"). 비회원도 쓸 수 있습니다.
export default function MailReportModal({
  open,
  defaultEmail,
  resultId,
  onClose,
  onToast,
}: {
  open: boolean;
  defaultEmail: string;
  resultId: string | null;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [addr, setAddr] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const send = async () => {
    const email = addr.trim();
    if (!resultId || !email.includes("@")) {
      onToast("이메일 주소를 확인해주세요.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/report/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...guestHeaders(false) },
      body: JSON.stringify({ resultId, email }),
    });
    setBusy(false);
    onClose();
    onToast(res.ok ? `${email}(으)로 보냈어요.` : "메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.");
  };

  return (
    <div className="confirm-overlay" onClick={() => !busy && onClose()}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-msg">이 메일 주소로 보낼게요</p>
        <p className="mail-field-label">이메일</p>
        <input type="email" className="text-input" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="example@email.com" style={{ marginBottom: 16 }} />
        <div className="confirm-actions">
          <button className="secondary" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn-lg" onClick={send} disabled={busy}>
            {busy ? "보내는 중…" : "보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
