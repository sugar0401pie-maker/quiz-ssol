"use client";

import { usePathname } from "next/navigation";
import ResultExperience from "@/components/result/ResultExperience";

// /result, /result/1 ~ /result/10 이면 스와이프 결과 화면을, 그 밖의 /result/... 주소(예: 관계성 리포트)면 원래 페이지를 보여줍니다.
const PAGE_PATH = /^\/result(?:\/(\d+))?\/?$/;

export default function ResultShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const m = PAGE_PATH.exec(pathname ?? "");
  if (!m) return <>{children}</>;
  return <ResultExperience page={m[1] ? Number(m[1]) : null} />;
}
