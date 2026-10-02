// 2026-09-29: "용기형/평온형/유보형을 원래 단어(전문 용어)도 괄호로 같이 보여달라"는 요청.
// prompt.ts(AI 프롬프트)와 section6Assembler.ts(서버 조립) 둘 다 같은 표기를 써야 해서
// 공용 파일로 뺐습니다.
// 2026-10-02: JunSeok 인계서 확인 후 표기 순서를 뒤집음 — "용기형(1차 통제)"처럼 자체
// 명칭을 앞에 쓰던 것을, JunSeok이 원래 심리학 용어를 기준으로 쓰는 "1차 통제(용기형)"
// 순서에 맞춤(원래 용어가 주, 친근한 이름이 부연).
const MODE_ANNOTATION: Record<string, string> = {
  용기형: "1차 통제(용기형)",
  평온형: "2차 통제(평온형)",
  유보형: "이탈(유보형)",
};

export function annotateMode(modeKR: string): string {
  return MODE_ANNOTATION[modeKR] ?? modeKR;
}
