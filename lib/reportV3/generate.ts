import "server-only";
import OpenAI from "openai";
import { normalizeBulletParagraphBreaks, splitIntoParagraphs } from "../paragraphSplit";
import { buildSystemPrompt, buildUserPrompt, type ReportV3Input } from "./prompt";
import { assembleSection1 } from "./sectionOneAssembler";
import type { GeneratedSectionsV3 } from "./types";

// 2026-09-29: deep-report-prompt-8section-v6.md 최신 반영 — 섹션 1(웰니스 프로파일)은 더
// 이상 OpenAI가 쓰지 않습니다. lib/reportV3/sectionOneAssembler.ts가 고정 문장 뱅크로 즉시
// 조립하고(무료 미리보기·결제 후 리포트 모두 이 함수 하나로 항상 같은 결과), AI는 2~8번
// 7개 섹션만 생성합니다.

export type { GeneratedSectionsV3 };

const SECTION_HEADERS: Record<string, keyof Omit<GeneratedSectionsV3, "section1">> = {
  "2": "section2",
  "3": "section3",
  "4": "section4",
  "5": "section5",
  "6": "section6",
  "7": "section7",
  "8": "section8",
};

function parseSections(markdown: string): Omit<GeneratedSectionsV3, "section1"> {
  const result: Omit<GeneratedSectionsV3, "section1"> = { section2: [], section3: [], section4: [], section5: [], section6: [], section7: [], section8: [] };
  const matches = [...markdown.matchAll(/### (\d)\.[^\n]*\n\n([\s\S]*?)(?=\n### \d\.|\s*$)/g)];
  for (const m of matches) {
    const key = SECTION_HEADERS[m[1]];
    if (!key) continue;
    const body = normalizeBulletParagraphBreaks(m[2].trim());
    if (!body) continue;
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    result[key] = splitIntoParagraphs(paragraphs, 5);
  }
  return result;
}

function totalChars(sections: Omit<GeneratedSectionsV3, "section1">): number {
  return Object.values(sections)
    .flat()
    .join("")
    .replace(/\s/g, "").length;
}

// 2026-09-29: 섹션 1을 AI가 안 쓰게 되면서 목표 분량이 4,300~6,300자(2~8번 기준)로
// 내려갔습니다 — 재시도 기준선은 그보다 조금 낮게 잡아 여유를 둡니다.
const MIN_CHARS = 3800;

async function callModel(input: ReportV3Input): Promise<Omit<GeneratedSectionsV3, "section1">> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  // gpt-6-sol(reasoning 모델, medium 추론 기본)로 전환 — run_sol_test.py 기준.
  // reasoning 모델은 chat.completions가 아니라 responses.create + reasoning.effort로 호출합니다.
  const model = process.env.OPENAI_REPORT_MODEL || "gpt-6-sol";
  const effort = (process.env.OPENAI_REPORT_EFFORT || "medium") as "low" | "medium" | "high";
  const client = new OpenAI({ apiKey });

  const system = buildSystemPrompt();
  const user = buildUserPrompt(input);

  let lastSections: Omit<GeneratedSectionsV3, "section1"> | null = null;
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
    if (chars >= MIN_CHARS) return parsed;
  }
  return lastSections!;
}

/** 결제 확인 후 호출하세요. API 키가 없으면 예외를 던집니다 — 호출부에서 처리하세요. */
export async function generateReportV3(input: ReportV3Input): Promise<GeneratedSectionsV3> {
  const section1 = assembleSection1(input);
  const rest = await callModel(input);
  return { section1, ...rest };
}
