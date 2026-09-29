import "server-only";
import OpenAI from "openai";
import { splitIntoParagraphs } from "../paragraphSplit";
import { buildSystemPrompt, buildUserPrompt, type PromptSections, type ReportV3Input } from "./prompt";
import type { GeneratedSectionsV3 } from "./types";

// 2026-09-28: v6 프롬프트 반영 — 이제 섹션 1(웰니스 프로파일)도 OpenAI가 직접 씁니다.
// (이전엔 lib/reportV3/domainProfile.ts가 결정론적으로 조립해 결제 없이 무료로 먼저
// 보여줬지만, v6는 1~8번 전부를 하나의 통합 리포트로 취급합니다 — 더 이상 무료 미리보기 없음.)

export type { GeneratedSectionsV3 };

const SECTION_HEADERS: Record<string, keyof GeneratedSectionsV3> = {
  "1": "section1",
  "2": "section2",
  "3": "section3",
  "4": "section4",
  "5": "section5",
  "6": "section6",
  "7": "section7",
  "8": "section8",
};

function parseSections(markdown: string): GeneratedSectionsV3 {
  const result: GeneratedSectionsV3 = { section1: [], section2: [], section3: [], section4: [], section5: [], section6: [], section7: [], section8: [] };
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

// 2026-09-28: 최소 글자수 기준 — 모드별로 목표 분량이 다릅니다(전체 1~8번 vs 섹션 1만).
const MIN_CHARS: Record<PromptSections, number> = { all: 3500, "1": 700, "2-8": 3000 };

async function callModel(input: ReportV3Input, sections: PromptSections, cachedSection1?: string[]): Promise<GeneratedSectionsV3> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  // 2026-09-28: gpt-6-sol(reasoning 모델, medium 추론 기본)로 전환 — run_sol_test.py 기준.
  // reasoning 모델은 chat.completions가 아니라 responses.create + reasoning.effort로 호출합니다.
  const model = process.env.OPENAI_REPORT_MODEL || "gpt-6-sol";
  const effort = (process.env.OPENAI_REPORT_EFFORT || "medium") as "low" | "medium" | "high";
  const client = new OpenAI({ apiKey });

  const system = buildSystemPrompt();
  const user = buildUserPrompt(input, sections, cachedSection1);
  const minChars = MIN_CHARS[sections];

  let lastSections: GeneratedSectionsV3 | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.responses.create({
      model,
      reasoning: { effort },
      instructions: system,
      input: user,
      max_output_tokens: 25000,
    });
    if (res.status === "incomplete") {
      console.error("심층 리포트 생성이 잘렸어요:", res.incomplete_details?.reason);
      continue; // 잘린 결과는 쓰지 않고 재시도
    }
    const text = res.output_text ?? "";
    const parsed = parseSections(text);
    lastSections = parsed;
    const chars = totalChars(parsed);
    if (chars >= minChars) return parsed;
  }
  return lastSections!;
}

/** 결제 확인 후 호출하세요. API 키가 없으면 예외를 던집니다 — 호출부에서 처리하세요. */
export async function generateReportV3(input: ReportV3Input): Promise<GeneratedSectionsV3> {
  return callModel(input, "all");
}

/** 섹션 1(웰니스 프로파일)만 생성 — 결제 전 무료 공개용. */
export async function generateSection1Only(input: ReportV3Input): Promise<string[]> {
  const sections = await callModel(input, "1");
  return sections.section1;
}

/** 섹션 2~8만 생성하고, 이미 만들어둔 섹션 1을 그대로 합쳐서 반환 — 결제 후 재사용용. */
export async function generateSections2to8(input: ReportV3Input, cachedSection1: string[]): Promise<GeneratedSectionsV3> {
  const sections = await callModel(input, "2-8", cachedSection1);
  return { ...sections, section1: cachedSection1 };
}
