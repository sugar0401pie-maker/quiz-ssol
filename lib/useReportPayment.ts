"use client";

import { useState } from "react";
import { guestHeaders } from "@/lib/guest/client";
import type { Gender } from "@/lib/data";
import { stashPendingQuizForOAuth } from "@/lib/QuizContext";
import { ensureSavedResult } from "@/lib/reportV3/ensureSavedResult";
import type { QuizResultV2 } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/client";
import { trackQuizEvent } from "@/lib/trackQuizEvent";

// 2026-10-15: 심층 리포트 결제 시작 로직을 /result/report 페이지에서 꺼내 훅으로 만들었습니다(스와이프 결과 화면에서 씀).
// 점성술 앱 흐름에 맞춰 달라진 점:
//  - 로그인하지 않아도 결제됩니다: 결과는 비회원 열쇠로 저장되고(ensureSavedResult), 토스 customerKey는 ANONYMOUS입니다.
//    결제 후 가입하면 /api/results/claim이 결과·주문을 계정으로 옮기고 쏘웰라 체험권을 지급합니다.
//  - 결제 전에 "청약철회 제한" 동의를 받습니다: requestPay → 동의 시트 → confirmAndPay → 서버 주문(withdrawalAck).
interface Params {
  result: QuizResultV2 | null;
  savedResultId: string | null;
  setSavedResultId: (id: string) => void;
  userName: string;
  userGender: Gender | "";
  dessertName: string;
  onToast: (msg: string) => void;
}

export function useReportPayment({ result, savedResultId, setSavedResultId, userName, userGender, dessertName, onToast }: Params) {
  const [busy, setBusy] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const requestPay = () => {
    if (busy) return;
    trackQuizEvent("pay_click");
    setConsentOpen(true);
  };

  const startPayment = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const saved = await ensureSavedResult({ savedResultId, setSavedResultId, userName, userGender, result });
      if (!saved.ok) {
        onToast("결과를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
        onToast("결제 기능은 곧 열릴 예정이에요. 잠시만 기다려주세요!");
        return;
      }
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...guestHeaders(false) },
        body: JSON.stringify({ resultId: saved.id, withdrawalAck: true }),
      });
      if (!orderRes.ok) {
        onToast("주문을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      const { orderId, amount } = await orderRes.json();

      const {
        data: { user },
      } = await createClient().auth.getUser();

      // 결제창에 다녀오면 화면 메모리가 비므로 떠나기 직전에 담아둡니다(결제 후 /auth/finish가 복원해 /result로 돌려보냄).
      stashPendingQuizForOAuth({ userName, userGender, result, savedResultId: saved.id, pendingAfterSignup: "/result" }, false);

      const { loadTossPayments, ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const widgets = toss.widgets({ customerKey: user ? user.id : ANONYMOUS });
      await widgets.setAmount({ currency: "KRW", value: amount });
      const paymentWindow = await widgets.renderPaymentWindow({
        variantKey: { paymentMethod: "DEFAULT", agreement: "AGREEMENT" },
      });
      trackQuizEvent("pay_window");
      paymentWindow.on("cancel", async () => {
        setBusy(false);
      });
      paymentWindow.on("paymentRequest", async () => {
        await widgets.requestPayment({
          orderId,
          orderName: `${dessertName} 심층 리포트`,
          successUrl: `${window.location.origin}/api/payments/confirm`,
          failUrl: `${window.location.origin}/auth/finish`,
          customerEmail: user?.email ?? undefined,
        });
      });
    } catch (err) {
      console.error("결제 시작 실패:", err);
      onToast("결제가 진행되지 않았어요. 취소했거나 문제가 생겼을 수 있어요.");
    } finally {
      setBusy(false);
    }
  };

  const confirmAndPay = () => {
    setConsentOpen(false);
    void startPayment();
  };

  return { busy, consentOpen, closeConsent: () => setConsentOpen(false), requestPay, confirmAndPay };
}
