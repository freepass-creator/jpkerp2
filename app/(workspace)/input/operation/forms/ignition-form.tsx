'use client';

import { useState, useMemo } from 'react';
import { OpFormBase, syncContractActionStatus } from '../op-form-base';
import { Field, TextArea, NumberInput, TextInput } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import type { RtdbContract } from '@/lib/types/rtdb-entities';
import { useOpContext } from '../op-context-store';

type Action = '시동제어' | '제어해제';

const REASONS_LOCK = ['미납', '연락두절', '계약위반', '기타'];
const REASONS_UNLOCK = ['납부완료', '분할합의', '기타'];

export function IgnitionForm() {
  const [action, setAction] = useState<Action>('시동제어');
  const [reason, setReason] = useState<string>('미납');
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const { carNumber } = useOpContext();

  const reasonOptions = useMemo(
    () => (action === '시동제어' ? REASONS_LOCK : REASONS_UNLOCK),
    [action],
  );

  return (
    <OpFormBase
      eventType="ignition"
      buildPayload={(d) => ({
        title: `${action} · ${reason}`,
        ignition_action: action,
        ignition_reason: reason,
        unpaid_amount: Number(String(d.unpaid_amount ?? '').replace(/,/g, '')) || undefined,
        handler: d.handler,
        memo: d.memo,
      })}
      afterSave={async () => {
        const target = contracts.data.find(
          (c) => c.car_number === carNumber && c.status !== 'deleted' && c.contractor_name?.trim(),
        );
        if (target?._key) {
          await syncContractActionStatus(target._key, action);
        }
      }}
    >
      <div className="form-section-title">
        <i className="ph ph-engine" />시동제어 · 해제
      </div>
      <div className="form-grid">
        <Field label="조치구분" required span={3}>
          <BtnGroup
            value={action}
            onChange={(v) => {
              setAction(v as Action);
              setReason(v === '시동제어' ? REASONS_LOCK[0] : REASONS_UNLOCK[0]);
            }}
            options={['시동제어', '제어해제']}
          />
        </Field>
        <Field label="사유" span={3}>
          <BtnGroup value={reason} onChange={setReason} options={reasonOptions} />
        </Field>
        <Field label="미납액">
          <NumberInput name="unpaid_amount" placeholder="0" />
        </Field>
        <Field label="담당자">
          <TextInput name="handler" />
        </Field>
        <Field label="상세내역" span={3}>
          <TextArea name="memo" rows={3} placeholder="고객 대응·향후 계획" />
        </Field>
      </div>
    </OpFormBase>
  );
}
