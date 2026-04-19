'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import { Field, TextInput, PhoneInput } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { useSaveStore } from '@/lib/hooks/useSaveStatus';
import { fmtDate } from '@/lib/utils';

interface UserRecord {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  position?: string;
  join_date?: string;
  status?: string;
  partner_code?: string;
  note?: string;
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: '최고관리자',
  admin: '관리자',
  manager: '매니저',
  operator: '직원',
  staff: '직원',
  viewer: '열람자',
  pending: '승인대기',
};

export function MyClient() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<UserRecord>({});
  const [saving, setSaving] = useState(false);

  const queryKey = ['users', user?.uid] as const;
  const { data: record, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.uid) return {} as UserRecord;
      const snap = await get(ref(getRtdb(), `users/${user.uid}`));
      return (snap.exists() ? snap.val() : {}) as UserRecord;
    },
    enabled: !!user?.uid,
  });

  useEffect(() => {
    if (record) setForm(record);
  }, [record]);

  const set = <K extends keyof UserRecord>(k: K, v: UserRecord[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!user?.uid) return;
    setSaving(true);
    const store = useSaveStore.getState();
    store.begin('저장 중');
    try {
      await update(ref(getRtdb(), `users/${user.uid}`), {
        ...form,
        updated_at: serverTimestamp(),
      });
      qc.setQueryData(queryKey, form);
      store.success('저장 완료');
      toast.success('프로필 저장 완료');
    } catch (err) {
      store.fail((err as Error).message || '저장 실패');
      toast.error(`저장 실패: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-text-muted" style={{ height: '100%', minHeight: 200 }}>
        <i className="ph ph-spinner spin" />불러오는 중...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-text-muted">로그인 정보를 찾을 수 없습니다.</div>
    );
  }

  const initials = (form.name || user.email || '?').slice(0, 1).toUpperCase();
  const dirty = JSON.stringify(record) !== JSON.stringify(form);

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 20,
          background: 'var(--c-bg-sub)',
          border: '1px solid var(--c-border)',
          borderRadius: 2,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 56, height: 56,
            borderRadius: '50%',
            background: 'var(--c-primary)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {form.name ?? user.displayName ?? user.email ?? '-'}
          </div>
          <div className="text-text-sub" style={{ fontSize: 12, marginTop: 2 }}>
            {user.email}
            {form.role && <span style={{ marginLeft: 8 }}>· {ROLE_LABEL[form.role] ?? form.role}</span>}
            {form.join_date && <span style={{ marginLeft: 8 }}>· 입사 {fmtDate(form.join_date)}</span>}
          </div>
        </div>
      </div>

      {/* 편집 폼 */}
      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-user" />기본 정보
        </div>
        <div className="form-grid">
          <Field label="이름" required>
            <TextInput value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="연락처">
            <PhoneInput value={form.phone ?? ''} onChange={(v) => set('phone', v)} />
          </Field>
          <Field label="이메일">
            <TextInput value={user.email ?? ''} readOnly />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-briefcase" />근무 정보
        </div>
        <div className="form-grid">
          <Field label="부서">
            <TextInput value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} />
          </Field>
          <Field label="직책">
            <TextInput value={form.position ?? ''} onChange={(e) => set('position', e.target.value)} />
          </Field>
          <Field label="회원사">
            <TextInput value={form.partner_code ?? ''} onChange={(e) => set('partner_code', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-shield" />권한
          <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 400, marginLeft: 6 }}>
            (변경은 관리자에게 문의)
          </span>
        </div>
        <div className="form-grid">
          <Field label="역할" span={3}>
            <BtnGroup
              value={form.role ?? 'staff'}
              onChange={() => { /* 관리자만 변경 */ }}
              options={Object.keys(ROLE_LABEL).filter((k) => k !== 'pending')}
            />
          </Field>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => setForm(record ?? {} as UserRecord)}
          disabled={saving || !dirty}
        >
          되돌리기
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={save}
          disabled={saving || !dirty}
        >
          <i className={`ph ${saving ? 'ph-spinner spin' : 'ph-check'}`} />
          {saving ? '저장 중' : '저장'}
        </button>
      </div>
    </div>
  );
}
