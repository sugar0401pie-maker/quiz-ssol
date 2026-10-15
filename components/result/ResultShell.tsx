"use client";

import { usePathname } from "next/navigation";
import ResultExperience from "@/components/result/ResultExperience";
import { RESULT_PAGE_COUNT } from "@/components/result/resultPages";

// /result, /result/1 ~ /result/10 이면 스와이프 결과 화면을, 그 밖의 /result/... 주소(예: 관계성 리포트)면 원래 페이지를 보여줍니다.
const PAGE_PATH = /^\/result(?:\/(\d+))?\/?$/;

export default function ResultShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const m = PAGE_PATH.exec(pathname ?? "");
  const n = m?.[1] ? Number(m[1]) : null;
  // 없는 장 번호(0, 99 등)는 스와이프 화면 대신 원래 페이지(= 404)를 보여줍니다.
  if (!m || (n !== null && (n < 1 || n > RESULT_PAGE_COUNT))) return <>{children}</>;
  return <ResultExperience page={n} />;
}
