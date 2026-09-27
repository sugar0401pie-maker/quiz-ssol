import { NextResponse } from "next/server";
import crypto from "crypto";

// 네이버 로그인 1단계 — 네이버 인증 화면으로 보냅니다.
// Supabase가 네이버를 기본 제공하지 않아서 직접 구현합니다 (2단계 가이드 문서 참고).
export async function GET(req: Request) {
  if (!process.env.NAVER_CLIENT_ID) {
    return NextResponse.redirect(new URL("/signup?error=naver_not_configured", req.url));
  }
  const origin = new URL(req.url).origin;
  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL("https://nid.naver.com/oauth2.0/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.NAVER_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/naver/callback`);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set("naver_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
