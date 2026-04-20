'use client';

import { useState } from 'react';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, DateInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';

const PENALTY_TYPES = ['주정차위반', '속도위반', '신호위반', '버스전용', '기타'];
const PAYERS = ['고객부담', '회사부담'];
const PAID_STATES = ['미납', '납부완료'];

export function PenaltyForm() {
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [penaltyType, setPenaltyType] = useState(PENALTY_TYPES[0]);
  const [payer, setPayer] = useState('고객부담');
  const [paidState, setPaidState] = useState('미납');

  return (
    <OpFormBase
      eventType="penalty"
      uploaderLabel="고지서"
      onOcrExtract={(r) => {
        if (r.amount) setAmount(String(r.amount));
        if (r.date) setIssueDate(r.date);
      }}
      buildPayload={(d) => ({
        title: d.title || `${penaltyType} · ${payer}`,
        penalty_type: penaltyType,
        issue_date: issueDate || d.issue_date,
        due_date: d.due_date,
        location: d.location,
        amount: Number(String(amount).replace(/,/g, '')) || 0,
        payer,
        paid: paidState === '납부완료',
        paid_status: paidState,
        customer_name: d.customer_name,
        memo: d.memo,
      })}
    >
      <div className="form-section-title">
        <i className="ph ph-receipt" />과태료 등록
      </div>
      <div className="form-grid">
        <Field label="위반유형" required span={2}>
          <BtnGroup value={penaltyType} onChange={setPenaltyType} options={PENALTY_TYPES} />
        </Field>
        <Field label="부담자" required span={2}>
          <BtnGroup value={payer} onChange={setPayer} options={PAYERS} />
        </Field>
        <Field label="납부여부" required span={2}>
          <BtnGroup value={paidState} onChange={setPaidState} options={PAID_STATES} />
        </Field>
        <Field label="위반일">
          <DateInput value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </Field>
        <Field label="납부기한">
          <DateInput name="due_date" />
        </Field>
        <Field label="발생 장소">
          <TextInput name="location" />
        </Field>
        <Field label="금액" required>
          <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0" />
        </Field>
        <Field label="고객명">
          <TextInput name="customer_name" />
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
