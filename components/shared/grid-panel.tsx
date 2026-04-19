'use client';

import type { RefObject } from 'react';
import { Panel } from './panel';
import { GridToolbar } from './grid-toolbar';
import type { JpkGridApi } from './jpk-grid';

interface Props<T> {
  icon?: string;
  title: string;
  subtitle?: string;
  /** 행 개수 — 단위와 함께 title 옆 pill로 표시 (예: "130건") */
  count?: number;
  /** count 단위 ('건', '대', '명' 등). 기본 '건' */
  unit?: string;
  /** 그리드 ref — GridToolbar 자동 렌더링용 */
  gridRef?: RefObject<JpkGridApi<T> | null>;
  /** CSV 내보내기 파일명 */
  exportFileName?: string;
  /** toolbar 좌측 (예: 검색창·필터칩). 있으면 count 뒤에 표시 */
  leftActions?: React.ReactNode;
  /** toolbar 우측 주요 액션 (예: + 새 차량) */
  primaryActions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 목록 페이지 공용 패널 — 패널헤드에 count + toolbar + primary action 한 줄 배치.
 * 별도 서브헤더 없이 panel-head 하나로 끝남.
 */
export function GridPanel<T = unknown>({
  icon,
  title,
  subtitle,
  count,
  unit = '건',
  gridRef,
  exportFileName,
  leftActions,
  primaryActions,
  children,
}: Props<T>) {
  return (
    <Panel
      icon={icon}
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {typeof count === 'number' && (
            <span className="panel-head-count">
              {count.toLocaleString()}
              <span className="unit">{unit}</span>
            </span>
          )}
          {leftActions}
          {gridRef && (
            <>
              <span className="panel-head-spacer" />
              <GridToolbar gridRef={gridRef} exportFileName={exportFileName} />
            </>
          )}
          {primaryActions && (
            <>
              <span className="panel-head-divider" />
              {primaryActions}
            </>
          )}
        </>
      }
      noPad
    >
      {children}
    </Panel>
  );
}
