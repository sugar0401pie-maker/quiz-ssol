import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import CrossLinks from "@/components/CrossLinks";
import { DESSERT, DESSERT_FAMILY, type AxisKey, type TypeCode } from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { TYPE_POSTS } from "../../typesData";

// 2026-11-05: 영역별(진로·연애·관계·자기·인생) 유형 모음 — 검색 노출용 공개 페이지. 영역마다 디저트 유형 3개를 한곳에 묶어 소개하고 유형별 글(/types/[slug])로 연결합니다.
export const dynamicParams = false;

const AREAS: { slug: string; label: string; axis: AxisKey; alt: string }[] = [
  { slug: "career", label: "진로", axis: "CAR", alt: "커리어" },
  { slug: "romance", label: "연애", axis: "LOV", alt: "연애" },
  { slug: "relationships", label: "관계", axis: "REL", alt: "대인관계" },
  { slug: "self", label: "자기", axis: "SLF", alt: "나 자신" },
  { slug: "life", label: "인생", axis: "DIR", alt: "삶의 방향" },
];
const MODES = [
  { name: "용기형", plain: "직접 바꾸기", desc: "상황 자체를 바꾸려고 먼저 움직이는 방식" },
  { name: "평온형", plain: "다르게 보기", desc: "생각과 의미를 바꿔 받아들이며 마음을 조절하는 방식" },
  { name: "유보형", plain: "거리두기", desc: "한 발 물러나 거리를 두고 숨을 고르는 방식" },
];
const UPDATED = "2026-11-05";

export function generateStaticParams() {
  return AREAS.map((a) => ({ area: a.slug }));
}

type P = { params: Promise<{ area: string }> | { area: string } };
const find = (slug: string) => AREAS.find((a) => a.slug === slug);
const postsOf = (label: string) => TYPE_POSTS.filter((p) => p.area === label);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { area } = await params;
  const a = find(area);
  if (!a) return {};
  const posts = postsOf(a.label);
  const family = DESSERT_FAMILY[a.axis];
  const title = `${a.label} 영역 디저트 유형 3가지 — ${posts.map((p) => p.name).join("·")} | ${SITE_NAME}`;
  const description = `${a.label}(${a.alt}) 영역의 디저트 유형 3가지(${posts.map((p) => p.name).join(", ")})를 한눈에 비교해요. ${family.name}, 용기형·평온형·유보형 대처 방식의 차이를 알아보세요.`;
  const url = `/types/area/${a.slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: "website", url, title, description, siteName: SITE_NAME, locale: "ko_KR" },
  };
}

export default async function AreaPage({ params }: P) {
  const { area } = await params;
  const a = find(area);
  if (!a) notFound();
  const posts = postsOf(a.label);
  const family = DESSERT_FAMILY[a.axis];
  const url = `${SITE_URL}/types/area/${a.slug}`;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `${a.label} 영역 디저트 유형 3가지`,
        inLanguage: "ko-KR",
        datePublished: UPDATED,
        dateModified: UPDATED,
        publisher: { "@id": "https://www.ssolwellnesshouse.com/#org" },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: posts.length,
          itemListElement: posts.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/types/${p.slug}`, name: `${p.name} 유형` })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "디저트 웰니스 테스트", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "15가지 유형", item: `${SITE_URL}/types` },
          { "@type": "ListItem", position: 3, name: `${a.label} 영역`, item: url },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <main className="card about types">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <nav className="types-crumb" aria-label="현재 위치">
        <a href="/">디저트 웰니스 테스트</a> › <a href="/types">15가지 유형</a> › <span>{a.label} 영역</span>
      </nav>
      <h1>{a.label} 영역 디저트 유형 3가지</h1>
      <p className="types-sub">{family.name}</p>
      <p>
        {family.desc} 이 영역에서 고민을 다루는 방식(용기형·평온형·유보형)에 따라 {posts.map((p) => p.name).join(", ")} 세 가지 디저트 유형으로 나뉘어요.
      </p>
      <a className="link-btn-lg" href="/">
        테스트 보러 가기
      </a>

      <h2>{a.label} 영역 유형 한눈에 비교</h2>
      <div className="about-table">
        <table>
          <thead>
            <tr>
              <th scope="col">유형</th>
              <th scope="col">대처 방식</th>
              <th scope="col">이런 사람</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.slug}>
                <th scope="row">
                  <a href={`/types/${p.slug}`}>{p.name}</a>
                </th>
                <td>{p.mode}</td>
                <td>{p.headline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="types-grid">
        {posts.map((p) => {
          const d = DESSERT[p.code as TypeCode];
          return (
            <li key={p.slug}>
              <a href={`/types/${p.slug}`}>
                <Image src={`/images/profiles/profile-${resolveIconKey(d.icon)}.jpg`} alt={`${p.name} 캐릭터`} width={300} height={300} sizes="(max-width: 480px) 30vw, 150px" />
                <strong>{p.name}</strong>
                <span>{p.mode}</span>
                <small>자세히 보기</small>
              </a>
            </li>
          );
        })}
      </ul>

      <h2>대처 방식 세 가지</h2>
      <ul className="about-list">
        {MODES.map((m) => (
          <li key={m.name}>
            <b>
              {m.name}({m.plain})
            </b>{" "}
            {m.desc}
          </li>
        ))}
      </ul>

      <h2>다른 영역도 살펴보기</h2>
      <ul className="about-list">
        {AREAS.filter((x) => x.slug !== a.slug).map((x) => (
          <li key={x.slug}>
            <a href={`/types/area/${x.slug}`}>{x.label} 영역 유형</a>
          </li>
        ))}
        <li>
          <a href="/types">15가지 유형 전체 보기</a>
        </li>
      </ul>

      <a className="link-btn-lg" href="/">
        테스트 보러 가기
      </a>
      <CrossLinks from="types" />
      <p className="about-notice">
        이 테스트는 임상 심리검사나 진단 도구가 아니에요. 쏠 웰니스 하우스의 서비스는 의학적 진단·치료·처방을 제공하지 않으며, 전문 의료·상담을 대신하지 않습니다.
      </p>
    </main>
  );
}
