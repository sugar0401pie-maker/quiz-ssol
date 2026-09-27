"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import { AXIS_ORDER, DESSERT, matchTone, type AxisKey, type ModeKey, type TypeCode } from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// ssol-wellness-v2-master-spec.md 9장 — 궁합(매칭) 기능.
// 9.1: 점수 입력(멘토 영역 4.0점 기준 등)은 마찰이 커서 폐기된 설계입니다. 지금은 친구가 자기
// 디저트 유형 이름만 알면 되는, 유형 코드(영역+대처방식) 구조만으로 계산하는 방식입니다.
// 9.7: 친구 이름 입력 + 친구의 디저트 유형을 드롭다운에서 선택(15개 중 하나, 점수 입력 없음).
const TYPE_OPTIONS: TypeCode[] = AXIS_ORDER.flatMap((axis) =>
  (["primary", "secondary", "disengage"] as ModeKey[]).map((mode) => `${axis}-${mode}` as TypeCode)
);

export default function MatchPage() {
  const router = useRouter();
  const { result } = useQuiz();
  const [friendName, setFriendName] = useState("");
  const [friendType, setFriendType] = useState<TypeCode | "">("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!result) router.replace("/");
  }, [result, router]);

  if (!result) return null;

  const canCheck = friendName.trim() && friendType;
  const [myAxis, myMode] = result.typeCode.split("-") as [AxisKey, ModeKey];
  const tone = friendType
    ? (() => {
        const [fAxis, fMode] = friendType.split("-") as [AxisKey, ModeKey];
        return matchTone(myAxis, myMode, fAxis, fMode);
      })()
    : null;

  return (
    <div className="card">
      <button className="secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }} onClick={() => router.push("/result")}>
        ← 뒤로
      </button>
      <p className="kicker kicker-sm">다른 사람과의 관계성 확인하기</p>
      <h1 className="serif">연인 또는 친구의 유형을 알려주세요</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        상대가 이미 테스트를 마쳤다면, 상대의 결과 화면에 나온 디저트 유형을 그대로 골라주세요. 점수는 몰라도 괜찮아요.
      </p>

      <p className="field-label">상대 이름</p>
      <input type="text" className="text-input" placeholder="연인 또는 친구 이름" value={friendName} onChange={(e) => setFriendName(e.target.value)} />

      <p className="field-label">상대의 디저트 유형</p>
      <select
        className="text-input"
        value={friendType}
        onChange={(e) => {
          setFriendType(e.target.value as TypeCode);
          setChecked(false);
        }}
      >
        <option value="">유형을 골라주세요</option>
        {TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {DESSERT[t].name}
          </option>
        ))}
      </select>

      <button className="btn-lg" style={{ marginTop: 16 }} onClick={() => setChecked(true)} disabled={!canCheck}>
        관계성 확인하기
      </button>

      {checked && canCheck && tone && (
        <>
          <div className="tone-card">
            <div className="tone-avatars">
              <div className="tone-avatar">
                <Image
                  src={`/images/icons/icon-${resolveIconKey(DESSERT[result.typeCode].icon)}.png`}
                  alt={DESSERT[result.typeCode].name}
                  fill
                  sizes="76px"
                />
              </div>
              <span className="tone-x">×</span>
              <div className="tone-avatar">
                <Image src={`/images/icons/icon-${resolveIconKey(DESSERT[friendType as TypeCode].icon)}.png`} alt={friendName} fill sizes="76px" />
              </div>
            </div>
            <p className="tone-title">{tone.headline}</p>
            {tone.detail.map((p, i) => (
              <p key={i} className="tone-body">{p}</p>
            ))}
          </div>

          <p className="muted" style={{ marginTop: 16, marginBottom: 8 }}>
            우리의 관계, 무엇이 같고 무엇이 다른지 확인해보고 싶다면
          </p>
          <button
            className="secondary"
            onClick={() => router.push(`/result/report/relationship?friend=${friendType}&friendName=${encodeURIComponent(friendName)}`)}
          >
            유형간 심층 보고서 열람하기(유료)
          </button>
        </>
      )}
    </div>
  );
}
