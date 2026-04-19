/**
 * 고객 포털(/my) 토큰 서명/검증.
 * HMAC-SHA256 기반. 비밀키는 MY_PORTAL_SECRET 환경변수.
 * 없으면 dev 폴백 (운영에선 반드시 설정).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.MY_PORTAL_SECRET || 'jpk-dev-portal-secret-replace-in-prod';
const SESSION_MS = 30 * 60 * 1000; // 30분

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: string): string {
  return b64urlEncode(createHmac('sha256', SECRET).update(payload).digest());
}

/** 토큰 발급 — `<car>.<iat>.<sig>` */
export function issueToken(carNumber: string): string {
  const iat = Date.now();
  const body = `${carNumber}.${iat}`;
  const sig = sign(body);
  return `${body}.${sig}`;
}

export interface VerifiedToken {
  carNumber: string;
  iat: number;
}

/** 토큰 검증 — 만료·서명 모두 체크 */
export function verifyToken(token: string, expectedCarNumber?: string): VerifiedToken | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [carNumber, iatStr, sig] = parts;
  const iat = Number(iatStr);
  if (!Number.isFinite(iat)) return null;
  if (Date.now() - iat > SESSION_MS) return null;
  if (expectedCarNumber && carNumber !== expectedCarNumber) return null;

  const expected = sign(`${carNumber}.${iat}`);
  try {
    const a = b64urlDecode(sig);
    const b = b64urlDecode(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { carNumber, iat };
}

/**
 * 식별자 정규화 — 공백·하이픈·괄호 제거.
 * 차량번호, 전화번호, 주민/사업자/법인 등록번호 모두 대응.
 */
export function normalizeIdentifier(s: string): string {
  return String(s || '').replace(/[\s\-()\.]/g, '').toLowerCase();
}
