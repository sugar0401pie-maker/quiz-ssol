"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuiz } from "@/lib/QuizContext";
import { DESSERT } from "@/lib/data";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-09-28: "화면마다 전부 별도 페이지로" 요청 — 생성 실패 화면이 /result/report와
// /result/report/generating 두 곳에 각각 중복 인라인으로 들어가 있던 걸 이 별도 페이지
// 하나로 합쳤습니다. 두 페이지 모두 이제 실패를 감지하면 여기로 리다이렉트합니다.
export default function ReportFailedPage() {
  const router = useRouter();
  const { result } = useQuiz();

  // 2026-09-28: 리다이렉트는 반드시 useEffect 안에서만 — 렌더링 도중 바로 호출하면 빌드 시
  // 프리렌더 단계에서 "location is not defined" 오류가 납니다(다른 페이지들과 같은 패턴).
  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  if (!result) return null;
  const dessert = DESSERT[result.typeCode];

  return (
    <div className="card">
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
      <div className="cta">
        <p className="cta-title">리포트를 쓰는 중에 문제가 생겼어요</p>
        <p>결제는 정상 처리됐어요 — 아래 버튼으로 다시 시도해주세요.</p>
      </div>
      <button className="btn-lg" style={{ marginTop: 16 }} onClick={() => router.replace("/result/report")}>
        다시 시도하기
      </button>
    </div>
  );
}
