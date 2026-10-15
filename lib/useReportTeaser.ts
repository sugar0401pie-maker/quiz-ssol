"use client";

import { useEffect, useState } from "react";
import type { Gender } from "@/lib/data";
import type { TeaserSection } from "@/lib/reportV3/teaser";
import type { QuizResultV2 } from "@/lib/scoring";

// 2026-10-15: 결제 전 화면에 쓰는 문장을 서버(/api/report/teaser)에서 받아옵니다 — 로그인·저장 없이 응답만으로 계산합니다.
//   section1 : 무료 공개 파트(1번 웰니스 프로파일) 전문
//   sections : 2~8번의 "선명한 첫 문장 + 블러 자리표시" (결제해야 읽는 본문은 포함되지 않음)
export function useReportTeaser(result: QuizResultV2 | null, userName: string, userGender: Gender | "", enabled: boolean) {
  const [sections, setSections] = useState<TeaserSection[] | null>(null);
  const [section1, setSection1] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !result || !userGender || sections) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/report/teaser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName,
            gender: userGender,
            part1Answers: result.part1Answers,
            part2Answers: result.part2Answers,
            confirmedAxis: result.confirmedAxis,
            confirmedMode: result.confirmedMode,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.sections)) setSections(data.sections);
        if (Array.isArray(data.section1)) setSection1(data.section1);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, result, userName, userGender, sections]);

  return { sections, section1, failed };
}
