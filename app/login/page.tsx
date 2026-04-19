'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirect);
    }
  }, [loading, user, redirect, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.includes('invalid')
          ? '이메일 또는 비밀번호가 잘못되었습니다'
          : msg.includes('user-not-found')
            ? '등록되지 않은 계정입니다'
            : msg,
      );
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-primary">JPK ERP</div>
          <div className="text-xs text-text-muted mt-1">v2 · 차량 생애주기 중심</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-sm focus:border-primary outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-sm focus:border-primary outline-none"
            />
          </div>
          {error && (
            <div className="text-xs text-danger bg-danger-bg rounded-sm px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className={cn(
              'btn btn-primary w-full',
              busy && 'opacity-60 cursor-not-allowed',
            )}
          >
            {busy ? (
              <>
                <i className="ph ph-spinner spin" />
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>
        <div className="mt-6 text-[10px] text-text-muted text-center">
          기존 jpkerp 계정으로 로그인
        </div>
      </div>
    </div>
  );
}
