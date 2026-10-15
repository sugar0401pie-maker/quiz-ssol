import { notFound } from "next/navigation";
import { RESULT_PAGE_COUNT } from "@/components/result/resultPages";

export const dynamic = "force-dynamic";

// 결과 화면의 장별 주소 /result/1 ~ /result/10. 화면 자체는 app/result/layout.tsx가 그립니다.
export default function ResultPageNumber({ params }: { params: { page: string } }) {
  const n = Number(params.page);
  if (!Number.isInteger(n) || n < 1 || n > RESULT_PAGE_COUNT) notFound();
  return null;
}
