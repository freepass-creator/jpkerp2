'use client';

import { useState } from 'react';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, DateInput, TextArea, PhoneInput } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';

const ACTIONS = ['전화독촉', '문자발송', '내용증명발송', '법적조치예고', '법적조치진행', '기타'];
const RESULTS = ['납부약속', '즉시납부', '연락불가', '거부', '기타'];

export function CollectForm() {
  const [action, setAction] = useState('전화독촉');
  const [result, setResult] = useState('납부약속');
  const [phone, setPhone] = useState('');

  return (
    <OpFormBase
      eventType="collect"
      buildPayload={(d) => ({
        title: d.title || `${action} · ${result}`,
        collect_action: action,
        collect_result: result,
        customer_name: d.customer_name,
        customer_phone: phone || undefined,
        unpaid_amount: Number(String(d.unpaid_amount ?? '').replace(/,/g, '')) || undefined,
        promise_date: d.promise_date,
        promise_amount: Number(String(d.promise_amount ?? '').replace(/,/g, '')) || undefined,
        memo: d.memo,
      })}
    >
      <div className="form-section-title">
        <i className="ph ph-envelope" />미수 관리 · 독촉
      </div>
      <div className="form-grid">
        <Field label="조치" required span={3}>
          <BtnGroup value={action} onChange={setAction} options={ACTIONS} />
        </Field>
        <Field label="결과" required span={3}>
          <BtnGroup value={result} onChange={setResult} options={RESULTS} />
        </Field>
        <Field label="고객명">
          <TextInput name="customer_name" />
        </Field>
        <Field label="연락처">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <Field label="미수금액">
          <NumberInput name="unpaid_amount" placeholder="0" />
        </Field>
        <Field label="약속납부일">
          <DateInput name="promise_date" />
        </Field>
        <Field label="약속 금액">
          <NumberInput name="promise_amount" placeholder="0" />
        </Field>
        <Field label="제목">
          <TextInput name="title" placeholder="생략 가능" />
        </Field>
        <Field label="상세 내용" span={3}>
          <TextArea name="memo" rows={3} placeholder="통화 내용·고객 반응·다음 조치 예정" />
        </Field>
      </div>
    </OpFormBase>
  );
}
