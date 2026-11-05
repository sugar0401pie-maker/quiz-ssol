// 홈(components/IntroClient.tsx)과 /about이 같이 쓰는 "참여자 수" — 두 화면의 숫자가 항상 같도록 한 곳에서만 고칩니다.
export const PARTICIPANT_COUNT = 2391;
// 기준일: 숫자를 바꿀 때 같이 갱신합니다(/about 문구에 표시). 주기적으로 집계해 업데이트합니다.
export const PARTICIPANT_AS_OF = "2026.11.05";
export const PARTICIPANT_COUNT_TEXT = PARTICIPANT_COUNT.toLocaleString("ko-KR");
