import type { Metadata } from "next";
import Image from "next/image";
import CrossLinks from "@/components/CrossLinks";
import { DESSERT, DESSERT_FAMILY, type AxisKey, type TypeCode } from "@/lib/data";
import { resolveIconKey } from "@/lib/icons";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { TYPE_POSTS } from "./typesData";

// 2026-11-05: 디저트 15유형 소개 목록 — 검색 노출용 공개 페이지(로그인 없이 서버에서 만든 정적 HTML). 유형별 글은 /types/[slug].
const TITLE = "디저트 웰니스 테스트 15가지 유형 한눈에 보기 | 쏠 웰니스 하우스";
const DESCRIPTION =
  "진로·연애·관계·자기·인생 다섯 영역 × 용기형·평온형·유보형 세 가지 대처 방식으로 나오는 디저트 15유형을 소개해요. 에스프레소 브라우니, 티라미수, 마들렌까지 내 유형을 찾아보세요.";
const UPDATED = "2026-11-05";
const AREAS: { axis: AxisKey; label: string }[] = [
  { axis: "CAR", label: "진로" },
  { axis: "LOV", label: "연애" },
  { axis: "REL", label: "관계" },
  { axis: "SLF", label: "자기" },
  { axis: "DIR", label: "인생" },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/types" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: "/types", title: TITLE, description: DESCRIPTION, siteName: SITE_NAME, locale: "ko_KR" },
};

const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/types#page`,
      url: `${SITE_URL}/types`,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "ko-KR",
      datePublished: UPDATED,
      dateModified: UPDATED,
      publisher: { "@id": "https://www.ssolwellnesshouse.com/#org" },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: TYPE_POSTS.length,
        itemListElement: TYPE_POSTS.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/types/${p.slug}`,
          name: `${p.name} 유형`,
        })),
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "디저트 웰니스 테스트", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "15가지 유형", item: `${SITE_URL}/types` },
      ],
    },
  ],
}).replace(/</g, "\\u003c");

export default function TypesIndexPage() {
  return (
    <main className="card about types">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <h1>디저트 웰니스 테스트 15가지 유형 한눈에 보기</h1>
      <p>
        상담심리 전문가가 설계한 33문항 테스트로, 지금 가장 고민이 깊은 영역(진로·연애·관계·자기·인생)과 그 고민을 다루는 나의 대처 방식(용기형·평온형·유보형)을
        함께 살펴봐요. 5개 영역 × 3가지 대처 방식으로 15가지 기본 유형이 나오고, 결과는 디저트 왕국의 캐릭터로 만나요. 마음에 드는 유형을 눌러 자세한 특징을 읽어 보세요.
      </p>
      <a className="link-btn-lg" href="/">
        테스트 보러 가기
      </a>

      {AREAS.map(({ axis, label }, ai) => {
        const posts = TYPE_POSTS.slice(ai * 3, ai * 3 + 3);
        const family = DESSERT_FAMILY[axis];
        return (
          <section key={axis} className="types-area">
            <h2>
              {label} 영역 · {family.name}
            </h2>
            <p>{family.desc}</p>
            <ul className="types-grid">
              {posts.map((p) => {
                const d = DESSERT[p.code as TypeCode];
                return (
                  <li key={p.slug}>
                    <a href={`/types/${p.slug}`}>
                      <Image
                        src={`/images/profiles/profile-${resolveIconKey(d.icon)}.jpg`}
                        alt={`${p.name} 캐릭터`}
                        width={300}
                        height={300}
                        sizes="(max-width: 480px) 30vw, 150px"
                      />
                      <strong>{p.name}</strong>
                      <span>{p.mode}</span>
                      <small>{p.headline}</small>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <a className="link-btn-lg" href="/">
        테스트 보러 가기
      </a>
      <CrossLinks from="types" />
      <p className="about-notice">
        이 테스트는 임상 심리검사나 진단 도구가 아니에요. 지금 시점의 경향을 보여 주고, 결과는 나를 이해하는 단서로 봐 주세요. 쏠 웰니스 하우스의 서비스는 의학적
        진단·치료·처방을 제공하지 않으며, 전문 의료·상담을 대신하지 않습니다.
      </p>
    </main>
  );
}
