'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ref, get, set } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { EditableField } from '@/components/shared/editable-field';
import { toast } from 'sonner';

const FIELDS: Array<{ k: string; l: string; span?: number }> = [
  { k: 'biz_name', l: '상호' },
  { k: 'biz_no', l: '사업자번호' },
  { k: 'ceo', l: '대표자' },
  { k: 'phone', l: '대표전화' },
  { k: 'address', l: '주소', span: 2 },
  { k: 'biz_type', l: '업태' },
  { k: 'biz_item', l: '종목' },
  { k: 'bank_name', l: '입금은행' },
  { k: 'bank_account', l: '입금계좌' },
  { k: 'bank_holder', l: '예금주' },
];

const QK = ['settings', 'company'];

async function fetchCompany(): Promise<Record<string, string>> {
  const snap = await get(ref(getRtdb(), 'settings/company'));
  return (snap.val() as Record<string, string>) ?? {};
}

export function CompanyClient() {
  const qc = useQueryClient();
  const { data = {}, isLoading } = useQuery({
    queryKey: QK,
    queryFn: fetchCompany,
  });

  const save = (field: string) => async (v: string) => {
    const next = { ...data, [field]: v };
    qc.setQueryData(QK, next);
    try {
      await set(ref(getRtdb(), 'settings/company'), next);
    } catch (e) {
      qc.invalidateQueries({ queryKey: QK });
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-text-muted" style={{ padding: 40 }}>
        <i className="ph ph-spinner spin" /> 로드 중...
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--panel-body-pad)', maxWidth: 800 }}>
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.k} style={{ gridColumn: f.span ? `span ${f.span}` : undefined }}>
            <EditableField label={f.l} value={data[f.k] ?? ''} onSave={save(f.k)} />
          </div>
        ))}
      </div>
    </div>
  );
}
