'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = pathname === '/' ? '' : `?redirect=${encodeURIComponent(pathname)}`;
      router.replace(`/login${redirect}`);
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center gap-2 text-text-muted">
        <i className="ph ph-spinner spin" />
        <span>인증 확인 중...</span>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
