import type { IconKey } from "./data";

// final-ssol-wellness-v2-master-spec.md 6장 — 15유형 중 3종(아포가토·베리소르베·프루트타르트)의
// 캐릭터 일러스트가 2026-09-25 도착하여, 더 이상 대체 이미지가 필요하지 않습니다.
// (당분간 이 표는 비워두되, 앞으로 새 유형이 추가될 때 같은 패턴으로 재사용할 수 있게 남겨둡니다.)
const PLACEHOLDER_ICON_FALLBACK: Partial<Record<IconKey, IconKey>> = {};

/** 이미지 파일(icon-*.png, profile-*.jpg) 경로를 만들 때는 항상 이 함수를 거쳐서 키를 정하세요. */
export function resolveIconKey(icon: IconKey): IconKey {
  return PLACEHOLDER_ICON_FALLBACK[icon] ?? icon;
}
