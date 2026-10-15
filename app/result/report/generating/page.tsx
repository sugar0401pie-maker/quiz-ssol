import { redirect } from "next/navigation";

// 2026-10-15: 결제 전 안내·생성 대기·완성 열람이 한 화면(스와이프 결과 /result)으로 합쳐졌습니다.
// 예전 주소로 들어와도(북마크·메일 링크 등) 새 화면으로 보냅니다.
export default function Page() {
  redirect("/result");
}
