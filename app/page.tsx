"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuiz } from "@/lib/QuizContext";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 1. 인트로
export default function IntroPage() {
  const router = useRouter();
  const { reset } = useQuiz();

  useEffect(() => {
    router.prefetch("/start");
  }, [router]);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      <Image
        src="/images/hero/hero-intro.jpg"
        alt="티파티에 초대받은 내가 사실은 디저트?!"
        width={941}
        height={1672}
        priority
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "22px 24px 24px",
          background:
            "linear-gradient(to top, rgba(255,247,236,1) 0%, rgba(255,247,236,0.95) 45%, rgba(255,247,236,0) 100%)",
        }}
      >
        <p
          className="tiny social-proof"
          style={{ margin: "0 0 12px", textAlign: "center", color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.4)" }}
        >
          🍰 벌써 1,524명이 참여했어요
        </p>
        <button
          className="btn-lg"
          onClick={() => {
            reset();
            router.push("/start");
          }}
        >
          테스트 하기
        </button>
        <button
          className="secondary"
          style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 2, padding: "8px 12px" }}
          onClick={() => router.push("/login")}
        >
          <span style={{ color: "inherit", opacity: 0.75, fontSize: 10 }}>이미 테스트를 하셨다면</span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>로그인하기</span>
        </button>
      </div>
    </div>
  );
}
