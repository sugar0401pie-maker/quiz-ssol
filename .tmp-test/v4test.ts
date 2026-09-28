import { buildReportV3Input } from "../lib/reportV3/buildInput";
import { buildSystemPrompt, buildUserPrompt } from "../lib/reportV3/prompt";
import { splitIntoParagraphs } from "../lib/paragraphSplit";
import OpenAI from "openai";

const axisScores = { CAR: 3.8, LOV: 4.0, REL: 2.8, SLF: 3.4, DIR: 4.2 };
const factorScores = {
  job_fit: 3.8, partner_fit: 4.0, attachment: 4.0, boundary: 2.2, global_worth: 3.4,
  values: 4.2, meaning: 4.2, tension_tol: 3.4, competence_cw: 3.5, approval_cw: 3.3,
};
const modeScores = { primary: 4.3, secondary: 2.8, disengage: 1.8 };
const copingSubScores = { problem_solving: 4.5, support: 4.0, reframing: 3.0, acceptance: 2.5, cog_avoid: 2.0, beh_avoid: 1.5 };
const part1Answers: Record<string, number> = {};
for (const id of ["P01","P02","P03","P04","P05","P06","P07","P08","P09","P10","P11","P12","P13","P14","P15","P16","P17","P18","P19","P20","P21"]) part1Answers[id] = 3;
part1Answers.P07 = 5; part1Answers.P08 = 2;
const part2Answers: Record<string, number> = { Q01:5,Q02:4,Q03:4,Q04:4,Q05:3,Q06:3,Q07:2,Q08:3,Q09:2,Q10:2,Q11:1,Q12:2 };

const input = buildReportV3Input({ axis: "REL", mode: "primary", axisScores, factorScores, modeScores, copingSubScores, part1Answers, part2Answers });

async function main() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_REPORT_MODEL || "gpt-4o-mini",
    messages: [{ role: "system", content: buildSystemPrompt() }, { role: "user", content: buildUserPrompt(input) }],
    temperature: 0.7,
  });
  const text = res.choices[0]?.message?.content ?? "";
  require("fs").writeFileSync(".tmp-test/v4-output.md", text);

  const matches = [...text.matchAll(/### (\d)\.[^\n]*\n\n([\s\S]*?)(?=\n### \d\.|\s*$)/g)];
  console.log("sections found:", matches.map(m => m[1]));
  const haveTheory = /[A-Za-z].*이론|이론.*[A-Za-z]|\([A-Za-z]/.test(text);
  console.log("has theory/English citation-looking text:", haveTheory);
  const nida = (text.match(/입니다/g) || []).length;
  const haeyo = (text.match(/해요/g) || []).length;
  console.log("입니다 count:", nida, "해요 count:", haeyo);
  console.log("total chars:", text.length);
}
main().catch(e => { console.error(e); process.exit(1); });
