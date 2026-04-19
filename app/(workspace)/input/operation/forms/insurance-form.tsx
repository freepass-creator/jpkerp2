'use client';

import { useState } from 'react';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { FavChips } from '@/components/form/fav-chips';
import { useInsuranceCompanies } from '@/lib/hooks/useOpPrefs';

const KINDS = ['배서(연령변경)', '신규가입', '갱신', '해지', '보험청구', '기타'];
const AGE_AFTER = ['21세', '26세', '만30세', '만35세', '전연령'];

export function InsuranceForm() {
  const [kind, setKind] = useState('배서(연령변경)');
  const [ageAfter, setAgeAfter] = useState('만30세');
  const [insCompany, setInsCompany] = useState('');
  const insCo = useInsuranceCompanies();

  return (
    <OpFormBase
      eventType="insurance"
      buildPayload={(d) => {
        if (insCompany) insCo.use(insCompany);
        return {
          title: d.title || `${kind} · ${insCompany}`,
          ins_kind: kind,
          insurance_company: insCompany,
          age_after: kind === '배서(연령변경)' ? ageAfter : undefined,
          amount: Number(String(d.amount ?? '').replace(/,/g, '')) || 0,
          memo: d.memo,
        };
      }}
    >
      <div className="form-section-title">
        <i className="ph ph-shield-check" />보험 관리
      </div>
      <div className="form-grid">
        <Field label="업무 구분" required span={3}>
          <BtnGroup value={kind} onChange={setKind} options={KINDS} />
        </Field>
        <Field label="보험사" required>
          <TextInput
            value={insCompany}
            onChange={(e) => setInsCompany(e.target.value)}
            required
            autoComplete="off"
            placeholder="예: 삼성화재"
          />
          <FavChips
            items={insCo.list}
            onPick={setInsCompany}
            onDelete={(v) => insCo.remove(v)}
          />
        </Field>
        <Field label="추가/환급 보험료" hint="추가:+ / 환급:-">
          <NumberInput name="amount" placeholder="0" />
        </Field>
        <Field label="제목">
          <TextInput name="title" placeholder="생략 가능" />
        </Field>

        {kind === '배서(연령변경)' && (
          <Field label="변경 후 연령" span={3}>
            <BtnGroup value={ageAfter} onChange={setAgeAfter} options={AGE_AFTER} />
          </Field>
        )}

        <Field label="메모" span={3}>
          <TextArea name="memo" rows={2} placeholder="특이사항" />
        </Field>
      </div>
    </OpFormBase>
  );
}
