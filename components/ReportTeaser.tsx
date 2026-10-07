"use client";

import type { TeaserSection } from "@/lib/reportV3/teaser";

// 2026-10-07: 결제 전 "블러 미리보기". 섹션마다 앞부분(선명, 실제 확정 문장)은 그대로 읽히고 그 뒤는 블러로
// 이어져서, 스크롤하면 리포트가 계속되는 것처럼 보이되 더 읽으려면 결제가 필요합니다. 블러로 가린 문단은 실제 유료
// 내용이 아니라 같은 길이의 자리표시 문장입니다(lib/reportV3/teaser.ts) — 화면 접근성 도구에는 숨깁니다.
export default function ReportTeaser({
  sections,
  priceLabel,
  onPay,
  busy,
}: {
  sections: TeaserSection[];
  priceLabel: string;
  onPay: () => void;
  busy: boolean;
}) {
  return (
    <div className="teaser">
      {sections.map((s, idx) => (
        <div key={s.num} className="teaser-section">
          <div className="teaser-head">
            <span className="r-num">{s.num}</span>
            <p className="r-title">{s.title}</p>
          </div>
          {s.clear.map((p, i) => (
            <p key={i} className="type-blurb">
              {p}
            </p>
          ))}
          <div className={`teaser-blur${idx === 0 ? " teaser-blur-first" : ""}`} aria-hidden="true">
            {s.blur.map((p, i) => (
              <p key={i} className="type-blurb">
                {p}
              </p>
            ))}
          </div>
          {idx === 0 && (
            <div className="teaser-cta">
              <p className="teaser-cta-title">여기부터는 결제 후 이어서 읽을 수 있어요</p>
              <p className="teaser-cta-sub">결제하면 바로 열려요 · 쏘웰라 1주일 체험권도 함께 드려요</p>
              <button className="btn-lg" onClick={onPay} disabled={busy}>
                {priceLabel}으로 이어서 읽기
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
