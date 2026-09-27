"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import type { Gender } from "@/lib/data";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용 — 완전 정적 페이지로 빌드되면 배포 후에도 예전
// 캐시가 그대로 남아 보이는 문제가 있었습니다(자세한 사연은 이전 대화 참고). force-dynamic으로
// 이 문제를 피합니다.
export const dynamic = "force-dynamic";

const GENDERS: { key: Gender; label: string }[] = [
  { key: "female", label: "공주" },
  { key: "male", label: "왕자" },
  { key: "none", label: "공작" },
];

// 2. 온보딩 — 닉네임 + 호칭(공주/왕자/공작) 선택.
export default function StartPage() {
  const router = useRouter();
  const { setProfile } = useQuiz();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [error, setError] = useState("");

  const startQuiz = () => {
    if (!name.trim()) {
      setError("닉네임을 적어주세요.");
      return;
    }
    if (!gender) {
      setError("저택의 주인을 골라주세요.");
      return;
    }
    setProfile(name.trim(), gender);
    router.push("/quiz");
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <Image
        src="/images/hero/hero-onboarding.jpg"
        alt="티파티에 초대받은 디저트 친구들"
        width={900}
        height={491}
        priority
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      <div style={{ padding: "28px 24px" }}>
        <p className="kicker">티파티에 초대받은 내가 디저트?!</p>
        <h1 className="serif">나는 어떤 디저트일까?</h1>
        <p className="muted">
          간만에 푹 자고 일어난 당신, 눈을 뜨고 나니 장미 넝쿨과 꽃이 가득한 저택이네요. 그런데 어쩐 일인지 내가
          2등신의 디저트로 변한 것 같아요. 여기가 말로만 듣던 쏠 디저트 왕국인 걸까요? 이곳에서는 당신의 성향에
          따라 귀여운 디저트로 바뀐다고 하는데, 과연 당신은 어떤 디저트인지 알아보아요.
        </p>

        <p className="field-label">당신의 닉네임을 알려주세요</p>
        <input
          type="text"
          className="text-input"
          placeholder="닉네임을 적어주세요"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="field-label">당신은 이 저택의 —</p>
        <div className="gender-row">
          {GENDERS.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`gender-btn${gender === g.key ? " selected" : ""}`}
              onClick={() => setGender(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
        {error && <p className="field-error">{error}</p>}

        <div className="notice">
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 9 }}>
            <li>
              테스트 시작하기를 누르면 약 5분간 33개의 질문을 풀게됩니다. 각각의 질문은 너무 오래 생각하지 마시고
              직관적으로 답해주세요.
            </li>
            <li>
              전문 심리상담사가 만든 자기이해 도구로, 의료적 진단이나 심리 치료를 대신하지 않고 질병, 장애여부 등을
              판단하지 않습니다.
            </li>
            <li>로그인 없이 바로 시작할 수 있으며, 응답은 저장되지 않습니다. 필요시 신규 계정을 만들어서 저장해주세요.</li>
          </ul>
        </div>

        <button className="btn-lg" style={{ marginTop: 12 }} onClick={startQuiz}>
          테스트 진행하기
        </button>
      </div>
    </div>
  );
}
