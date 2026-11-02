"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuiz } from "@/lib/QuizContext";

// 1. 인트로
export default function IntroClient() {
  const router = useRouter();
  const { reset } = useQuiz();

  useEffect(() => {
    router.prefetch("/start");
  }, [router]);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      {/* 2026-11-02: 화면에는 제목이 그림 안에 들어 있어 글자 제목이 없었다 — 검색 엔진·화면 낭독기용 h1을 시각적으로 숨겨 둔다. */}
      <h1 className="sr-only">티파티에 초대받은 내가 사실은 디저트?!</h1>
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
          🍰 벌써 2,391명이 참여했어요
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
