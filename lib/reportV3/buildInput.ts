// 2026-09-28: DB에 저장된 채점 결과로부터 ReportV3Input(프롬프트용 변수 묶음)을 만듭니다.
// server_logic_v3.py의 build_report_input()에 해당합니다.
import { AXES, DESSERT, type AxisKey, type CopingSubKey, type FactorKey, type ModeKey, type TypeCode } from "../data";
import { companions, contrasts, leadFactors, leadGroup, neighbors } from "./companions";
import type { ReportV3Input } from "./prompt";

export function buildReportV3Input(params: {
  axis: AxisKey;
  mode: ModeKey;
  axisScores: Record<AxisKey, number>;
  factorScores: Record<FactorKey, number>;
  modeScores: Record<ModeKey, number>;
  copingSubScores: Record<CopingSubKey, number>;
  part1Answers: Record<string, number>;
  part2Answers: Record<string, number>;
}): ReportV3Input {
  const { axis, mode, axisScores, factorScores, modeScores, copingSubScores, part1Answers, part2Answers } = params;
  const typeCode = `${axis}-${mode}` as TypeCode;
  const leads = leadFactors(factorScores, AXES[axis]);
  const grp = leadGroup(leads);
  const others = AXES[axis].filter((k) => !leads.includes(k));

  return {
    typeCode,
    dessertName: DESSERT[typeCode].name,
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
  };
}
