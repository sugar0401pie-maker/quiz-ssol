"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// 2026-10-15: 웹툰처럼 옆으로 넘기는 결과 화면(쏠 아스트로 하우스의 7장 구조를 퀴즈 결과에 적용).
// - 장마다 가로로 스냅되는 칸(손가락 스와이프) + 위쪽 진행 막대(칸을 누르면 이동) + 아래 [이전][다음] 버튼
// - 세로 스크롤은 페이지 스크롤을 그대로 씁니다: 칸 높이를 "지금 보는 장"에 맞춰 잘라서, 짧은 장 아래에
//   긴 장 높이만큼 빈 공간이 생기지 않게 합니다. 장을 바꾸면 위로 올려줍니다.
export interface PagerSlide {
  key: string;
  /** 진행 막대 접근성 라벨·다음 버튼 문구에 쓰는 짧은 제목 */
  label: string;
  node: ReactNode;
  /** 이 장 아래(이전/다음 버튼 위)에 붙는 것 — 공유·저장 버튼 등 */
  bottom?: ReactNode;
}

interface Props {
  slides: PagerSlide[];
  initialIndex?: number;
  /** 스와이프·버튼이 끝나 장이 "정해졌을 때" 한 번 불립니다(움직이는 중간 장마다 부르지 않음). */
  onIndexChange?: (index: number) => void;
  /** 주소(뒤로가기 등)가 가리키는 장. 객체가 새로 들어올 때마다, 지금 정해진 장과 다르면 그 장으로 넘깁니다. */
  target?: { index: number };
}

export default function ResultPager({ slides, initialIndex = 0, onIndexChange, target }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const topRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(Math.min(initialIndex, slides.length - 1));
  const [height, setHeight] = useState<number | undefined>(undefined);
  const indexRef = useRef(index);
  indexRef.current = index;
  const settledRef = useRef(Math.min(initialIndex, slides.length - 1)); // 스크롤이 멈춰 확정된 장
  const total = slides.length;

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const track = trackRef.current;
      if (!track) return;
      const next = Math.max(0, Math.min(total - 1, i));
      track.scrollTo({ left: next * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
    },
    [total]
  );

  // 처음 열 때 기억해 둔 장으로 바로 이동(애니메이션 없이).
  useLayoutEffect(() => {
    if (initialIndex > 0) goTo(Math.min(initialIndex, total - 1), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 손가락·버튼으로 가로 스크롤이 움직이면 지금 장 번호(진행 막대)를 바로 갱신하고, 멈추면(약 0.15초 뒤) 한 번만 알립니다.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== indexRef.current) setIndex(i);
      });
      clearTimeout(settle);
      settle = setTimeout(() => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== settledRef.current) {
          settledRef.current = i;
          onIndexChange?.(i);
        }
      }, 150);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [onIndexChange]);

  // 주소가 가리키는 장이 지금과 다르면(뒤로가기 등) 그 장으로.
  useEffect(() => {
    if (!target || target.index < 0 || target.index >= total) return;
    if (target.index !== settledRef.current) goTo(target.index);
  }, [target, total, goTo]);

  // 화면 폭이 바뀌면(회전 등) 지금 장에 다시 맞춥니다.
  useEffect(() => {
    const onResize = () => goTo(indexRef.current, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [goTo]);

  // 칸 높이 = 지금 보는 장의 높이(내용이 늘어나도 따라가도록 관찰).
  useEffect(() => {
    const el = slideRefs.current[index];
    if (!el) return;
    setHeight(el.scrollHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeight(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, slides]);

  // 장이 바뀌면 그 장의 맨 위부터 보이게.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const top = topRef.current;
    if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - 8), behavior: "smooth" });
  }, [index]);

  // 키보드 좌우 화살표(데스크톱).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") goTo(indexRef.current + 1);
      if (e.key === "ArrowLeft") goTo(indexRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  return (
    <div className="pager" ref={topRef}>
      <div className="pager-progress" role="tablist" aria-label="결과 페이지">
        <div className="pager-progress-bar">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}번째: ${s.label}`}
              className={`pager-seg${i <= index ? " on" : ""}${i === index ? " cur" : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <p className="pager-count">
          {index + 1}/{total} · {slides[index]?.label}
        </p>
      </div>

      <div className="pager-track" ref={trackRef} style={height ? { height } : undefined}>
        {slides.map((s, i) => (
          <section
            key={s.key}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="pager-slide"
            aria-hidden={i !== index}
            aria-label={s.label}
          >
            <div className="pager-slide-body">{s.node}</div>
            {s.bottom && <div className="pager-slide-bottom">{s.bottom}</div>}
            <div className="pager-nav">
              {i > 0 ? (
                <button type="button" className="secondary" onClick={() => goTo(i - 1)}>
                  ‹ 이전
                </button>
              ) : (
                <span />
              )}
              {i < total - 1 ? (
                <button type="button" className="pager-next" onClick={() => goTo(i + 1)}>
                  다음: {slides[i + 1].label} ›
                </button>
              ) : (
                <span />
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
