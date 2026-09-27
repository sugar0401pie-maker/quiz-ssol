"use client";

import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SENSITIVE_PRIVACY_MD } from "@/lib/legal/sensitivePrivacy";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 민감정보(테스트 응답) 처리방침 — 가입 화면의 별도 동의 체크박스에서 링크로 연결됩니다.
export default function SensitivePrivacyPage() {
  const router = useRouter();
  return (
    <div className="card">
      <button
        className="secondary"
        style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }}
        onClick={() => router.back()}
      >
        ← 뒤로
      </button>
      <p className="kicker kicker-sm">민감정보 처리방침</p>
      <h1 className="serif">테스트 응답(민감정보) 처리방침</h1>
      <div className="legal-doc">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: (props) => {
              const { node, ...rest } = props;
              void node;
              return (
                <div className="table-wrap">
                  <table {...rest} />
                </div>
              );
            },
          }}
        >
          {SENSITIVE_PRIVACY_MD}
        </ReactMarkdown>
      </div>
    </div>
  );
}
