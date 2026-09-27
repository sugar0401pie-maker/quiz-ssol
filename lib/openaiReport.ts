import "server-only";
import OpenAI from "openai";
import { splitIntoParagraphs } from "./paragraphSplit";
import { buildSystemPrompt, buildUserPrompt, type ReportPromptInput } from "./reportPrompt";

// 2026-09-25: 심층 리포트 2~7번 섹션을 OpenAI API로 생성합니다. 1번(오각형 상세)은 여전히
// 결정론적 조립(lib/reportAssembly.ts)이라 이 파일과 무관하게 무료로 즉시 제공됩니다.
// v3deep-report-prompt-and-example.md 6장 체크리스트를 반영: 결제 확인 후에만 호출하고,
// 같은 주문에는 재호출하지 않으며(app/api/report/generate/route.ts에서 캐시), 분량이 크게
// 벗어나면 재시도합니다.

export interface GeneratedSections {
  section2: string[];
  section3: string[];
  section4: string[];
  section5: string[];
  section6: string[];
  section7: string[];
}

const SECTION_HEADERS: Record<string, keyof GeneratedSections> = {
  "2": "section2",
  "3": "section3",
  "4": "section4",
  "5": "section5",
  "6": "section6",
  "7": "section7",
};

function parseSections(markdown: string): GeneratedSections {
  const result: GeneratedSections = { section2: [], section3: [], section4: [], section5: [], section6: [], section7: [] };
  const matches = [...markdown.matchAll(/### (\d)\.[^\n]*\n\n([\s\S]*?)(?=\n### \d\.|\s*$)/g)];
  for (const m of matches) {
    const key = SECTION_HEADERS[m[1]];
    if (!key) continue;
    const body = m[2].trim();
    if (!body || body === "*(해당 없음)*") continue;
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    result[key] = splitIntoParagraphs(paragraphs, 4);
  }
  return result;
}

function totalChars(sections: GeneratedSections): number {
  return Object.values(sections)
    .flat()
    .join("")
    .replace(/\s/g, "").length;
}

/** 결제 확인 후 호출하세요. API 키가 없으면 예외를 던집니다 — 호출부에서 템플릿 그대로 쓰는
 *  폴백으로 처리하세요(비용 없음, AI 미조정 상태로라도 리포트는 항상 나가야 합니다). */
export async function generateWithOpenAI(input: ReportPromptInput): Promise<GeneratedSections> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const model = process.env.OPENAI_REPORT_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const system = buildSystemPrompt();
  const user = buildUserPrompt(input);

  let lastSections: GeneratedSections | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    });
    const text = res.choices[0]?.message?.content ?? "";
    const sections = parseSections(text);
    lastSections = sections;
    // 2,000~3,000자 목표(공백 제외) — 너무 짧으면 한 번 더 시도합니다(v3 문서 6장 체크리스트).
    const chars = totalChars(sections);
    if (chars >= 1200) return sections;
  }
  return lastSections!;
}
