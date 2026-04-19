import type { ReactNode } from 'react';

interface Props {
  /** Phosphor 아이콘 이름 (예: 'ph-folder-open'). 생략 시 아이콘 미표시. */
  icon?: string;
  /** 짧은 제목 (예: "내역 없음"). */
  title: string;
  /** 보조 설명 (선택). */
  description?: string;
  /** 다음 액션 버튼/링크 (선택). */
  action?: ReactNode;
  /** 세로 중앙정렬 여부. 기본 true. */
  centered?: boolean;
  /** 여백 크기. 기본 'md'. */
  size?: 'sm' | 'md' | 'lg';
}

const PAD = { sm: '12px 8px', md: '20px 12px', lg: '32px 16px' } as const;
const ICON_SIZE = { sm: 20, md: 28, lg: 36 } as const;

/**
 * 공용 Empty state.
 * UI-STANDARDS 9.3 규약: "데이터 없음" 단순 텍스트 대신 아이콘 + 설명 + (선택) 액션.
 */
export function EmptyState({ icon, title, description, action, centered = true, size = 'md' }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: centered ? 'center' : 'flex-start',
        justifyContent: 'center',
        textAlign: centered ? 'center' : 'left',
        padding: PAD[size],
        color: 'var(--c-text-muted)',
        gap: 6,
      }}
    >
      {icon && (
        <i
          className={`ph ${icon}`}
          style={{ fontSize: ICON_SIZE[size], color: 'var(--c-text-muted)', opacity: 0.5 }}
        />
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{description}</div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
