"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

// 2026-10-28: 어느 화면으로 들어오든 세션의 첫 화면에서 유입 경로(utm·이전 사이트)를 한 번 기록합니다(lib/attribution.ts).
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
