// 2026-09-29: DB에 저장된 채점 결과로부터 ReportV3Input(프롬프트용 변수 묶음)을 만듭니다.
// build_report_input.py(2026-09-29 수정본)에 해당합니다. 궁합 상대는 카테고리당 1명이 아니라
// 동행형 2명·이웃형 1~2명·대조형 2명을 전부 담고(companions.ts 참고), theory는 섹션 1 하단에
// 서버가 그대로 노출할 이론 문구입니다(AI에게는 "인용하지 말라"는 지침과 함께 참고용으로만 전달).
import { AXES, DESSERT, GENDER_TITLE, type AxisKey, type CopingSubKey, type FactorKey, type Gender, type ModeKey, type TypeCode } from "../data";
import { BASE_KNOWLEDGE } from "./baseKnowledge";
import { companions, contrasts, leadFactors, leadGroup, neighbors } from "./companions";
import type { ReportV3Input } from "./prompt";

export function buildReportV3Input(params: {
  userName: string;
  gender: Gender;
  axis: AxisKey;
  mode: ModeKey;
  axisScores: Record<AxisKey, number>;
  factorScores: Record<FactorKey, number>;
  modeScores: Record<ModeKey, number>;
  copingSubScores: Record<CopingSubKey, number>;
  part1Answers: Record<string, number>;
  part2Answers: Record<string, number>;
}): ReportV3Input {
  const { userName, gender, axis, mode, axisScores, factorScores, modeScores, copingSubScores, part1Answers, part2Answers } = params;
  const typeCode = `${axis}-${mode}` as TypeCode;
  const leads = leadFactors(factorScores, AXES[axis]);
  const grp = leadGroup(leads);
  const others = AXES[axis].filter((k) => !leads.includes(k));

  return {
    typeCode,
    dessertName: DESSERT[typeCode].name,
    userName,
    title: GENDER_TITLE[gender],
    axis,
    mode,
    axisScores,
    factorScores,
    modeScores,
    copingSubScores,
    leadFactors: leads,
    leadGroup: grp,
    otherFactors: others,
    itemResponses: { ...part1Answers, ...part2Answers },
    companions: companions(axis, mode, grp),
    neighbors: neighbors(axis, mode, factorScores),
    contrasts: contrasts(axis, mode),
    theory: BASE_KNOWLEDGE[typeCode].relatedTheory,
  };
}
