import ResultShell from "@/components/result/ResultShell";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-10-15: /result(와 /result/1 ~ /result/10)는 이 레이아웃이 한 번 그려서 스와이프로 넘겨도 다시 만들어지지 않게 합니다.
// 장마다 별도 주소를 가지면서도(app/result/[page]) 화면 상태·스크롤 위치가 유지되게 하려는 구조입니다.
export default function ResultLayout({ children }: { children: React.ReactNode }) {
  return <ResultShell>{children}</ResultShell>;
}
