import { buildDomainProfile, EXPERT_NOTICE_TEXT } from "../lib/reportV3/domainProfile";
const axisScores = { CAR: 3.8, LOV: 4.0, REL: 2.8, SLF: 3.4, DIR: 4.2 };
const profile = buildDomainProfile("REL-primary", "REL", axisScores);
console.log(profile.scoreLine);
console.log(profile.introLine);
for (const b of profile.blocks) console.log(`**${b.label}**\n${b.text}\n`);
if (profile.expertNotice) console.log(EXPERT_NOTICE_TEXT);
