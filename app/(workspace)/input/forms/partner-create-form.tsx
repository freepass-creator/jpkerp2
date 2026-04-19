'use client';

import { useState } from 'react';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, PhoneInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';

export function PartnerCreateForm() {
  const [phone, setPhone] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [status, setStatus] = useState('active');

  return (
    <InputFormShell
      collection="partners"
      validate={(d) => {
        if (!d.partner_code) return '회원사 코드를 입력하세요';
        if (!d.partner_name) return '회원사 이름을 입력하세요';
        return null;
      }}
      buildPayload={(d) => ({
        partner_code: d.partner_code.toUpperCase(),
        partner_name: d.partner_name,
        ceo: d.ceo || undefined,
        biz_no: d.biz_no || undefined,
        phone: phone || undefined,
        address: d.address || undefined,
        contact_name: d.contact_name || undefined,
        contact_phone: contactPhone || undefined,
        email: d.email || undefined,
        note: d.note || undefined,
        status,
      })}
      onSaved={() => { setPhone(''); setContactPhone(''); }}
    >
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-buildings" />회원사 기본정보</div>
        <div className="form-grid">
          <Field label="회원사 코드" required>
            <TextInput name="partner_code" placeholder="예: JPK" required autoFocus style={{ textTransform: 'uppercase', fontFamily: 'monospace' }} />
          </Field>
          <Field label="회원사명" required>
            <TextInput name="partner_name" required />
          </Field>
          <Field label="대표자">
            <TextInput name="ceo" />
          </Field>
          <Field label="사업자번호">
            <TextInput name="biz_no" placeholder="000-00-00000" />
          </Field>
          <Field label="대표전화">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="이메일">
            <TextInput name="email" type="email" autoComplete="off" />
          </Field>
          <Field label="주소" span={3}>
            <TextInput name="address" />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-user" />담당자</div>
        <div className="form-grid">
          <Field label="담당자명">
            <TextInput name="contact_name" />
          </Field>
          <Field label="담당자 연락처">
            <PhoneInput value={contactPhone} onChange={setContactPhone} />
          </Field>
          <Field label="상태" span={3}>
            <BtnGroup value={status} onChange={setStatus} options={['active', 'inactive']} />
          </Field>
          <Field label="비고" span={3}>
            <TextArea name="note" rows={3} placeholder="정산주기·수수료·특이사항" />
          </Field>
        </div>
      </div>
    </InputFormShell>
  );
}
