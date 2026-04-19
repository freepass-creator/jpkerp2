'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { can, policyForPath } from '@/lib/auth/rbac';

/**
 * 라우트 진입 시 권한 검증.
 * 권한 부족하면 /로 리다이렉트 + 토스트.
 * pending 역할(승인대기)은 로그인 유지하되 /login?status=pending으로 이동.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    // 승인 대기중
    if (user.role === 'pending') {
      router.replace('/login?status=pending');
      return;
    }

    const policy = policyForPath(pathname);
    if (policy && !can(user.role, policy)) {
      // 권한 부족 → 대시보드로
      router.replace('/?denied=1');
    }
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}
