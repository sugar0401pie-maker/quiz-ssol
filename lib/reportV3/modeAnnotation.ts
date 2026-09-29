// 2026-09-29: "용기형/평온형/유보형을 원래 단어(전문 용어)도 괄호로 같이 보여달라"는 요청.
// prompt.ts(AI 프롬프트)와 section6Assembler.ts(서버 조립) 둘 다 같은 표기를 써야 해서
// 공용 파일로 뺐습니다.
const MODE_ANNOTATION: Record<string, string> = {
  용기형: "용기형(1차 통제)",
  평온형: "평온형(2차 통제)",
  유보형: "유보형(이탈)",
};

export function annotateMode(modeKR: string): string {
  return MODE_ANNOTATION[modeKR] ?? modeKR;
}
