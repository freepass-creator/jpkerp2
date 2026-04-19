'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ref as rtdbRef, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { useAssetByCar } from '@/lib/hooks/useLookups';
import { useOpContext } from '../op-context-store';

const ACTIONS = ['전달', '회수', '분실', '복제'];
const KEY_FIELDS = [
  { key: 'key_main', label: '메인키' },
  { key: 'key_sub', label: '보조키' },
  { key: 'key_card', label: '카드키' },
  { key: 'key_etc', label: '기타' },
];

export function KeyForm() {
  const [keyAction, setKeyAction] = useState(ACTIONS[0]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setFlags((s) => ({ ...s, [k]: !s[k] }));

  const { carNumber } = useOpContext();
  const asset = useAssetByCar(carNumber);

  return (
    <OpFormBase
      eventType="key"
      buildPayload={(d) => ({
        title: `차키 ${keyAction}`,
        key_action: keyAction,
        key_main: !!flags.key_main,
        key_sub: !!flags.key_sub,
        key_card: !!flags.key_card,
        key_etc: !!flags.key_etc,
        key_info: d.key_info,
        memo: d.memo,
      })}
      afterSave={async () => {
        // 분실 시 자산 key_count -1, 복제 시 +1
        if (!carNumber) return;
        if (!asset?._key) return;
        const cur = Number(asset.key_count ?? 2);
        let next = cur;
        if (keyAction === '분실') next = Math.max(0, cur - 1);
        else if (keyAction === '복제') next = cur + 1;
        if (next !== cur) {
          try {
            await update(rtdbRef(getRtdb(), `assets/${asset._key}`), {
              key_count: next,
              updated_at: serverTimestamp(),
            });
            toast.info(`차키 ${next > cur ? '+1' : '-1'} 자동 반영 (현재 ${next}개)`);
          } catch (err) {
            toast.error(`차키 수량 반영 실패: ${(err as Error).message}`);
          }
        }
      }}
    >
      <div className="form-section-title">
        <i className="ph ph-key" />차키 업무
      </div>
      <div className="form-grid">
        <Field label="구분" required span={3}>
          <BtnGroup value={keyAction} onChange={setKeyAction} options={ACTIONS} />
        </Field>
      </div>

      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-list-checks" />키 종류</div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {KEY_FIELDS.map((it) => (
            <label
              key={it.key}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={!!flags[it.key]}
                onChange={() => toggle(it.key)}
                style={{ width: 14, height: 14 }}
              />
              {it.label}
            </label>
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-note" />메모</div>
        <div className="form-grid">
          <Field label="키번호 / 보관 위치" span={3}>
            <TextInput name="key_info" placeholder="키번호 또는 보관 위치" />
          </Field>
          <Field label="상세 메모" span={3}>
            <TextArea name="memo" rows={2} placeholder="특이사항" />
          </Field>
        </div>
      </div>
    </OpFormBase>
  );
}
