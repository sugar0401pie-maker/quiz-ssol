import { splitBoldParagraph } from "@/lib/reportV3/boldParagraph";

// 2026-09-29: "첫째, 둘째, ... 볼드 처리해줬으면" + "말머리(•) 처리된 부분도 볼드처리" 요청 —
// 리포트 문단은 마크다운 없이 plain <p>{text}</p>로 렌더링되므로(** 금지 규칙,
// lib/reportV3/prompt.ts 규칙 15 참고), AI에게 **를 쓰게 하지 않고 프런트에서
// "첫째,"/"둘째," 같은 서수 접두어와 "•"로 시작하는 말머리 소제목 줄을 골라
// <strong>으로 감쌉니다. 판정 규칙은 lib/reportV3/boldParagraph.ts에서 이메일 렌더러
// (lib/reportV3/emailHtml.ts)와 공유합니다.
//
// 2026-09-30: 섹션 두괄식 요약 문단(규칙 17)은 패턴이 아니라 "그 섹션의 첫 문단"이라는
// 위치로 정해지므로, 호출부가 forceBold로 직접 지정합니다. 사장님 피드백 — 이 요약
// 문장은 볼드뿐 아니라 글자 크기도 다른 문장보다 살짝 크게(.lead-in-summary, globals.css).
//
// 2026-10-05: boldOnly — 굵게만 하고 글자 크기는 키우지 않는 지정. "평균과 대비하면 다음과
// 같습니다" 안내 문장처럼, 요약 문단(.lead-in-summary)은 아니지만 굵게만 보이면 되는 곳용.
export function ReportParagraph({
  text,
  className,
  forceBold,
  boldOnly,
}: {
  text: string;
  className?: string;
  forceBold?: boolean;
  boldOnly?: boolean;
}) {
  const { boldText, restText } = splitBoldParagraph(text, forceBold || boldOnly);
  if (!boldText) return <p className={className}>{text}</p>;
  const cls = forceBold ? [className, "lead-in-summary"].filter(Boolean).join(" ") : className;
  return (
    <p className={cls}>
      <strong>{boldText}</strong>
      {restText}
    </p>
  );
}
