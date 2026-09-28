import "server-only";
import OpenAI from "openai";
import { splitIntoParagraphs } from "../paragraphSplit";
import { buildSystemPrompt, buildUserPrompt, type ReportV3Input } from "./prompt";

// 2026-09-28: v3 리포트 — 섹션 2~8을 OpenAI가 생성합니다. 1번(웰니스 프로파일)은
// lib/reportV3/domainProfile.ts가 결정론적으로 조립해 별도로 무료 제공됩니다.

export interface GeneratedSectionsV3 {
  section2: string[];
  section3: string[];
  section4: string[];
  section5: string[];
  section6: string[];
  section7: string[];
  section8: string[];
}

const SECTION_HEADERS: Record<string, keyof GeneratedSectionsV3> = {
  "2": "section2",
  "3": "section3",
  "4": "section4",
  "5": "section5",
  "6": "section6",
  "7": "section7",
  "8": "section8",
};

function parseSections(markdown: string): GeneratedSectionsV3 {
  const result: GeneratedSectionsV3 = { section2: [], section3: [], section4: [], section5: [], section6: [], section7: [], section8: [] };
  const matches = [...markdown.matchAll(/### (\d)\.[^\n]*\n\n([\s\S]*?)(?=\n### \d\.|\s*$)/g)];
  for (const m of matches) {
    const key = SECTION_HEADERS[m[1]];
    if (!key) continue;
    const body = m[2].trim();
    if (!body) continue;
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    result[key] = splitIntoParagraphs(paragraphs, 5);
  }
  return result;
}

function totalChars(sections: GeneratedSectionsV3): number {
  return Object.values(sections)
    .flat()
    .join("")
    .replace(/\s/g, "").length;
}

/** 결제 확인 후 호출하세요. API 키가 없으면 예외를 던집니다 — 호출부에서 처리하세요. */
export async function generateReportV3(input: ReportV3Input): Promise<GeneratedSectionsV3> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const model = process.env.OPENAI_REPORT_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const system = buildSystemPrompt();
  const user = buildUserPrompt(input);

  let lastSections: GeneratedSectionsV3 | null = null;
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
    // 3,000~4,400자 목표(공백 제외) — 너무 짧으면 한 번 더 시도합니다.
    const chars = totalChars(sections);
    if (chars >= 1800) return sections;
  }
  return lastSections!;
}
