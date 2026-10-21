"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import RadarChart from "@/components/RadarChart";
import { ReportParagraph } from "@/components/ReportParagraph";
import SubfactorDeviationChart from "@/components/SubfactorDeviationChart";
import {
  AXIS_KR,
  AXIS_ORDER,
  DESSERT,
  DESSERT_FAMILY,
  TONE_TABLE,
  TYPE_LINE1,
  TYPE_LINE2,
  TYPE_TRAITS,
  domainRelation,
  previewMatchTypes,
  type AxisKey,
  type ModeKey,
  type TypeCode,
} from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";
import { splitIntoParagraphs } from "@/lib/paragraphSplit";
import { REPORT_PRICE, formatWon } from "@/lib/pricing";
import type { TeaserSection } from "@/lib/reportV3/teaser";
import type { ReportPhase } from "@/lib/useReportAccess";
import type { QuizResultV2 } from "@/lib/scoring";
import { buildAverageComparisonText } from "@/lib/reportV3/averageComparison";
import { SECTION_TITLES } from "@/lib/reportV3/uiSections";

// 2026-10-15: 스와이프 결과 화면의 각 장. 기존 /result(무료 결과)와 /result/report(·/view)에 흩어져 있던 내용을
// 장 단위로 다시 나눈 것입니다 — 1장 기본 정보 / 2장 심층 리포트 앞부분(1번 웰니스 프로파일) / 3장 "이런 사람"+궁합 /
// 4~10장 심층 리포트 2~8번(결제 전엔 첫 문장만 선명, 나머지는 블러).

interface HeroProps {
  userName: string;
  title: string;
  result: QuizResultV2;
}

// 1장 — 캐릭터, 유형 기본 설명, 그래프
export function ProfileSlide({ userName, title, result }: HeroProps) {
  const { confirmedAxis, typeCode, axisScores } = result;
  const dessert = DESSERT[typeCode];
  const family = DESSERT_FAMILY[confirmedAxis];
  const strongest = AXIS_ORDER.reduce((a, b) => (axisScores[b] > axisScores[a] ? b : a));
  const weakest = AXIS_ORDER.reduce((a, b) => (axisScores[b] < axisScores[a] ? b : a));
  const imgSrc = `/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`;
  return (
    <>
      <div className="res-avatar">
        {dessert.hasArt ? (
          <Image src={imgSrc} alt={dessert.name} fill sizes="480px" priority />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sky-bg)", position: "relative" }}>
            <Image src={imgSrc} alt={dessert.name} fill sizes="480px" style={{ opacity: 0.55 }} />
            <span className="tiny" style={{ position: "absolute", bottom: 10, background: "var(--white)", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)" }}>
              캐릭터 그림 준비 중이에요
            </span>
          </div>
        )}
      </div>
      <p className="type-reveal">
        <span>{`${userName} ${title}님은 `}</span>
        <span className="type-name-inline serif">{dessert.name}</span> 유형입니다.
      </p>
      <p className="type-blurb">{family.desc}</p>
      <RadarChart scores={axisScores} />
      {/* 2026-09-25: 점수 숫자 대신 그 영역이 지금 어떤 상태인지를 말로 풀어서 전달합니다. */}
      {strongest === weakest ? (
        <p className="type-blurb" style={{ marginTop: -10 }}>
          다섯 영역이 비슷하게 채워져 있어요. 그중에서도 {AXIS_KR[weakest]} 영역에 요즘 조금 더 마음이 쓰이는 시기예요.
        </p>
      ) : (
        <p className="type-blurb" style={{ marginTop: -10 }}>
          {AXIS_KR[strongest]} 영역은 지금 가장 안정적으로 채워져 있어서, 큰 걱정 없이 잘 흘러가고 있어요.
          <br />
          {AXIS_KR[weakest]} 영역은 요즘 가장 마음이 쓰이는 곳이에요.
        </p>
      )}
      <p className="type-blurb">{dessert.why}</p>
    </>
  );
}

// 2장 — 심층 리포트 앞부분(1번 웰니스 프로파일). 무료 공개 파트입니다.
export function ReportIntroSlide({ result, section1 }: HeroProps & { section1: string[] | null }) {
  const dessert = DESSERT[result.typeCode];
  return (
    <>
      <p className="kicker kicker-sm">심층 리포트</p>
      <h1 className="serif">{dessert.name}의 웰니스 이야기</h1>
      <p className="traits-title" style={{ marginTop: 12 }}>
        1. {SECTION_TITLES[0]}
      </p>
      {section1 ? (
        section1.map((p, i) => <ReportParagraph key={i} text={p} className="type-blurb" />)
      ) : (
        <p className="muted pulse-text">{dessert.name}을 정성껏 굽고 있어요...</p>
      )}
    </>
  );
}

// 3장 맨 앞 — 전체 유형 평균과 비교한 내 점수(그래프 + 눈에 띄는 요인 설명). 2장에 있던 것을 "나는 왜 이 유형인가"를
// 이어서 보도록 3장으로 옮겼습니다. 점수만으로 정해지는 내용이라 결제·서버 응답을 기다리지 않고 바로 그려집니다.
export function AverageComparisonBlock({ userName, title, result }: HeroProps) {
  const { typeCode, confirmedAxis, factorScores } = result;
  const dessert = DESSERT[typeCode];
  const comparison = buildAverageComparisonText(userName, title, factorScores, confirmedAxis, AXIS_KR[confirmedAxis], dessert.name);
  return (
    <div className="avg-compare">
      {comparison.intro.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" boldOnly={i === 0} />
      ))}
      <SubfactorDeviationChart individual={factorScores} indLabel={`나의 점수(${dessert.name})`} />
      {comparison.deviationNote.map((p, i) => (
        <ReportParagraph key={i} text={p} className="type-blurb" />
      ))}
    </div>
  );
}

// 3장 — "당신은 이런 사람일 거예요" + 잘 맞는 유형(궁합)
export function TraitsMatchSlide({ typeCode, confirmedAxis, onMatch }: { typeCode: TypeCode; confirmedAxis: AxisKey; onMatch: () => void }) {
  const preview = previewMatchTypes(typeCode);
  const cards: { key: string; label: string; type: TypeCode; cls: string }[] = [
    { key: "connected", label: "편안한 친구", type: preview.connectedSame, cls: "best" },
    { key: "independent", label: "아마도 정반대?", type: preview.independentDiff, cls: "worst" },
  ];
  return (
    <>
      <p className="traits-title" style={{ marginTop: 0 }}>당신은 이런 사람일거에요</p>
      <ul className="traits">
        <li>{TYPE_LINE1[confirmedAxis]}</li>
        <li>{TYPE_LINE2[typeCode]}</li>
        {TYPE_TRAITS[typeCode].map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>

      <p className="match-title">당신과 가장 잘 맞는 유형은 누구일까요?</p>
      <div className="match-row">
        {cards.map((c) => {
          const [fAxis, fMode] = c.type.split("-") as [AxisKey, ModeKey];
          const [myAxis, myMode] = typeCode.split("-") as [AxisKey, ModeKey];
          const dRel = domainRelation(myAxis, fAxis);
          const mRel = myMode === fMode ? "same" : "diff";
          const tone = TONE_TABLE[`${dRel}-${mRel}`];
          const d = DESSERT[c.type];
          return (
            <div key={c.key} className={`match-card ${c.cls}`}>
              <p className="match-label">{c.label}</p>
              <div className="match-avatar">
                <Image src={`/images/icons/icon-${resolveIconKey(d.icon)}.png`} alt={d.name} fill sizes="92px" />
              </div>
              <p className="match-name">{d.name}</p>
              {splitIntoParagraphs(tone.body, 1).map((line, i) => (
                <p key={i} className="match-desc">{line}</p>
              ))}
            </div>
          );
        })}
      </div>
      <button className="secondary" style={{ marginTop: -8, marginBottom: 8 }} onClick={onMatch}>
        다른 유형과 나의 관계는 어떨까?!
      </button>
    </>
  );
}

// "리포트 쓰는 중" 안내 — 오래 걸려도 멈춘 것처럼 보이지 않게 문구를 단계적으로 바꿉니다(예전 /generating 페이지의 문구).
function waitingMessage(elapsedSec: number, dessertName: string): string {
  if (elapsedSec < 10) return "당신의 답변을 하나씩 살펴보고 있어요....";
  if (elapsedSec < 25) return `${dessertName}만의 레시피를 쓰는 중이에요....`;
  if (elapsedSec < 40) return "오븐에 천천히 굽고 있어요 — 좋은 건 원래 좀 걸려요.....";
  if (elapsedSec < 60) return "마지막으로 예쁘게 플레이팅하는 중이에요, 조금만 더요.....";
  return "정성 들이느라 평소보다 조금 늦어지고 있어요. 곧 나와요!";
}

function WritingNotice({ dessertName }: { dessertName: string }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="writing-notice" role="status">
      <div className="writing-orbit" aria-hidden="true" />
      <p className="writing-msg">{waitingMessage(sec, dessertName)}</p>
      <p className="tiny">결제는 완료됐어요. 다른 장을 보면서 기다리셔도 돼요.</p>
    </div>
  );
}

interface SectionSlideProps {
  num: number;
  title: string;
  phase: ReportPhase;
  dessertName: string;
  /** 완성된 리포트의 이 섹션 문단(phase === "ready") */
  paragraphs?: string[];
  leadInIndex?: number | null;
  /** 결제 전 미리보기(2~8번) */
  teaser?: TeaserSection;
  teaserFailed?: boolean;
  onPay: () => void;
  onRetry: () => void;
  busy: boolean;
  /** 8번 마지막 문단처럼 카드 밖에 따로 보여줄 문단 */
  extra?: ReactNode;
}

// 4~10장 — 심층 리포트 2~8번
export function SectionSlide({ num, title, phase, dessertName, paragraphs, leadInIndex = null, teaser, teaserFailed, onPay, onRetry, busy, extra }: SectionSlideProps) {
  const head = (
    <div className="teaser-head">
      <span className="r-num">{num}</span>
      <p className="r-title">{title}</p>
    </div>
  );

  if (phase === "ready" && paragraphs) {
    return (
      <>
        {head}
        {paragraphs.map((p, i) => (
          <ReportParagraph key={i} text={p} className="type-blurb" forceBold={i === leadInIndex} />
        ))}
        {extra}
      </>
    );
  }
  if (phase === "generating") {
    return (
      <>
        {head}
        <WritingNotice dessertName={dessertName} />
      </>
    );
  }
  if (phase === "failed") {
    return (
      <>
        {head}
        <div className="cta">
          <p className="cta-title">리포트를 쓰는 중에 문제가 생겼어요</p>
          <p>결제는 정상 처리됐어요 — 아래 버튼으로 다시 시도해주세요.</p>
        </div>
        <button className="btn-lg" style={{ marginTop: 16 }} onClick={onRetry}>
          다시 시도하기
        </button>
      </>
    );
  }

  // checking / locked — 첫 문장은 선명하게, 나머지는 블러. 결제 확인이 끝나기 전(checking)에는 결제 버튼을 보여주지 않습니다.
  return (
    <>
      {head}
      {teaser ? (
        <div className="teaser-section">
          {teaser.clear.map((p, i) => (
            <p key={i} className="type-blurb">
              {p}
            </p>
          ))}
          <div className="teaser-blur teaser-blur-first" aria-hidden="true">
            {teaser.blur.map((p, i) => (
              <p key={i} className="type-blurb">
                {p}
              </p>
            ))}
          </div>
          {phase === "locked" && (
            <div className="teaser-cta">
              <p className="teaser-cta-title">여기부터는 결제 후 이어서 읽을 수 있어요</p>
              <p className="teaser-cta-sub">결제하면 바로 열려요 · 쏘웰라 1주일 체험권도 함께 드려요</p>
              <button className="btn-lg" onClick={onPay} disabled={busy}>
                {formatWon(REPORT_PRICE)}원으로 이어서 읽기
              </button>
            </div>
          )}
        </div>
      ) : teaserFailed ? (
        <div className="teaser-cta">
          <p className="teaser-cta-title">이 파트는 결제 후 읽을 수 있어요</p>
          {phase === "locked" && (
            <button className="btn-lg" onClick={onPay} disabled={busy}>
              {formatWon(REPORT_PRICE)}원으로 이어서 읽기
            </button>
          )}
        </div>
      ) : (
        <p className="muted pulse-text">불러오는 중이에요...</p>
      )}
    </>
  );
}
