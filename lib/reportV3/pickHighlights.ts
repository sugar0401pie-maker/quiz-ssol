import "server-only";
import OpenAI from "openai";
import { ORDINAL_PREFIX, BULLET_LINE } from "./boldParagraph";
import { splitSentencePieces } from "./highlight";
import type { GeneratedSectionsV3, SectionHighlights } from "./types";
import { leadInIndexFor } from "./uiSections";

// 2026-10-21: 3~10장에서 글만 길게 이어지지 않도록, 완성된 리포트(섹션 2~8)에서 "독자가 꼭 기억할 요약·결론 문장"을 AI가 섹션마다
// 1~2개 고르게 합니다. 글을 고치지 않고 문장 위치만 받으며, 실패하거나 형식이 틀리면 빈 결과를 돌려줘서(= 화면이 규칙으로 대신)
// 리포트 생성이 이것 때문에 실패하는 일은 없습니다.
const SECTION_KEYS = ["section2", "section3", "section4", "section5", "section6", "section7", "section8"] as const;
// 2026-10-22: 굵은 문장 양 — "2문단당 1개 정도"(사용자 지시). 후보 문단(두괄식 첫 문단·• 소제목·"첫째," 문단 제외) 수의 절반(반올림), 최소 1개.
const quotaFor = (candidateCount: number) => (candidateCount === 0 ? 0 : Math.max(1, Math.round(candidateCount / 2)));

interface Candidate {
  p: number;
  sentences: string[];
}

function candidatesFor(key: (typeof SECTION_KEYS)[number], paragraphs: string[]): Candidate[] {
  const lead = leadInIndexFor(key, paragraphs); // 두괄식 요약 문단은 이미 굵게 보임
  const advice6 = key === "section6" ? paragraphs.findIndex((t) => t.trim() === "• 나와 다른 사람과 잘 지내는 법") : -1;
  const out: Candidate[] = [];
  paragraphs.forEach((text, p) => {
    if (p === lead) return;
    if (BULLET_LINE.test(text) || ORDINAL_PREFIX.test(text)) return; // 이미 굵은 소제목·"첫째," 문단
    if (key === "section6" && p <= advice6) return; // 관계 소개(서버 조립) 부분은 제외, 조언 부분만
    const sentences = splitSentencePieces(text).map((x) => x.trim());
    if (sentences.every((x) => x.length < 8)) return;
    out.push({ p, sentences });
  });
  return out;
}

const INSTRUCTIONS = `당신은 웰니스 리포트 편집자입니다. 글을 고치지 말고, 독자가 눈으로 훑을 때 굵게 보여주면 좋은 문장의 위치만 고르세요.
각 섹션마다 "그 섹션을 요약하거나 결론을 말하는 핵심 문장"을 고릅니다. 섹션 제목 줄에 적힌 "고를 개수"만큼(후보 문단 2개당 1개 정도) 고르되, 같은 섹션 안에서 연속된 문단에 몰리지 않게 글 전체에 고르게 퍼지도록 고릅니다.
규칙:
- 완결된 문장 하나만 고릅니다(문단 전체가 아님).
- 예시 장면("예를 들어 …")을 설명하는 문장, 점수만 나열한 문장, 단서·주의를 다는 문장("다만 …")은 되도록 고르지 않습니다.
- 한 문단에서 문장 하나만 고르고, 섹션의 "고를 개수"를 넘기지 않습니다.
- 후보에 없는 위치를 만들지 마세요. 고를 만한 문장이 없는 섹션은 빈 배열로 둡니다.
- 출력은 JSON 한 개만 쓰고 다른 글은 쓰지 않습니다. 형식: {"section2":[[문단번호,문장번호]],"section3":[],...}`;

export async function pickHighlights(sections: GeneratedSectionsV3): Promise<SectionHighlights> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return {};
    const cands: Record<string, Candidate[]> = {};
    let prompt = "";
    for (const key of SECTION_KEYS) {
      const list = candidatesFor(key, sections[key]);
      cands[key] = list;
      prompt += `\n## ${key} (고를 개수: ${quotaFor(list.length)}개)\n`;
      for (const c of list) prompt += `[문단 ${c.p}] ${c.sentences.map((t, i) => `(문장 ${i}) ${t}`).join(" ")}\n`;
    }
    const client = new OpenAI({ apiKey });
    const res = await client.responses.create({
      model: process.env.OPENAI_REPORT_MODEL || "gpt-6-sol",
      reasoning: { effort: "low" },
      instructions: INSTRUCTIONS,
      input: prompt,
      max_output_tokens: 3000,
    });
    const raw = (res.output_text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: SectionHighlights = {};
    for (const key of SECTION_KEYS) {
      const picks = parsed[key];
      if (!Array.isArray(picks)) continue;
      const valid: [number, number][] = [];
      const usedParagraphs = new Set<number>();
      for (const pick of picks) {
        if (!Array.isArray(pick) || pick.length !== 2) continue;
        const [p, s] = pick as [unknown, unknown];
        if (typeof p !== "number" || typeof s !== "number") continue;
        const c = cands[key].find((x) => x.p === p);
        if (!c || s < 0 || s >= c.sentences.length || c.sentences[s].length < 8) continue; // 후보 밖 위치는 버립니다
        if (usedParagraphs.has(p)) continue;
        usedParagraphs.add(p);
        valid.push([p, s]);
        if (valid.length >= quotaFor(cands[key].length)) break;
      }
      if (valid.length) out[key] = valid;
    }
    return out;
  } catch (err) {
    console.error("굵게 보일 문장 고르기 실패(리포트는 그대로 사용):", err instanceof Error ? err.message : err);
    return {};
  }
}
