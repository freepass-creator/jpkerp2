'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';

export default function MobileSettings() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('로그아웃 완료');
      router.replace('/login');
    } catch (err) {
      toast.error(`로그아웃 실패: ${(err as Error).message}`);
    }
  };

  return (
    <div>
      <div className="m-title">설정</div>
      <div className="m-subtitle">계정 · 앱 정보</div>

      <div className="m-section-title">계정</div>
      <div className="m-card" style={{ marginBottom: 12 }}>
        <div className="text-xs text-text-muted" style={{ marginBottom: 4 }}>로그인 계정</div>
        <div className="text-base" style={{ fontWeight: 500 }}>
          {user?.displayName ?? user?.email ?? '(익명)'}
        </div>
        {user?.email && user?.displayName && (
          <div className="text-xs text-text-sub" style={{ marginTop: 2 }}>{user.email}</div>
        )}
      </div>

      <button
        type="button"
        className="m-btn"
        onClick={handleSignOut}
        style={{ width: '100%', marginBottom: 20 }}
      >
        <i className="ph ph-sign-out" />
        로그아웃
      </button>

      <div className="m-section-title">앱 정보</div>
      <div className="m-card">
        <div className="text-xs text-text-muted">버전</div>
        <div className="text-base">jpkerp mobile v2</div>
        <div className="text-xs text-text-muted" style={{ marginTop: 8 }}>데스크톱 사용</div>
        <div className="text-xs text-primary">
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            <i className="ph ph-arrow-up-right" style={{ marginRight: 4 }} />
            데스크톱 버전으로 이동
          </a>
        </div>
      </div>
    </div>
  );
}
