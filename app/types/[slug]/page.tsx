import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CrossLinks from "@/components/CrossLinks";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { TYPE_POSTS, type DessertTypePost } from "../typesData";

// 2026-11-05: 디저트 유형별 소개 글 — 검색 노출용 공개 페이지. 원고(네이버 블로그용)의 글·사진을 옮겼고, 서버에서 만든 정적 HTML로 나갑니다(로그인·로딩 화면 없음).
// 사진은 /public/images/types/{slug}-{1..5}.jpg, 원문은 ../typesData.ts.
export const dynamicParams = false;

export function generateStaticParams() {
  return TYPE_POSTS.map((p) => ({ slug: p.slug }));
}

const UPDATED = "2026-11-05";
const AREA_SLUG: Record<string, string> = { 진로: "career", 연애: "romance", 관계: "relationships", 자기: "self", 인생: "life" };
const find = (slug: string): DessertTypePost | undefined => TYPE_POSTS.find((p) => p.slug === slug);
const imgSrc = (p: DessertTypePost, n: number) => `/images/types/${p.slug}-${n}.jpg`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> | { slug: string } }): Promise<Metadata> {
  const { slug } = await params;
  const p = find(slug);
  if (!p) return {};
  const url = `/types/${p.slug}`;
  return {
    title: { absolute: p.title }, // 제목이 이미 길어서 사이트 이름 꼬리표를 붙이지 않습니다
    description: p.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url,
      title: p.title,
      description: p.description,
      siteName: SITE_NAME,
      locale: "ko_KR",
      images: [{ url: imgSrc(p, 1), width: 720, height: 720, alt: p.alts[0] }],
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [imgSrc(p, 1)] },
  };
}

export default async function TypePostPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = await params;
  const p = find(slug);
  if (!p) notFound();
  const idx = TYPE_POSTS.findIndex((x) => x.slug === p.slug);
  const prev = TYPE_POSTS[(idx + TYPE_POSTS.length - 1) % TYPE_POSTS.length];
  const next = TYPE_POSTS[(idx + 1) % TYPE_POSTS.length];
  const sameArea = TYPE_POSTS.filter((x) => x.area === p.area);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE_URL}/types/${p.slug}#article`,
        mainEntityOfPage: `${SITE_URL}/types/${p.slug}`,
        headline: p.title,
        description: p.description,
        image: `${SITE_URL}${imgSrc(p, 1)}`,
        inLanguage: "ko-KR",
        datePublished: UPDATED,
        dateModified: UPDATED,
        author: { "@id": "https://www.ssolwellnesshouse.com/#org" },
        publisher: { "@id": "https://www.ssolwellnesshouse.com/#org" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "디저트 웰니스 테스트", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "15가지 유형", item: `${SITE_URL}/types` },
          { "@type": "ListItem", position: 3, name: `${p.name} 유형`, item: `${SITE_URL}/types/${p.slug}` },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <main className="card about types">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <nav className="types-crumb" aria-label="현재 위치">
        <a href="/">디저트 웰니스 테스트</a> › <a href="/types">15가지 유형</a> › <span>{p.name}</span>
      </nav>
      <h1>{p.name} 유형 특징</h1>
      <p className="types-sub">
        {p.area} 영역 × {p.mode} · {p.headline}
      </p>

      {p.blocks.map((b, i) => {
        switch (b.t) {
          case "h3":
            return <h2 key={i} dangerouslySetInnerHTML={{ __html: b.html }} />;
          case "p":
            return <p key={i} dangerouslySetInnerHTML={{ __html: b.html }} />;
          case "note":
            return <p key={i} className="about-notice" dangerouslySetInnerHTML={{ __html: b.html }} />;
          case "img":
            return (
              // eslint-disable-next-line @next/next/no-img-element -- 미리 줄여 둔 정적 사진(크기 지정). 첫 장만 즉시, 나머지는 스크롤할 때 불러옵니다.
              <img
                key={i}
                className="types-img"
                src={imgSrc(p, b.n)}
                alt={p.alts[b.n - 1] ?? `${p.name} 유형 이미지`}
                width={720}
                height={720}
                loading={b.n === 1 ? "eager" : "lazy"}
                decoding="async"
              />
            );
          case "cta":
            return (
              <a key={i} className="link-btn-lg" href="/">
                나의 디저트 찾기 · 테스트 보러 가기
              </a>
            );
        }
      })}

      <nav className="types-more" aria-label="다른 유형 보기">
        <h2>
          <a href={`/types/area/${AREA_SLUG[p.area]}`}>{p.area} 영역</a>의 다른 유형
        </h2>
        <ul>
          {sameArea
            .filter((x) => x.slug !== p.slug)
            .map((x) => (
              <li key={x.slug}>
                <a href={`/types/${x.slug}`}>
                  {x.name} <small>{x.mode}</small>
                </a>
              </li>
            ))}
        </ul>
        <div className="types-pn">
          <a href={`/types/${prev.slug}`}>← {prev.name}</a>
          <a href="/types">15가지 유형 전체</a>
          <a href={`/types/${next.slug}`}>{next.name} →</a>
        </div>
      </nav>
      <CrossLinks from="type" />
    </main>
  );
}
