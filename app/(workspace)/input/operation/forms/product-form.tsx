'use client';

import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, Select, TextArea } from '@/components/form/field';

const WORK_KINDS = ['외관 점검', '내부 크리닝', '소모품 교체', '수리', '상품촬영', '기타'];
const WORK_STATUS = ['입고', '작업중', '완료'];

export function ProductForm() {
  return (
    <OpFormBase
      eventType="product"
      buildPayload={(d) => ({
        title: d.title || d.work_kind || '상품화',
        work_kind: d.work_kind,
        work_status: d.work_status || '작업중',
        vendor: d.vendor,
        amount: Number(String(d.amount ?? '').replace(/,/g, '')) || 0,
        mileage: Number(String(d.mileage ?? '').replace(/,/g, '')) || undefined,
        memo: d.memo,
      })}
    >
      <div className="form-section-title">
        <i className="ph ph-sparkle" />상품화 작업
      </div>
      <div className="form-grid">
        <Field label="작업 구분" required>
          <Select name="work_kind" options={WORK_KINDS} required />
        </Field>
        <Field label="진행 상태">
          <Select name="work_status" options={WORK_STATUS} defaultValue="완료" />
        </Field>
        <Field label="업체">
          <TextInput name="vendor" />
        </Field>
        <Field label="금액" required>
          <NumberInput name="amount" required placeholder="0" />
        </Field>
        <Field label="주행거리">
          <NumberInput name="mileage" />
        </Field>
        <Field label="제목">
          <TextInput name="title" placeholder="생략 가능" />
        </Field>
        <Field label="메모" span={3}>
          <TextArea name="memo" rows={3} />
        </Field>
      </div>
    </OpFormBase>
  );
}
