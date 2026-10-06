"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { KakaoBubbleIcon } from "@/components/BrandIcons";
import RadarChart from "@/components/RadarChart";
import ShareSheet from "@/components/ShareSheet";
import { useQuiz } from "@/lib/QuizContext";
import { createClient } from "@/lib/supabase/client";
import {
  AXIS_KR,
  AXIS_ORDER,
  DESSERT,
  DESSERT_FAMILY,
  DISCLAIMER,
  TONE_TABLE,
  TYPE_LINE1,
  TYPE_LINE2,
  TYPE_TRAITS,
  domainRelation,
  previewMatchTypes,
  type AxisKey,
  type Gender,
  type ModeKey,
  type TypeCode,
} from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";
import { splitIntoParagraphs } from "@/lib/paragraphSplit";
import { REPORT_PRICE, formatWon } from "@/lib/pricing";
import { detectSpecialResult } from "@/lib/scoring";
import { SPECIAL_RESULTS } from "@/lib/specialResults";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

// 2026-09-25: 로그인 화면에서 "결과 저장하기" 흐름을 마치고 돌아왔을 때(/result?saved=1),
// 저장됐다는 걸 잠깐 토스트로 알려줍니다. useSearchParams는 Suspense 경계 안에서만 정적
// 렌더링과 함께 쓸 수 있어 별도 컴포넌트로 뺐습니다(app/signup/page.tsx와 같은 패턴).
function SavedToastEffect({ onSaved }: { onSaved: () => void }) {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("saved") === "1") onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// v2 스펙 6.5, 10장 — 무료 결과 화면.
// 노출 순서: 디저트 이름 → 계열 태그 → 계열 설명 → 디저트별 대처방식 설명 →
// 영역/대처방식 한 줄 요약 → 오각형 그래프(무료 확정) → 고지문.
export default function ResultPage() {
  const router = useRouter();
  const { userName, userGender, title, result, savedResultId, setProfile, setResult, setSavedResultId, reset } = useQuiz();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [reportCtaCollapsed, setReportCtaCollapsed] = useState(false);
  // 2026-09-25: result가 Context에 없을 때(로그인 직후 리다이렉트, 또는 로그인된 채로 이
  // 페이지를 직접 새로고침/주소창 진입한 경우) 바로 "/"로 튕겨내지 않고, 로그인 여부를 먼저
  // 확인해서 저장된 결과가 있으면 불러옵니다. Context는 메모리 상태라 새로고침하면 비어있는
  // 게 정상이라, 이 확인 없이는 로그인된 사용자도 계속 첫 화면으로 밀려나는 문제가 있었습니다.
  useEffect(() => {
    if (result) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // 2026-09-28: "비로그인으로 /result에 직접 들어가면 로그인 화면으로" 요청 — 이전엔
        // 첫 화면("/")으로 보냈는데, 여기서는 곧장 로그인 화면으로 보냅니다. /login은 로그인
        // 직후 저장된 결과가 있으면 자동으로 불러와서 다시 /result로 돌려보내는 로직을 이미
        // 갖고 있어서, 그대로 재사용하면 됩니다.
        if (!cancelled) router.replace("/login");
        return;
      }
      const res = await fetch("/api/results");
      if (!res.ok) {
        if (!cancelled) router.replace("/");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setProfile(data.userName, data.gender as Gender);
      setResult({
        part1Answers: data.part1Answers,
        part2Answers: data.part2Answers,
        factorScores: data.factorScores,
        axisScores: data.axisScores,
        confirmedAxis: data.confirmedAxis,
        subScores: data.subScores,
        modeScores: data.modeScores,
        confirmedMode: data.confirmedMode,
        typeCode: data.typeCode,
      });
      setSavedResultId(data.id);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const showSavedToast = () => {
    setToast("저장되었습니다!");
    setTimeout(() => setToast(""), 2200);
  };

  // 2026-09-28: "로그인/로그아웃이 어디 보이면 좋겠다"는 요청 — 화면 맨 하단에 현재 로그인
  // 상태에 맞는 링크 하나를 둡니다. 위의 result-복원 effect와는 별개로, result가 이미 있는
  // 상태(방금 테스트를 마친 경우 등)에서도 로그인 여부를 알아야 하므로 따로 확인합니다.
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setIsLoggedIn(!!user);
        setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2026-09-25: "로그인된 상태에서 결과 저장하기를 눌렀는데 왜 다시 로그인/가입 화면으로
  // 보내냐"는 피드백 — 이미 로그인돼 있으면 화면 이동 없이 그 자리에서 바로 저장하고
  // 토스트만 띄웁니다. 로그인이 안 돼 있을 때만 기존처럼 /signup으로 보냅니다.
  const handleSaveClick = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/signup");
      return;
    }
    if (savedResultId) {
      showSavedToast();
      return;
    }
    // 2026-09-27: "이미 저장된 결과가 있는데 다시 저장하면 기존 결과가 사라진다"는 걸 미리
    // 알려달라는 요청 — 저장을 실행하기 전에, 이 계정에 이미 저장된 결과가 있는지 먼저 확인해서
    // 있으면 확인 창을 띄웁니다(진짜 첫 저장이면 확인 없이 바로 저장).
    const existingRes = await fetch("/api/results");
    if (existingRes.status === 200) {
      setConfirmOverwrite(true);
      return;
    }
    await doSave();
  };

  const doSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          gender: userGender,
          part1Answers: result.part1Answers,
          part2Answers: result.part2Answers,
          confirmedAxis: result.confirmedAxis,
          confirmedMode: result.confirmedMode,
          typeCode: result.typeCode,
          axisScores: result.axisScores,
          factorScores: result.factorScores,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error("결과 저장 실패:", res.status, err);
        setToast(`저장에 실패했어요 (${res.status}${err?.reason ? ": " + JSON.stringify(err.reason) : ""}). 다시 시도해주세요.`);
        setTimeout(() => setToast(""), 6000);
        return;
      }
      const data = await res.json();
      if (data?.id) setSavedResultId(data.id);
      showSavedToast();
    } finally {
      setSaving(false);
    }
  };

  if (!result) return null;

  // 2026-09-29: 이스터에그 히든 결과 — 5개 영역이 전부 5.00점 또는 전부 1.00점이면 15유형
  // 체계를 벗어난 특별 결과를 보여줍니다. 심층 리포트가 필요 없는 유형이라 그 CTA와 "다른
  // 유형과의 관계" 섹션은 없고, 결과 저장·공유(생략)·다시 하기·로그인 상태 표시는 그대로 둡니다.
  const specialKey = detectSpecialResult(result.axisScores);
  if (specialKey) {
    const content = SPECIAL_RESULTS[specialKey];
    return (
      <div className="card">
        <Suspense fallback={null}>
          <SavedToastEffect onSaved={showSavedToast} />
        </Suspense>
        <div className="res-avatar">
          <Image src={content.image} alt={content.title} fill sizes="480px" priority style={{ objectFit: "contain" }} />
        </div>
        {content.tagBadge && (
          <p className="kicker kicker-sm" style={{ textAlign: "center" }}>
            {content.tagBadge}
          </p>
        )}
        <p className="type-reveal" style={{ textAlign: "center" }}>
          <span className="type-name-inline serif">{content.title}</span>
        </p>
        <p className="type-blurb" style={{ textAlign: "center", fontWeight: 600 }}>{content.subtitle}</p>

        {content.body.map((p, i) => (
          <p key={i} className="type-blurb">{p}</p>
        ))}

        <p className="traits-title">{content.listTitle}</p>
        <ul className="traits">
          {content.list.map((item, i) => (
            <li key={i}>
              <b>{item.label}:</b> {item.text}
            </li>
          ))}
        </ul>

        <div className="cta">
          <p className="cta-title">{content.calloutTitle}</p>
          <p>{content.callout}</p>
        </div>

        <p className="type-blurb" style={{ textAlign: "center", fontStyle: "italic", marginTop: 16 }}>
          &ldquo;{content.quote}&rdquo;
        </p>

        <div className="share-row">
          <button className="secondary" onClick={handleSaveClick} disabled={saving}>
            {saving ? "저장 중..." : "결과 저장하기"}
          </button>
        </div>
        {toast && <div className="toast">{toast}</div>}

        {confirmOverwrite && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <p className="confirm-msg">이미 저장된 결과가 있어요. 다시 저장할 경우 기존 결과는 사라집니다.</p>
              <div className="confirm-actions">
                <button className="secondary" onClick={() => setConfirmOverwrite(false)}>
                  취소
                </button>
                <button
                  onClick={() => {
                    setConfirmOverwrite(false);
                    doSave();
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          className="secondary restart"
          onClick={() => {
            reset();
            router.push("/");
          }}
        >
          다시 해보기
        </button>

        <div className="notice">{content.footnote ?? DISCLAIMER}</div>

        {authChecked && !isLoggedIn && (
          <button type="button" className="secondary" style={{ marginTop: 14 }} onClick={() => router.push("/login")}>
            로그인하고 저장하기
          </button>
        )}
      </div>
    );
  }

  const { confirmedAxis, typeCode, axisScores } = result;
  const dessert = DESSERT[typeCode];
  const family = DESSERT_FAMILY[confirmedAxis];
  const who = `${userName} ${title}님`;

  return (
    <div className="card">
      <Suspense fallback={null}>
        <SavedToastEffect onSaved={showSavedToast} />
      </Suspense>
      <div className="res-avatar">
        {dessert.hasArt ? (
          <Image src={`/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`} alt={dessert.name} fill sizes="480px" priority />
        ) : (
          <div
            style={{
              width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--sky-bg)", position: "relative",
            }}
          >
            <Image
              src={`/images/profiles/profile-${resolveIconKey(dessert.icon)}.jpg`}
              alt={dessert.name}
              fill
              sizes="480px"
              style={{ opacity: 0.55 }}
            />
            <span
              className="tiny"
              style={{ position: "absolute", bottom: 10, background: "var(--white)", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)" }}
            >
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
      {(() => {
        const strongest = AXIS_ORDER.reduce((a, b) => (axisScores[b] > axisScores[a] ? b : a));
        const weakest = AXIS_ORDER.reduce((a, b) => (axisScores[b] < axisScores[a] ? b : a));
        // 2026-09-25: "3.0점, 2.11점 이런 숫자 말고 설명 위주로" 피드백 — 점수 대신 그 영역이
        // 지금 어떤 상태인지를 말로 풀어서 전달합니다.
        if (strongest === weakest) {
          return (
            <p className="type-blurb" style={{ marginTop: -10 }}>
              다섯 영역이 비슷하게 채워져 있어요. 그중에서도 {AXIS_KR[weakest]} 영역에 요즘 조금 더 마음이 쓰이는 시기예요.
            </p>
          );
        }
        return (
          <p className="type-blurb" style={{ marginTop: -10 }}>
            {AXIS_KR[strongest]} 영역은 지금 가장 안정적으로 채워져 있어서, 큰 걱정 없이 잘 흘러가고 있어요.
            <br />
            {AXIS_KR[weakest]} 영역은 요즘 가장 마음이 쓰이는 곳이에요.
          </p>
        );
      })()}

      <p className="type-blurb">{dessert.why}</p>

      <p className="traits-title">당신은 이런 사람일거에요</p>
      <ul className="traits">
        <li>{TYPE_LINE1[confirmedAxis]}</li>
        <li>{TYPE_LINE2[typeCode]}</li>
        {TYPE_TRAITS[typeCode].map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>

      <p className="match-title">당신과 가장 잘 맞는 유형은 누구일까요?</p>
      <div className="match-row">
        {(() => {
          const preview = previewMatchTypes(typeCode);
          const cards: { key: string; label: string; type: TypeCode; cls: string }[] = [
            { key: "connected", label: "편안한 친구", type: preview.connectedSame, cls: "best" },
            { key: "independent", label: "아마도 정반대?", type: preview.independentDiff, cls: "worst" },
          ];
          return cards.map((c) => {
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
          });
        })()}
      </div>
      <button className="secondary" style={{ marginTop: -8, marginBottom: 20 }} onClick={() => router.push("/match")}>
        다른 유형과 나의 관계는 어떨까?!
      </button>

      {reportCtaCollapsed ? (
        // "다음에 심층 리포트 보기"를 누른 뒤에도 입구를 잃지 않도록, 큰 안내 박스만 접고 한 줄 버튼은 남깁니다.
        <button className="secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => router.push("/result/report")}>
          심층 리포트 보기
        </button>
      ) : (
        <div className="cta">
          <p className="cta-title">{who}의 이야기, 더 자세하게 알아봐요</p>
          <p>
            나는 왜 이렇게 생각할까? 남이 보는 내 모습은 어떨까? 커피 한 잔보다 저렴한 단 돈 {formatWon(REPORT_PRICE)}원으로{" "}
            {userName}님이 왜 {dessert.name}인지, 다른 유형 대비 두드러지는 강점은 무엇인지 알아보세요. 리포트와 함께 채팅할 수 있는
            쏘웰라 1주일 체험권도 제공됩니다.
          </p>
          <p style={{ fontSize: 13.5, opacity: 0.85 }}>
            당장 결정하실 필요 없어요! 결제하지 않아도 테스트 세부 결과인 1번 웰니스 프로파일은 무료로 열람하실 수 있어요.
          </p>
          <button onClick={() => router.push("/result/report")}>심층 리포트 보기</button>
          <button
            style={{ background: "transparent", color: "var(--white)", border: "1px solid rgba(255,255,255,0.55)" }}
            onClick={() => setReportCtaCollapsed(true)}
          >
            다음에 심층 리포트 보기
          </button>
        </div>
      )}

      <div className="share-row">
        {/* 2026-10-06: 눈에 잘 안 띈다는 피드백 — 카카오톡 노란색 + 말풍선 아이콘으로 강조(라벨은 그대로, 공유 창은 여러 곳으로 공유됨). */}
        <button className="kakao-share" onClick={() => setSheetOpen(true)}>
          <KakaoBubbleIcon width={18} height={18} />
          내 결과 공유하기
        </button>
        <button className="secondary" onClick={handleSaveClick} disabled={saving}>
          {saving ? "저장 중..." : "결과 저장하기"}
        </button>
      </div>
      <button className="secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => router.push("/history")}>
        지난 테스트 결과 열람하기
      </button>
      {toast && <div className="toast">{toast}</div>}

      {confirmOverwrite && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <p className="confirm-msg">이미 저장된 결과가 있어요. 다시 저장할 경우 기존 결과는 사라집니다.</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setConfirmOverwrite(false)}>
                취소
              </button>
              <button
                onClick={() => {
                  setConfirmOverwrite(false);
                  doSave();
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="secondary restart"
        onClick={() => {
          reset();
          router.push("/");
        }}
      >
        다시 해보기
      </button>

      <div className="notice">{DISCLAIMER}</div>

      {authChecked && !isLoggedIn && (
        <button type="button" className="secondary" style={{ marginTop: 14 }} onClick={() => router.push("/login")}>
          로그인하고 저장하기
        </button>
      )}

      {sheetOpen && <ShareSheet typeCode={typeCode} onClose={() => setSheetOpen(false)} onToast={setToast} />}
    </div>
  );
}
