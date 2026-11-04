import type { Metadata } from "next";
import { PARTICIPANT_COUNT_TEXT } from "@/lib/participants";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { FAQ_GROUPS } from "./faq";

// 2026-11-04: 디저트 웰니스 유형 테스트 상세 소개 — 검색 노출용 공개 페이지. 로그인·로딩 화면 없이 서버에서 만든 정적 HTML로 나가고,
// 접힌 FAQ의 답변 글도 원본 HTML에 그대로 들어 있습니다. 내용은 앱의 실제 동작과 맞춰 썼습니다(문항 수·유형 수·무료/유료 범위는 lib/data.ts 기준).
const TITLE = "디저트 웰니스 유형 테스트 — 33문항으로 알아보는 나의 고민 영역과 대처 방식 | 쏠 웰니스 하우스";
const DESCRIPTION =
  "상담심리 전문가가 설계한 33문항 웰니스 테스트. 커리어·연애·대인관계·나 자신·삶의 방향 중 지금 가장 고민이 깊은 영역과 대처 방식을 17가지 디저트 캐릭터로 알려줘요. 약 5분, 가입 없이 시작. 진단·치료를 대신하지 않아요.";
const ABOUT_URL = `${SITE_URL}/about`;
const UPDATED = "2026-11-04";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: "/about", title: TITLE, description: DESCRIPTION, siteName: SITE_NAME, locale: "ko_KR" },
};

const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${ABOUT_URL}#page`,
      url: ABOUT_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "ko-KR",
      datePublished: UPDATED,
      dateModified: UPDATED,
      about: { "@id": `${ABOUT_URL}#app` },
      publisher: { "@id": "https://www.ssolwellnesshouse.com/#org" },
    },
    {
      "@type": "WebApplication",
      "@id": `${ABOUT_URL}#app`,
      name: "디저트 웰니스 유형 테스트",
      description: DESCRIPTION,
      url: `${SITE_URL}/`,
      mainEntityOfPage: ABOUT_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "ko-KR",
      isAccessibleForFree: true,
      publisher: { "@id": "https://www.ssolwellnesshouse.com/#org" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_GROUPS.flatMap((g) => g.items).map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    },
  ],
}).replace(/</g, "\\u003c");

function Cta() {
  return (
    <a className="link-btn-lg" href="/">
      테스트 보러 가기
    </a>
  );
}

export default function AboutPage() {
  return (
    <main className="card about">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <h1>디저트 웰니스 유형 테스트 — 티파티에 초대받은 나는 어떤 디저트일까?</h1>
      <p>
        33문항에 답하면 지금 가장 고민이 깊은 영역과 그 고민을 다루는 나만의 방식이 17가지 디저트 캐릭터 중 하나로 나와요. 상담심리 전문가가 상담
        이론을 조합해 문항·유형·해석을 직접 설계하고 검토했어요. 가볍게 시작해도 결과는 나를 이해하는 단서가 돼요.
      </p>
      <p className="about-count">지금까지 {PARTICIPANT_COUNT_TEXT}명이 참여했어요</p>
      <Cta />

      <h2>한눈에 보기</h2>
      <div className="about-table">
        <table>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">내용</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">문항 수</th><td>33문항 — 1부 영역 검사 21문항 + 2부 대처 방식 12문항</td></tr>
            <tr><th scope="row">소요 시간</th><td>약 5분</td></tr>
            <tr><th scope="row">결과</th><td>5가지 영역 × 3가지 대처 방식 = 15유형 + 시크릿 유형 2가지, 총 17유형</td></tr>
            <tr><th scope="row">캐릭터</th><td>디저트 왕국 17종</td></tr>
            <tr><th scope="row">영역</th><td>진로(커리어) · 연애 · 관계(대인관계) · 자기(나 자신) · 인생(삶의 방향)</td></tr>
            <tr><th scope="row">대처 방식</th><td>용기형(직접 바꾸기) · 평온형(다르게 보기) · 유보형(거리두기)</td></tr>
            <tr><th scope="row">무료</th><td>내 디저트 유형과 기본 설명, 영역별 점수 그래프, ‘이런 사람’ 설명, 궁합 카드, 웰니스 프로파일(심층 보고서 1번)</td></tr>
            <tr><th scope="row">유료</th><td>심층 보고서의 나머지 섹션(유형인 이유, 다른 사람과의 비교, 더 나아질 수 있는 방법 등) 3,500원 + 쏘웰라 7일 이용권 포함</td></tr>
            <tr><th scope="row">하지 않는 일</th><td>진단, 치료, 임상 심리검사를 대신하는 일</td></tr>
          </tbody>
        </table>
      </div>

      <h2>이용 순서</h2>
      <ol className="about-steps">
        <li><b>시작</b> 테스트를 시작해요. 가입 없이 시작할 수 있어요.</li>
        <li><b>33문항</b> 1부에서 다섯 영역 각각의 상태를, 2부에서 고민을 다루는 방식을 답해요.</li>
        <li><b>동점 확인</b> 점수가 같거나 테스트가 짚은 영역이 내 느낌과 다르면, 내가 직접 확인하고 고를 수 있어요.</li>
        <li><b>내 유형과 5영역 결과</b> 디저트 캐릭터와 영역별 점수를 보여줘요.</li>
        <li><b>(선택) 심층 보고서</b> 더 알고 싶으면 보고서를 열고, 쏘웰라 이용권을 함께 받아요.</li>
      </ol>

      <h2>결과는 이렇게 보여요</h2>
      <ul className="about-list">
        <li><b>내 유형과 ‘이런 사람’</b> 디저트 캐릭터, 영역별 점수 그래프, 내가 어떤 사람인지를 보여줘요.</li>
        <li><b>궁합 카드</b> 나와 결이 비슷해서 편안한 친구 같은 유형과, 아마도 정반대일 수 있는 유형을 카드로 보여줘요.</li>
        <li><b>웰니스 프로파일</b> 심층 보고서의 첫 번째 섹션으로, 나의 현재 상태를 무료로 보여줘요.</li>
        <li><b>블러 처리된 심층 보고서 미리보기</b> 나머지 섹션은 흐리게 보이고, 결제하면 열려요.</li>
        <li><b>8섹션 심층 보고서(유료)</b> 내가 왜 이 유형인지, 다른 사람과 비교해 두드러지는 점(하위 요인 10개 비교), 더 나아질 수 있는 방법을 알려줘요.</li>
      </ul>

      <h2>이 테스트가 아닌 것</h2>
      <p>
        임상 심리검사나 진단 도구가 아니에요. 우울·불안 같은 증상의 유무를 판단할 수 없고, 결과는 지금 시점의 경향이에요. 마음이 많이 힘들다면
        결과보다 먼저 전문기관을 찾아 주세요. 지금 위험하다면 자살예방 상담전화 109(24시간), 정신건강 위기상담전화 1577-0199, 응급 상황은
        112·119에 연락해 주세요.
      </p>

      <h2>만든 사람</h2>
      <p>
        상담심리사 2급·청소년상담사 2급 자격을 가진 김준석 대표, 산업심리상담사 1급 자격을 가진 곽혜진 이사, 정신건강임상심리사 1급 오세민·통합예술심리지도사
        1급 오유주 전문위원이 문항과 해석을 설계하고 검토했어요. 분야별 전문 인원이 라운드테이블로 모여 테스트와 해석을 함께 검수해요.
      </p>

      <h2>자주 묻는 질문</h2>
      {FAQ_GROUPS.map((g) => (
        <section key={g.title} className="about-faq">
          <h3>{g.title}</h3>
          {g.items.map((it) => (
            <details key={it.q}>
              <summary>{it.q}</summary>
              <p>{it.a}</p>
            </details>
          ))}
        </section>
      ))}

      <h2>쏘웰라로 이어가기</h2>
      <p>
        테스트가 끝나면 결과를 바탕으로 AI 웰니스 상담 쏘웰라와 이야기를 이어갈 수 있어요. 가입하면 3일 무료로 써볼 수 있고, 심층 보고서를
        결제하면 7일 이용권을 함께 받아요. 쏘웰라는 테스트 결과와 처음 알려준 이야기를 반영해서 첫 인사를 건네요.{" "}
        <a href="https://www.ssolwellnesshouse.com/about.html">쏘웰라 자세히 보기</a>
      </p>

      <Cta />
      <p className="about-notice">쏠 웰니스 하우스의 서비스는 의학적 진단·치료·처방을 제공하지 않으며, 전문 의료·상담을 대신하지 않습니다.</p>
    </main>
  );
}
