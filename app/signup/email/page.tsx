"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuiz } from "@/lib/QuizContext";
import { createClient } from "@/lib/supabase/client";

// 2026-09-24: Vercel 엣지 캐시 문제 회피용(자세한 이유는 app/start/page.tsx 주석 참고).
export const dynamic = "force-dynamic";

const MIN_AGE = 14;
const SPECIAL_CHAR_RE = /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\/;']/;

interface PasswordChecks {
  length: boolean;
  upper: boolean;
  special: boolean;
}

function checkPassword(pw: string): PasswordChecks {
  return { length: pw.length >= 8, upper: /[A-Z]/.test(pw), special: SPECIAL_CHAR_RE.test(pw) };
}

function isAtLeastAge(birthDate: string, minAge: number): boolean {
  const bd = new Date(birthDate);
  if (Number.isNaN(bd.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const beforeBirthdayThisYear = now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate());
  if (beforeBirthdayThisYear) age--;
  return age >= minAge;
}

// 7. 이메일 회원가입 폼
// 이메일로 인증번호를 받아 확인(Supabase Auth OTP) → 비밀번호 설정 → 테스트 결과 저장.
// TODO: 2단계에서 실제 연동 — 휴대폰 번호 가입은 SMS 발송 업체 연결 후 지원
export default function SignupEmailPage() {
  const router = useRouter();
  const { result, userName, userGender, setSavedResultId, pendingAfterSignup, setPendingAfterSignup } = useQuiz();
  // 온보딩에서 적은 값은 "닉네임"이고, 여기 "이름"은 실명이라 서로 다른 값입니다 — 미리 채우지 않습니다.
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [contact, setContact] = useState(""); // 이메일 (인증에 쓰는 값)
  const [phone, setPhone] = useState(""); // 휴대전화번호 — 선택, 준비 중
  const [address, setAddress] = useState(""); // 주소 — 선택 (다음 우편번호 검색으로 채움)
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedSensitive, setAgreedSensitive] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [verifyShown, setVerifyShown] = useState(false);
  const [verified, setVerified] = useState(false); // 인증번호 확인 완료
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // 초 단위. 0이면 다시 보낼 수 있음.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeSectionRef = useRef<HTMLDivElement | null>(null);

  // 2026-09-28: "로그인 화면에 회원가입이 없다" 피드백 — 이제 홈 "로그인하기"를 거쳐
  // 테스트 결과 없이 바로 들어올 수도 있어서, result가 없다고 홈으로 쫓아내지 않습니다.
  // (result가 있으면 기존처럼 가입 완료 시 그 결과도 같이 저장됩니다.)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
  }, []);

  // 인증번호 입력창이 화면에 새로 나타나면(특히 모바일에서 "인증번호 받기" 버튼이 화면 아래쪽에
  // 있던 경우) 스크롤해서 바로 보이게 합니다 — 안 보여서 같은 버튼을 계속 눌러 429가 나는 걸 방지.
  useEffect(() => {
    if (verifyShown) {
      codeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [verifyShown]);

  const pwChecks = checkPassword(password);
  const pwValid = pwChecks.length && pwChecks.upper && pwChecks.special;

  // 2026-09-26: 주소 검색 — 다음(카카오) 우편번호 서비스. 스크립트는 처음 누를 때 한 번만 불러옵니다.
  const openAddressSearch = async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    if (!w.daum?.Postcode) {
      try {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("load failed"));
          document.head.appendChild(s);
        });
      } catch {
        setToast("주소 검색을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
    }
    new w.daum.Postcode({
      oncomplete: (data: any) => setAddress(data.roadAddress || data.jibunAddress || data.address),
    }).open();
    /* eslint-enable @typescript-eslint/no-explicit-any */
  };

  const sendVerificationCode = async () => {
    const email = contact.trim();
    if (!email) {
      setToast("이메일 주소를 먼저 입력해주세요.");
      return;
    }
    if (!email.includes("@")) {
      setToast("휴대폰 번호 가입은 준비 중이에요. 이메일 주소를 입력해주세요.");
      return;
    }
    setBusy(true);
    // 2026-09-25: "이메일 중복확인 반드시 거치도록" 피드백 — 이미 가입을 마친 이메일이면 여기서
    // 막습니다. 안 그러면 signInWithOtp가 기존 계정에 로그인 OTP를 조용히 보내버려서, 이 화면을
    // 끝까지 진행했을 때 기존 계정의 비밀번호·이름이 새 값으로 덮어써질 위험이 있었습니다.
    const dupRes = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (dupRes.ok) {
      const dup = await dupRes.json();
      if (dup.exists) {
        setBusy(false);
        setToast("이미 가입된 이메일이에요. 로그인해주세요.");
        return;
      }
    }
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      console.error("인증번호 발송 실패:", error.message);
      setToast(
        error.status === 429
          ? "인증번호 요청이 너무 많아요. 잠시 후 다시 시도해주세요."
          : "인증번호를 보내지 못했어요. 이메일 주소를 확인하고 잠시 후 다시 시도해주세요."
      );
      return;
    }
    setCode("");
    setVerifyShown(true);
    setToast("인증번호를 보냈어요. 메일함을 확인해주세요. 다시 받으면 이전 번호는 쓸 수 없어요.");

    // 메일이 도착하기도 전에 같은 버튼을 연타해서 재요청이 쌓이는 것(→ 429 요청 과다 오류)을
    // 막기 위해 잠깐 재전송을 막아둡니다.
    const COOLDOWN_SECONDS = 30;
    setResendCooldown(COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const confirmCode = async () => {
    if (!code.trim()) {
      setToast("인증번호를 입력해주세요.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({
      email: contact.trim(),
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    setBusy(false);
    if (error) {
      // Supabase 는 "틀린 번호"와 "만료"를 같은 오류로 돌려줍니다.
      console.error("인증번호 확인 실패:", error.message);
      setToast("인증번호가 맞지 않거나 만료됐어요. 메일의 가장 최근 번호인지 확인하거나, 인증번호를 다시 받아주세요.");
      return;
    }
    setVerified(true);
    setToast("인증이 완료됐어요. 나머지 정보를 입력하고 가입 완료를 눌러주세요.");
  };

  const saveResult = async () => {
    // 테스트 결과 없이(홈 "로그인하기" → "회원가입하기") 가입한 경우 — 저장할 결과가
    // 없으니 그냥 성공으로 취급하고 넘어갑니다.
    if (!result) return true;
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName,
        gender: userGender,
        part1Answers: result.part1Answers,
        part2Answers: result.part2Answers,
        confirmedAxis: result.confirmedAxis,
        confirmedMode: result.confirmedMode,
        typeCode: result.typeCode,
        axisScores: result.axisScores,
        factorScores: result.factorScores,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.id) setSavedResultId(data.id);
    return true;
  };

  const completeSignup = async () => {
    if (!name.trim() || !birthDate || !contact.trim() || !password.trim()) {
      setToast("이름, 생년월일, 연락처, 비밀번호를 모두 입력해주세요.");
      return;
    }
    if (!isAtLeastAge(birthDate, MIN_AGE)) {
      setToast(`만 ${MIN_AGE}세 미만은 가입할 수 없어요.`);
      return;
    }
    if (!verified) {
      setToast(verifyShown ? "인증번호 확인을 먼저 눌러주세요." : "인증번호 받기를 먼저 눌러주세요.");
      return;
    }
    if (!pwValid) {
      setToast("비밀번호 조건을 모두 만족해주세요.");
      return;
    }
    if (!agreedTerms) {
      setToast("이용약관, 개인정보처리방침 및 개인정보 국외이전에 동의해주세요.");
      return;
    }
    if (!agreedSensitive) {
      setToast("민감정보(테스트 응답) 수집·이용에 동의해주세요.");
      return;
    }

    setBusy(true);
    try {
      const { error: pwSetError } = await createClient().auth.updateUser({
        password: password.trim(),
        data: { name: name.trim(), nickname: nickname.trim() || undefined, birth_date: birthDate },
      });
      if (pwSetError) {
        console.error("비밀번호 설정 실패:", pwSetError.message);
        setToast("비밀번호를 설정하지 못했어요. 조건을 다시 확인해주세요.");
        return;
      }
      // 가입을 완료했다고 표시해둬야, 같은 이메일로 다시 가입을 시도할 때 중복확인에서 막힙니다.
      await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() || undefined, marketingConsent: agreedMarketing, address: address.trim() || undefined }),
      });
      if (!(await saveResult())) {
        setToast("가입은 됐지만 결과를 저장하지 못했어요. 가입 완료를 다시 눌러주세요.");
        return;
      }
      setToast(result ? "가입이 완료됐어요! 이제 결과가 저장돼요." : "가입이 완료됐어요! 이제 테스트를 해볼 수 있어요.");
      const nextPath = pendingAfterSignup ?? (result ? "/result" : "/");
      setPendingAfterSignup(null);
      timer.current = setTimeout(() => router.push(nextPath), 1600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <button
        className="secondary"
        style={{ width: "auto", padding: "8px 14px", fontSize: 14, marginBottom: 16 }}
        onClick={() => router.push(result ? "/signup" : "/login")}
      >
        ← 뒤로
      </button>
      <p className="kicker">계정 만들기</p>
      <h1 className="serif">본인 확인 후 가입할게요</h1>

      <p className="field-label" style={{ marginTop: 8 }}>이름 (실명)</p>
      <input type="text" className="text-input" placeholder="실명을 입력해주세요" value={name} onChange={(e) => setName(e.target.value)} />

      <p className="field-label">닉네임 (선택, 비우면 이름이 표시돼요)</p>
      <input type="text" className="text-input" placeholder="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />

      <p className="field-label">생년월일</p>
      <input
        type="date"
        className="text-input"
        value={birthDate}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setBirthDate(e.target.value)}
      />

      <p className="field-label">이메일</p>
      <input
        type="email"
        className="text-input"
        placeholder="이메일 주소"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        disabled={verified}
      />
      <button
        type="button"
        className="secondary"
        style={{ margin: "10px 0" }}
        onClick={sendVerificationCode}
        disabled={busy || verified || resendCooldown > 0}
      >
        {verified
          ? "인증 완료"
          : resendCooldown > 0
            ? `인증번호 받기 (${resendCooldown}초 후 재전송 가능)`
            : verifyShown
              ? "인증번호 다시 받기"
              : "인증번호 받기"}
      </button>

      {verifyShown && (
        <div ref={codeSectionRef}>
          <p className="field-label">인증번호</p>
          <input
            type="text"
            className="text-input"
            placeholder="인증번호 6자리"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={verified}
          />
          <button type="button" className="secondary" style={{ margin: "10px 0" }} onClick={confirmCode} disabled={busy || verified}>
            {verified ? "인증 완료 ✓" : "인증번호 확인"}
          </button>
        </div>
      )}

      <p className="field-label">휴대전화번호 (선택)</p>
      <input type="tel" className="text-input" placeholder="휴대전화번호" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <p className="tiny" style={{ margin: "6px 2px 0" }}>휴대폰 번호 인증은 준비 중이에요. 지금은 이메일로 가입해주세요.</p>

      <p className="field-label">주소 (선택)</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="text" className="text-input" placeholder="주소 (선택)" value={address} readOnly onClick={openAddressSearch} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="secondary" style={{ width: "auto", flexShrink: 0, padding: "0 16px" }} onClick={openAddressSearch}>
          주소 검색
        </button>
      </div>

      <p className="field-label">비밀번호</p>
      <input
        type="password"
        className="text-input"
        placeholder="비밀번호를 입력해주세요"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <ul style={{ listStyle: "none", padding: 0, margin: "6px 2px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        <li className="tiny" style={{ color: pwChecks.length ? "var(--navy-soft)" : "var(--text3)" }}>
          {pwChecks.length ? "✓" : "○"} 8자 이상
        </li>
        <li className="tiny" style={{ color: pwChecks.upper ? "var(--navy-soft)" : "var(--text3)" }}>
          {pwChecks.upper ? "✓" : "○"} 대문자 1자 이상
        </li>
        <li className="tiny" style={{ color: pwChecks.special ? "var(--navy-soft)" : "var(--text3)" }}>
          {pwChecks.special ? "✓" : "○"} 특수문자 1자 이상
        </li>
      </ul>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <input
            type="checkbox"
            id="agree-terms"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
          />
          <label htmlFor="agree-terms" className="tiny" style={{ lineHeight: 1.6, cursor: "pointer" }}>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--navy-soft)", textDecoration: "underline" }}>
              개인정보 처리방침
            </Link>
            과{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--navy-soft)", textDecoration: "underline" }}>
              이용약관
            </Link>
            , 일부 개인 데이터의 국외이전에 동의합니다. (필수)
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <input
            type="checkbox"
            id="agree-sensitive"
            checked={agreedSensitive}
            onChange={(e) => setAgreedSensitive(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
          />
          <label htmlFor="agree-sensitive" className="tiny" style={{ lineHeight: 1.6, cursor: "pointer" }}>
            테스트 응답 등{" "}
            <Link
              href="/privacy/sensitive"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--navy-soft)", textDecoration: "underline" }}
            >
              민감정보의 수집·이용
            </Link>
            에 동의합니다. (필수)
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <input
            type="checkbox"
            id="agree-marketing"
            checked={agreedMarketing}
            onChange={(e) => setAgreedMarketing(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
          />
          <label htmlFor="agree-marketing" className="tiny" style={{ lineHeight: 1.6, cursor: "pointer" }}>
            (선택) 마케팅 정보 활용에 동의합니다.
          </label>
        </div>
      </div>

      <button type="button" className="btn-lg" style={{ marginTop: 16 }} onClick={completeSignup} disabled={busy}>
        가입 완료
      </button>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
