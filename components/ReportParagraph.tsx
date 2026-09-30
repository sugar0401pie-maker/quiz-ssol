import { splitBoldParagraph } from "@/lib/reportV3/boldParagraph";

// 2026-09-29: "첫째, 둘째, ... 볼드 처리해줬으면" + "말머리(•) 처리된 부분도 볼드처리" 요청 —
// 리포트 문단은 마크다운 없이 plain <p>{text}</p>로 렌더링되므로(** 금지 규칙,
// lib/reportV3/prompt.ts 규칙 15 참고), AI에게 **를 쓰게 하지 않고 프런트에서
// "첫째,"/"둘째," 같은 서수 접두어와 "•"로 시작하는 말머리 소제목 줄을 골라
// <strong>으로 감쌉니다. 판정 규칙은 lib/reportV3/boldParagraph.ts에서 이메일 렌더러
// (lib/reportV3/emailHtml.ts)와 공유합니다.
//
// 2026-09-30: 섹션 두괄식 요약 문단(규칙 17)은 패턴이 아니라 "그 섹션의 첫 문단"이라는
// 위치로 정해지므로, 호출부가 forceBold로 직접 지정합니다.
export function ReportParagraph({ text, className, forceBold }: { text: string; className?: string; forceBold?: boolean }) {
  const { boldText, restText } = splitBoldParagraph(text, forceBold);
  if (!boldText) return <p className={className}>{text}</p>;
  return (
    <p className={className}>
      <strong>{boldText}</strong>
      {restText}
    </p>
  );
}
