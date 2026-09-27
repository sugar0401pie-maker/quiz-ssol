"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PRIVACY_POLICY_MD } from "@/lib/legal/privacy";
import { SENSITIVE_PRIVACY_MD } from "@/lib/legal/sensitivePrivacy";
import { TERMS_MD } from "@/lib/legal/terms";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-09-25: 이용약관·개인정보처리방침·민감정보 처리방침을 한 페이지에서 모아 볼 수 있게 합니다.
// 하단 푸터의 "개인정보처리방침 · 이용약관" 링크가 이 페이지(또는 각 섹션 앵커)로 연결됩니다.
// (추후 별도 서브도메인으로 옮길 계획이라, 지금은 이 앱 안의 한 페이지로만 구성해뒀습니다.)
const SECTIONS = [
  { id: "terms", label: "이용약관", title: "쏠 웰니스 하우스 이용약관", md: TERMS_MD },
  { id: "privacy", label: "개인정보처리방침", title: "개인정보처리방침", md: PRIVACY_POLICY_MD },
  { id: "sensitive", label: "민감정보 처리방침", title: "민감정보(테스트 응답) 처리방침", md: SENSITIVE_PRIVACY_MD },
];

const mdComponents = {
  table: (props: React.ComponentProps<"table">) => {
    const { node, ...rest } = props as typeof props & { node?: unknown };
    void node;
    return (
      <div className="table-wrap">
        <table {...rest} />
      </div>
    );
  },
};

export default function LegalPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="card">
      <button
        className="secondary"
        style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }}
        onClick={() => router.back()}
      >
        ← 뒤로
      </button>
      <p className="kicker kicker-sm">약관 및 정책</p>
      <h1 className="serif">이용약관 · 개인정보처리방침</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        쏠 웰니스 하우스의 이용약관, 개인정보처리방침, 민감정보 처리방침을 한 페이지에 모아뒀어요.
      </p>

      <div className="gender-row" style={{ flexWrap: "wrap", rowGap: 8, marginBottom: 24 }}>
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="gender-btn" style={{ flex: "1 1 30%", textAlign: "center", textDecoration: "none" }}>
            {s.label}
          </a>
        ))}
      </div>

      {SECTIONS.map((s, i) => (
        <div key={s.id} id={s.id} style={{ scrollMarginTop: 16, marginTop: i === 0 ? 0 : 40, paddingTop: i === 0 ? 0 : 24, borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <h2 className="serif" style={{ fontSize: 20 }}>
            {s.title}
          </h2>
          <div className="legal-doc">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {s.md}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
