'use client';

import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, Select, TextArea } from '@/components/form/field';

const MAINT_TYPES = ['엔진오일', '타이어', '브레이크', '배터리', '에어컨', '정기점검', '기능수리', '기타'];
const STATUS = ['입고', '작업중', '완료'];

export function MaintForm() {
  return (
    <OpFormBase
      eventType="maint"
      buildPayload={(d) => ({
        title: d.title || '정비',
        maint_type: d.maint_type,
        vendor: d.vendor,
        work_status: d.work_status || '입고',
        amount: Number(String(d.amount ?? '').replace(/,/g, '')) || 0,
        mileage: Number(String(d.mileage ?? '').replace(/,/g, '')) || undefined,
        memo: d.memo,
      })}
    >
      <div className="form-section-title">
        <i className="ph ph-wrench" />정비 등록
      </div>
      <div className="form-grid">
        <Field label="정비 구분" required>
          <Select name="maint_type" options={MAINT_TYPES} required />
        </Field>
        <Field label="진행 상태">
          <Select name="work_status" options={STATUS} defaultValue="완료" />
        </Field>
        <Field label="업체">
          <TextInput name="vendor" placeholder="정비업체명" />
        </Field>
        <Field label="금액" required>
          <NumberInput name="amount" placeholder="0" required />
        </Field>
        <Field label="주행거리 (km)">
          <NumberInput name="mileage" placeholder="현재 주행거리" />
        </Field>
        <Field label="제목">
          <TextInput name="title" placeholder="간단 제목 (생략 가능)" />
        </Field>
        <Field label="상세 메모" span={3}>
          <TextArea name="memo" placeholder="교체 부품·증상·결과 등" rows={3} />
        </Field>
      </div>
    </OpFormBase>
  );
}
