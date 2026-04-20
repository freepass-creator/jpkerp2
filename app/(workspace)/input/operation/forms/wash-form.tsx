'use client';

import { useState } from 'react';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';

const WASH_TYPES = ['외부세차', '실내크리닝', '풀세차', '광택', '언더코팅', '기타'];

export function WashForm() {
  const [washType, setWashType] = useState('외부세차');

  return (
    <OpFormBase
      eventType="wash"
      buildPayload={(d) => ({
        title: d.title || washType,
        wash_type: washType,
        vendor: d.vendor,
        amount: Number(String(d.amount ?? '').replace(/,/g, '')) || 0,
        work_status: '완료',
        memo: d.memo,
      })}
    >
      <div className="form-section-title">
        <i className="ph ph-drop" />세차 · 크리닝
      </div>
      <div className="form-grid">
        <Field label="세차 구분" required span={2}>
          <BtnGroup value={washType} onChange={setWashType} options={WASH_TYPES} />
        </Field>
        <Field label="업체">
          <TextInput name="vendor" placeholder="세차업체" />
        </Field>
        <Field label="금액" required>
          <NumberInput name="amount" required placeholder="0" />
        </Field>
        <Field label="제목">
          <TextInput name="title" placeholder="생략 가능" />
        </Field>
        <Field label="메모" span={2}>
          <TextArea name="memo" rows={2} />
        </Field>
      </div>
    </OpFormBase>
  );
}
