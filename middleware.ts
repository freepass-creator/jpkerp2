import { NextResponse, type NextRequest } from 'next/server';

/** 모바일 기기 User-Agent 감지 (iOS/Android 기본). */
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i;

/**
 * 루트("/") 진입 시 모바일이면 /m/upload 로 리다이렉트.
 * - 내부 페이지(/asset/..., /contract/... 등)는 건드리지 않음 (딥링크 보존)
 * - /m/*, /my, /login, /api, /_next, 정적 파일은 matcher에서 제외됨
 */
export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  if (!MOBILE_UA.test(ua)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/m/upload';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/'],
};
