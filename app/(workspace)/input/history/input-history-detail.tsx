'use client';

import { useMemo } from 'react';
import { JpkGrid } from '@/components/shared/jpk-grid';
import type { ColDef } from 'ag-grid-community';
import { fmt } from '@/lib/utils';
import type { UploadRow } from './types';

interface Props {
  upload: UploadRow | null;
}

function fmtTs(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 10,
        background: 'var(--c-bg-sub)',
        borderRadius: 2,
        minWidth: 70,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          marginTop: 2,
        }}
      >
        {fmt(Number(value || 0))}
      </div>
    </div>
  );
}

export function InputHistoryDetail({ upload }: Props) {
  const originalRows = useMemo(() => {
    if (!upload) return [] as Record<string, unknown>[];
    if (upload._direct) return (upload._records ?? []) as Record<string, unknown>[];
    return ((upload._raw?.rows ?? []) as Record<string, unknown>[]);
  }, [upload]);

  const cols = useMemo<ColDef<Record<string, unknown>>[]>(() => {
    if (originalRows.length === 0) return [];
    const keys = Object.keys(originalRows[0]).filter((k) => !k.startsWith('_')).slice(0, 30);
    return [
      {
        headerName: '#',
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        width: 45,
        cellStyle: { color: 'var(--c-text-muted)' },
      },
      ...keys.map((k) => ({
        field: k,
        headerName: k,
        minWidth: 80,
        flex: 1,
      })),
    ];
  }, [originalRows]);

  if (!upload) {
    return (
      <div
        className="flex flex-col items-center justify-center text-text-muted"
        style={{ height: '100%', minHeight: 200, gap: 8 }}
      >
        <i className="ph ph-arrow-left" style={{ fontSize: 24, opacity: 0.4 }} />
        <span style={{ fontSize: 12 }}>좌측 이력을 선택하세요</span>
      </div>
    );
  }

  const isUrl = /^https?:\/\//i.test(upload.filename);

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg-sub)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <Stat label="총건수" value={upload.total} color="var(--c-text)" />
          <Stat label="신규" value={upload.ok} color="var(--c-success)" />
          <Stat label="중복" value={upload.skip} color="var(--c-warn)" />
          <Stat label="오류" value={upload.fail} color="var(--c-danger)" />
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--c-text-muted)',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>
            <b style={{ color: 'var(--c-text-sub)', fontWeight: 600 }}>
              {upload._direct ? '개별입력' : '업로드'}
            </b>
            {': '}
            {fmtTs(upload.uploaded_at)}
          </span>
          <span>
            반영:{' '}
            <b
              style={{
                color:
                  upload.committed_label === '완료' ? 'var(--c-success)'
                  : upload.committed_label === '오류' ? 'var(--c-danger)'
                  : 'inherit',
              }}
            >
              {upload.committed_label || '-'}
            </b>
          </span>
          <span>
            종류: <b style={{ color: 'var(--c-text-sub)' }}>{upload.type_label}</b>
          </span>
          {isUrl && (
            <a
              href={upload.filename}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--c-primary)', textDecoration: 'underline', marginLeft: 'auto' }}
            >
              🔗 원본 열기
            </a>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', marginTop: 6 }}>
          {isUrl ? '(URL)' : upload.filename}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {originalRows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-text-muted"
            style={{ height: '100%', minHeight: 200, gap: 8 }}
          >
            <i className="ph ph-database" style={{ fontSize: 24, opacity: 0.4 }} />
            <span style={{ fontSize: 12 }}>저장된 원본 행 데이터가 없습니다</span>
          </div>
        ) : (
          <JpkGrid<Record<string, unknown>>
            columnDefs={cols}
            rowData={originalRows}
            getRowId={(d) => String((d as { _key?: string })._key ?? Math.random())}
            storageKey="jpk.grid.input-history.detail"
          />
        )}
      </div>
    </div>
  );
}
