import "server-only";
import OpenAI from "openai";
import { normalizeBulletParagraphBreaks, splitIntoParagraphs } from "../paragraphSplit";
import { buildSystemPrompt, buildUserPrompt, type ReportV3Input } from "./prompt";
import { assembleSection6Relationships } from "./section6Assembler";
import type { GeneratedSectionsV3 } from "./types";

// 2026-09-29: deep-report-prompt-8section-v6.md 최신 반영 — 섹션 1(웰니스 프로파일)은 더
// 이상 OpenAI가 쓰지 않습니다. lib/reportV3/sectionOneAssembler.ts가 고정 문장 뱅크로 즉시
// 조립합니다(무료 미리보기·결제 후 리포트 모두 이 함수 하나로 항상 같은 결과).
// 2026-09-29 추가: 섹션 6도 절반은 서버가 조립합니다 — companions()/neighbors()/contrasts()의
// 92가지 조합을 section6Assembler.ts가 고정 문장으로 만들고, AI는 그 뒤에 붙는 "나와 다른
// 사람과 잘 지내는 법" 조언 3가지만 씁니다(사장님이 조언 부분은 AI로 유지하길 원해서 6번
// 전체를 서버 조립으로 바꾼 원안과 다르게, 절반만 서버 조립 + 절반은 AI로 갔습니다). 그래서
// AI는 2·3·4·5·6(조언만)·7·8번을 생성합니다.

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

// 2026-10-05: 영역 이름이 "삶의 방향"→"인생"으로 바뀌었는데(규칙 18), 프롬프트로 시켜도 AI가
// 예전 이름을 가끔 씁니다 — 파싱 단계에서 한 번 더 확실하게 바꿉니다. "나 자신"은 문항 원문
// 인용·평범한 말로도 쓰여서 기계적으로 바꾸지 않고, "커리어"도 일반 명사로 쓰일 수 있어 뺐습니다.
function normalizeAreaNames(text: string): string {
  return text.replace(/삶의 방향/g, "인생의 방향");
}

function parseSections(markdown: string): Omit<GeneratedSectionsV3, "section1"> {
  const result: Omit<GeneratedSectionsV3, "section1"> = { section2: [], section3: [], section4: [], section5: [], section6: [], section7: [], section8: [] };
  const matches = [...markdown.matchAll(/### (\d)\.[^\n]*\n\n([\s\S]*?)(?=\n### \d\.|\s*$)/g)];
  for (const m of matches) {
    const key = SECTION_HEADERS[m[1]];
    if (!key) continue;
    const body = normalizeBulletParagraphBreaks(normalizeAreaNames(m[2].trim()));
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

// 2026-09-29: 섹션 1 전체와 섹션 6의 관계성 소개 부분을 AI가 안 쓰게 되면서 목표 분량이
// 3,300~5,000자로 내려갔습니다 — 재시도 기준선은 그보다 조금 낮게 잡아 여유를 둡니다.
const MIN_CHARS = 2800;

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

  // 2026-09-30: 두 번 다 "incomplete"면 lastSections가 끝까지 null로 남아
  // generateReportV3()에서 rest.section6 접근 시 크래시하는 버그가 있었습니다(잘린
  // 응답이어도 일단 파싱해서 lastSections에 기록해두고, 정말 아무것도 못 받았을 때만
  // 명시적으로 에러를 던지도록 고쳤습니다 — 호출부가 이미 try/catch로 "failed" 상태
  // 처리를 하고 있으니 여기서 에러를 던지는 편이 원인 불명의 null 접근보다 낫습니다).
  let lastSections: Omit<GeneratedSectionsV3, "section1"> | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.responses.create({
      model,
      reasoning: { effort },
      instructions: system,
      input: user,
      max_output_tokens: 25000,
    });
    const text = res.output_text ?? "";
    const parsed = parseSections(text);
    if (res.status === "incomplete") {
      console.error("심층 리포트 생성이 잘렸어요:", res.incomplete_details?.reason);
      lastSections = parsed; // 잘렸어도 재시도까지 실패하면 최소한 이거라도 씁니다.
      continue;
    }
    lastSections = parsed;
    const chars = totalChars(parsed);
    if (chars >= MIN_CHARS) return parsed;
  }
  if (!lastSections) throw new Error("심층 리포트 생성 응답을 받지 못했습니다");
  return lastSections;
}

// 섹션 1은 호출부가 lib/reportV3/sectionOneAssembler.ts의 assembleSection1()로 만들어 넘겨줍니다
// (AI 없이 결정론적 — 2026-10-05부터 캐시도 없음).
/** 결제 확인 후 호출하세요. API 키가 없으면 예외를 던집니다 — 호출부에서 처리하세요. */
export async function generateReportV3(input: ReportV3Input, section1: string[]): Promise<GeneratedSectionsV3> {
  const section6Relationships = assembleSection6Relationships(input.axis, input.mode, input.companions, input.neighbors, input.contrasts);
  const rest = await callModel(input);
  // rest.section6은 AI가 쓴 "나와 다른 사람과 잘 지내는 법" 조언 부분만 담고 있습니다 —
  // 그 앞에 서버가 조립한 관계성 소개를 붙여 완성된 6번을 만듭니다.
  return { section1, ...rest, section6: [...section6Relationships, ...rest.section6] };
}
