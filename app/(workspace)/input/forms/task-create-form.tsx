'use client';

import { useState } from 'react';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, DateInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { EntityPicker } from '@/components/form/entity-picker';
import { CarNumberPicker } from '@/components/form/car-number-picker';

const PRIORITY = ['낮음', '보통', '높음', '긴급'];
const STATE = ['대기', '진행중', '완료', '보류'];

interface UserRec extends Record<string, unknown> { _key?: string; name?: string; email?: string; department?: string; role?: string }

export function TaskCreateForm() {
  const [priority, setPriority] = useState('보통');
  const [state, setState] = useState('대기');
  const [carNumber, setCarNumber] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [assigneeUid, setAssigneeUid] = useState('');

  return (
    <InputFormShell
      collection="tasks"
      validate={(d) => (!d.title ? '업무 제목을 입력하세요' : null)}
      buildPayload={(d) => ({
        title: d.title,
        assignee_uid: assigneeUid || undefined,
        assignee_name: assigneeName || undefined,
        car_number: carNumber || undefined,
        due_date: d.due_date || undefined,
        priority,
        state,
        memo: d.memo || undefined,
      })}
      onSaved={() => {
        setCarNumber('');
        setAssigneeName('');
        setAssigneeUid('');
      }}
    >
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-check-square" />업무 정보</div>
        <div className="form-grid">
          <Field label="제목" required span={3}>
            <TextInput name="title" placeholder="예: 보험 만기 연락" autoFocus required />
          </Field>
          <Field label="담당자">
            <EntityPicker<UserRec>
              collection="users"
              value={assigneeName}
              onChange={(v, rec) => {
                setAssigneeName(v);
                setAssigneeUid(rec?._key ?? '');
              }}
              primaryField="name"
              secondaryField="department"
              tertiaryField="role"
              searchFields={['name', 'email', 'department']}
              placeholder="이름 또는 부서"
            />
          </Field>
          <Field label="관련 차량번호">
            <CarNumberPicker
              value={carNumber}
              onChange={(v) => setCarNumber(v)}
              placeholder="생략 가능"
            />
          </Field>
          <Field label="마감일">
            <DateInput name="due_date" />
          </Field>
          <Field label="우선순위" span={3}>
            <BtnGroup value={priority} onChange={setPriority} options={PRIORITY} />
          </Field>
          <Field label="상태" span={3}>
            <BtnGroup value={state} onChange={setState} options={STATE} />
          </Field>
          <Field label="상세" span={3}>
            <TextArea name="memo" rows={4} placeholder="업무 내용 · 진행 방법" />
          </Field>
        </div>
      </div>
    </InputFormShell>
  );
}
