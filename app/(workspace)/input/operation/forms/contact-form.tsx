'use client';

import { useState } from 'react';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { useTitles } from '@/lib/hooks/useOpPrefs';

const CONTACT_TYPES = ['일반문의', '컴플레인', '계약문의', '정비요청', '사고접수', '반납협의', '연장문의', '기타'];
const RESULTS = ['진행중', '처리완료', '보류', '처리불가'];

export function ContactForm() {
  const [contactType, setContactType] = useState('일반문의');
  const [result, setResult] = useState('진행중');
  const titles = useTitles('contact');

  return (
    <OpFormBase
      eventType="contact"
      buildPayload={(d) => {
        if (d.title) titles.add(d.title);
        return {
          title: d.title || contactType,
          contact_type: contactType,
          contact_result: result,
          memo: d.memo,
        };
      }}
    >
      <div className="form-section-title">
        <i className="ph ph-phone" />고객 소통
      </div>
      <div className="form-grid">
        <Field label="유형" required span={2}>
          <BtnGroup value={contactType} onChange={setContactType} options={CONTACT_TYPES} />
        </Field>
        <Field label="처리 결과" required span={2}>
          <BtnGroup value={result} onChange={setResult} options={RESULTS} />
        </Field>
        <Field label="제목" span={2}>
          <TextInput
            name="title"
            placeholder="예: 미납 문의, 차량 사용문의"
            list="contact-titles"
          />
          <datalist id="contact-titles">
            {titles.list.map((t) => <option key={t} value={t} />)}
          </datalist>
        </Field>
        <Field label="처리 내용" span={2}>
          <TextArea name="memo" placeholder="응대 내용 상세" rows={4} />
        </Field>
      </div>
    </OpFormBase>
  );
}
