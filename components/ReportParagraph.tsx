// 2026-09-29: "첫째, 둘째, ... 볼드 처리해줬으면" + "말머리(•) 처리된 부분도 볼드처리" 요청 —
// 리포트 문단은 마크다운 없이 plain <p>{text}</p>로 렌더링되므로(** 금지 규칙,
// lib/reportV3/prompt.ts 규칙 15 참고), AI에게 **를 쓰게 하지 않고 프런트에서
// "첫째,"/"둘째," 같은 서수 접두어와 "•"로 시작하는 말머리 소제목 줄을 골라
// <strong>으로 감쌉니다.
const ORDINAL_PREFIX = /^(첫째|둘째|셋째|넷째|다섯째),/;
const BULLET_LINE = /^•/;

export function ReportParagraph({ text, className }: { text: string; className?: string }) {
  if (BULLET_LINE.test(text)) {
    return (
      <p className={className}>
        <strong>{text}</strong>
      </p>
    );
  }
  const m = text.match(ORDINAL_PREFIX);
  if (!m) return <p className={className}>{text}</p>;
  return (
    <p className={className}>
      <strong>{m[0]}</strong>
      {text.slice(m[0].length)}
    </p>
  );
}
