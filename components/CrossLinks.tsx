// 2026-11-05: 공개 소개 페이지(/about, /types, /types/유형별) 맨 아래에 다는 "다른 서비스로 이어가기" 버튼 2개 — 타로 테스트, 쏘웰라.
// utm으로 어느 페이지에서 넘어갔는지 남깁니다(utm_source=quiz, utm_medium=페이지 종류).
export default function CrossLinks({ from }: { from: "about" | "types" | "type" }) {
  const utm = `utm_source=quiz&utm_medium=${from}`;
  return (
    <div className="cross-links">
      <a className="link-btn-lg cross-tarot" href={`https://tarot.ssolwellnesshouse.com/?${utm}`}>
        타로 테스트 보러 가기
      </a>
      <a className="link-btn-lg cross-sowella" href={`https://app.ssolwellnesshouse.com/?${utm}`}>
        쏘웰라와 이야기하기 · 가입하면 3일 무료
      </a>
    </div>
  );
}
