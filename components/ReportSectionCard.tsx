"use client";

import { useState } from "react";
import { ReportParagraph } from "./ReportParagraph";

// 2026-09-30: "결제 후 페이지도 결제 전 잠긴 목록과 같은 모습으로, 열면 글이 나오게" 요청 —
// 결제 전 잠금 카드(.report-section + 🔒)와 똑같은 모양의 카드를, 잠금 대신 열고/닫는
// 아코디언으로 씁니다. 열려 있을 때는 이미 있던 "무료 미리보기" 카드 스타일
// (.report-section-preview, 관계성 보고서 1번 무료 공개에 쓰던 것)을 그대로 재사용합니다.
export function ReportSectionCard({
  num,
  title,
  paragraphs,
  leadInIndex,
  highlightLast,
  defaultOpen,
}: {
  num: number;
  title: string;
  paragraphs: string[];
  /** 규칙 17(두괄식) 요약 문단의 인덱스. 그 문단만 굵게 표시합니다. */
  leadInIndex: number | null;
  /** 섹션 8의 마지막 문단처럼 별도 강조 박스로 보여줄 때. */
  highlightLast?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const peek = leadInIndex !== null ? paragraphs[leadInIndex] : paragraphs[0];

  return (
    <div className={`report-section${open ? " report-section-preview" : ""}`}>
      <div className="report-section-head" onClick={() => setOpen((o) => !o)}>
        <span className="r-num">{num}</span>
        <div>
          <p className="r-title">{title}</p>
          {!open && peek && <p className="r-teaser">{peek}</p>}
        </div>
        <span className="r-chevron">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="report-section-body">
          {paragraphs.map((p, i) =>
            highlightLast && i === paragraphs.length - 1 ? (
              <div key={i} className="section8-highlight">
                <p>{p}</p>
              </div>
            ) : (
              <ReportParagraph key={i} text={p} forceBold={i === leadInIndex} />
            )
          )}
        </div>
      )}
    </div>
  );
}
