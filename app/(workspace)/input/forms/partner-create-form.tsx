'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, PhoneInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { ocrFile } from '@/lib/ocr';
import { detectBusinessReg, parseBusinessReg } from '@/lib/parsers/business-reg';

export function PartnerCreateForm() {
  const [phone, setPhone] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [status, setStatus] = useState('활성');
  const [partnerName, setPartnerName] = useState('');
  const [ceo, setCeo] = useState('');
  const [bizNo, setBizNo] = useState('');
  const [corpNo, setCorpNo] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [industry, setIndustry] = useState('');
  const [category, setCategory] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [contactName, setContactName] = useState('');
  const [note, setNote] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleOcr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrBusy(true);
    try {
      const result = await ocrFile(file);
      if (!detectBusinessReg(result.text)) {
        toast.warning('사업자등록증 양식이 아닙니다');
        return;
      }
      const parsed = parseBusinessReg(result.text);
      if (parsed.partner_name) setPartnerName(parsed.partner_name);
      if (parsed.ceo) setCeo(parsed.ceo);
      if (parsed.biz_no) setBizNo(parsed.biz_no);
      if (parsed.corp_no) setCorpNo(parsed.corp_no);
      if (parsed.address) setAddress(parsed.address);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.industry) setIndustry(parsed.industry);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.open_date) setOpenDate(parsed.open_date);
      toast.success('사업자등록증 OCR 완료 — 항목을 검토 후 저장하세요');
    } catch (err) {
      toast.error(`OCR 실패: ${(err as Error).message}`);
    } finally {
      setOcrBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <InputFormShell
      collection="partners"
      validate={() => {
        if (!partnerName) return '회원사 이름을 입력하세요';
        if (!bizNo) return '사업자등록번호를 입력하세요';
        if (!corpNo) return '법인등록번호를 입력하세요';
        return null;
      }}
      buildPayload={() => ({
        partner_name: partnerName,
        ceo: ceo || undefined,
        biz_no: bizNo,
        corp_no: corpNo,
        open_date: openDate || undefined,
        phone: phone || undefined,
        address: address || undefined,
        industry: industry || undefined,
        category: category || undefined,
        email: email || undefined,
        contact_name: contactName || undefined,
        contact_phone: contactPhone || undefined,
        note: note || undefined,
        biz_status: status,
      })}
      onSaved={() => {
        setPhone(''); setContactPhone('');
        setPartnerName(''); setCeo(''); setBizNo(''); setCorpNo('');
        setAddress(''); setEmail(''); setIndustry(''); setCategory(''); setOpenDate('');
        setContactName(''); setNote('');
      }}
    >
      <div className="form-section">
        <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ph ph-buildings" />회원사 기본정보
          <div style={{ marginLeft: 'auto' }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleOcr}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => fileRef.current?.click()}
              disabled={ocrBusy}
            >
              <i className={`ph ${ocrBusy ? 'ph-spinner spin' : 'ph-scan'}`} />
              {ocrBusy ? 'OCR 중...' : '사업자등록증 OCR'}
            </button>
          </div>
        </div>
        <div className="form-grid">
          <Field label="회원사명" required>
            <TextInput value={partnerName} onChange={(e) => setPartnerName(e.target.value)} required autoFocus />
          </Field>
          <Field label="대표자">
            <TextInput value={ceo} onChange={(e) => setCeo(e.target.value)} />
          </Field>
          <Field label="사업자등록번호" required>
            <TextInput value={bizNo} onChange={(e) => setBizNo(e.target.value)} placeholder="000-00-00000" required />
          </Field>
          <Field label="법인등록번호" required>
            <TextInput value={corpNo} onChange={(e) => setCorpNo(e.target.value)} placeholder="000000-0000000" required />
          </Field>
          <Field label="개업연월일">
            <TextInput value={openDate} onChange={(e) => setOpenDate(e.target.value)} placeholder="2023-03-30" />
          </Field>
          <Field label="이메일">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="off" />
          </Field>
          <Field label="대표전화">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="업태">
            <TextInput value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="예: 서비스업" />
          </Field>
          <Field label="종목">
            <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 자동차 임대업(렌트카)" />
          </Field>
          <Field label="주소" span={3}>
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
        <div className="text-2xs text-text-muted" style={{ marginTop: 8 }}>
          <i className="ph ph-info" style={{ marginRight: 4 }} />
          회원사 코드(PT00000)는 저장 시 자동 생성됩니다
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-user" />담당자</div>
        <div className="form-grid">
          <Field label="담당자명">
            <TextInput value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label="담당자 연락처">
            <PhoneInput value={contactPhone} onChange={setContactPhone} />
          </Field>
          <Field label="상태" span={3}>
            <BtnGroup value={status} onChange={setStatus} options={['활성', '비활성']} />
          </Field>
          <Field label="비고" span={3}>
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="정산주기·수수료·특이사항" />
          </Field>
        </div>
      </div>
    </InputFormShell>
  );
}
