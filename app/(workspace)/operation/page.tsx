'use client';

/**
 * 업무관리 (v3) — 12 탭 wizard 모음.
 *
 * 디자인은 jpkerp-v3/prototype.html `data-page="journal"` 기준이며,
 * 본 페이지는 wizard 디자인을 유지하면서 각 [저장] 버튼이 RTDB events 컬렉션에
 * 실제로 push 하도록 wire-up 됨 (Phase 11 — 입력 wire-up).
 */

import { useAuth } from '@/lib/auth/context';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { saveEvent } from '@/lib/firebase/events';
import { getRtdb } from '@/lib/firebase/rtdb';
import { uploadFiles } from '@/lib/firebase/storage';
import { sanitizeCarNumber } from '@/lib/format-input';
import { downloadSettlementPdf } from '@/lib/settlement-pdf';
import type { RtdbAsset, RtdbBilling, RtdbContract } from '@/lib/types/rtdb-entities';
import { ref, serverTimestamp, update } from 'firebase/database';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type SubpageId =
  | 'journal-upload'
  | 'journal-eungdae'
  | 'journal-suseon'
  | 'journal-sago'
  | 'journal-chulgo'
  | 'journal-banab'
  | 'journal-sidong'
  | 'journal-iyong'
  | 'journal-memo'
  | 'journal-yocheong'
  | 'journal-received'
  | 'journal-sent';

interface TabSpec {
  id: SubpageId;
  label: string;
  icon?: string;
  primaryAction?: string;
}

const TABS: TabSpec[] = [
  {
    id: 'journal-upload',
    label: '업로드',
    icon: 'ph-upload-simple',
    primaryAction: '+ 업로드 + 분석',
  },
  { id: 'journal-eungdae', label: '고객응대', primaryAction: '+ 응대 등록' },
  { id: 'journal-suseon', label: '차량수선', primaryAction: '+ 수선 등록' },
  { id: 'journal-sago', label: '사고접수', primaryAction: '+ 사고접수' },
  { id: 'journal-chulgo', label: '출고', primaryAction: '+ 출고 등록' },
  { id: 'journal-banab', label: '반납', primaryAction: '+ 반납 등록' },
  { id: 'journal-sidong', label: '시동제어', primaryAction: '+ 제어 실행' },
  { id: 'journal-iyong', label: '기타이용', primaryAction: '+ 이용 등록' },
  { id: 'journal-memo', label: '메모', primaryAction: '+ 메모' },
  { id: 'journal-yocheong', label: '요청등록', primaryAction: '+ 요청 발송' },
  { id: 'journal-received', label: '받은요청' },
  { id: 'journal-sent', label: '시킨요청' },
];

const TAB_CRUMB: Record<SubpageId, string> = {
  'journal-upload': '업로드',
  'journal-eungdae': '고객응대',
  'journal-suseon': '차량수선',
  'journal-sago': '사고접수',
  'journal-chulgo': '출고',
  'journal-banab': '반납',
  'journal-sidong': '시동제어',
  'journal-iyong': '기타이용',
  'journal-memo': '메모',
  'journal-yocheong': '요청등록',
  'journal-received': '받은요청',
  'journal-sent': '시킨요청',
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** URL `?tab=` 약자 → 내부 SubpageId 매핑 (gap-check route와 호환) */
const TAB_ALIAS: Record<string, SubpageId> = {
  upload: 'journal-upload',
  eungdae: 'journal-eungdae',
  consultation: 'journal-eungdae',
  suseon: 'journal-suseon',
  repair: 'journal-suseon',
  sago: 'journal-sago',
  accident: 'journal-sago',
  chulgo: 'journal-chulgo',
  release: 'journal-chulgo',
  banab: 'journal-banab',
  return: 'journal-banab',
  sidong: 'journal-sidong',
  ignition: 'journal-sidong',
  iyong: 'journal-iyong',
  memo: 'journal-memo',
  yocheong: 'journal-yocheong',
  request: 'journal-yocheong',
  received: 'journal-received',
  sent: 'journal-sent',
};

export interface OperationPrefill {
  topic?: string;
  contract?: string;
  car?: string;
  filter?: string;
  action?: string;
}

export default function OperationPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') ?? '';
  const initialTab = TAB_ALIAS[tabParam] ?? 'journal-upload';

  const [active, setActive] = useState<SubpageId>(initialTab);
  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];

  // URL `tab` 변경 시 sub-tab 동기화 (브라우저 back/forward 대응)
  // 사용자 클릭으로 active가 바뀐 경우 URL은 따라갈 필요 없음 — active 의존성 제외
  // biome-ignore lint/correctness/useExhaustiveDependencies: 의도적으로 tabParam만 추적
  useEffect(() => {
    const next = TAB_ALIAS[tabParam];
    if (next && next !== active) setActive(next);
  }, [tabParam]);

  const prefill: OperationPrefill = useMemo(
    () => ({
      topic: searchParams.get('topic') ?? undefined,
      contract: searchParams.get('contract') ?? undefined,
      car: searchParams.get('car') ?? undefined,
      filter: searchParams.get('filter') ?? undefined,
      action: searchParams.get('action') ?? undefined,
    }),
    [searchParams],
  );

  return (
    <>
      <div className="page-head">
        <i className="ph ph-notebook" />
        <div className="title">업무관리</div>
        <div className="crumbs">› {TAB_CRUMB[active]}</div>
      </div>

      <div className="v3-tabs">
        <div className="v3-tab-list" style={{ overflowX: 'auto', flex: 1, minWidth: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`v3-tab ${active === t.id ? 'is-active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.icon ? <i className={`ph ${t.icon}`} /> : null}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {active === 'journal-upload' && <UploadWizard />}
      {active === 'journal-eungdae' && <EungdaeWizard prefill={prefill} />}
      {active === 'journal-suseon' && <SuseonWizard />}
      {active === 'journal-sago' && <SagoWizard prefill={prefill} />}
      {active === 'journal-chulgo' && <ChulgoWizard />}
      {active === 'journal-banab' && <BanabWizard />}
      {active === 'journal-sidong' && <SidongWizard prefill={prefill} />}
      {active === 'journal-iyong' && <IyongWizard />}
      {active === 'journal-memo' && <MemoWizard />}
      {active === 'journal-yocheong' && <YocheongWizard />}
      {active === 'journal-received' && <ReceivedList />}
      {active === 'journal-sent' && <SentList />}
    </>
  );
}

/* ════════════════════════════════════════════════
   공용 토글 — option-btn group (single or multi)
   ════════════════════════════════════════════════ */

function OptionGroup({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: readonly string[];
  value: readonly string[];
  onChange: (value: readonly string[]) => void;
  multi?: boolean;
}) {
  const toggle = (opt: string) => {
    if (multi) {
      onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]);
    } else {
      onChange([opt]);
    }
  };
  return (
    <div className="option-row">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`option-btn ${value.includes(opt) ? 'is-selected' : ''}`}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* form-row 헬퍼 */
function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="v3-form-row">
      <div className={`label ${required ? 'required' : ''}`}>{label}</div>
      <div className="field">{children}</div>
    </div>
  );
}

/* wizard 셸 — onSubmit 받아서 [저장] 버튼 wire-up */
function WizardShell({
  icon,
  iconClass,
  title,
  desc,
  body,
  footDesc,
  footPrimary,
  footPrimaryDanger = false,
  saving,
  onSave,
  onCancel,
}: {
  icon: string;
  iconClass?: string;
  title: string;
  desc: string;
  body: ReactNode;
  footDesc?: ReactNode;
  footPrimary: string;
  footPrimaryDanger?: boolean;
  saving?: boolean;
  onSave: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  return (
    <div className="v3-wizard">
      <div className="v3-wizard-head">
        <i className={`ph ${icon} ico ${iconClass ?? ''}`} />
        <span className="title">{title}</span>
        <span className="desc">· {desc}</span>
      </div>
      <div className="v3-wizard-body">{body}</div>
      <div className="v3-wizard-foot">
        {footDesc && (
          <span className={`desc ${footPrimaryDanger ? 't-danger' : ''}`}>{footDesc}</span>
        )}
        <div className="actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            {onCancel ? '초기화' : '취소'}
          </button>
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={() => {
              void onSave();
            }}
          >
            {saving ? '저장 중...' : footPrimary}
          </button>
        </div>
      </div>
    </div>
  );
}

/* useWizardSave — 저장 공통 흐름: validate → saveEvent → toast → reset */
function useWizardSave() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (params: {
      payload: Record<string, unknown> & { type: string };
      validate?: () => string | null;
      successMsg?: string;
      onSuccess?: () => void | Promise<void>;
      files?: File[];
      filesBasePath?: string;
    }) => {
      const { payload, validate, successMsg, onSuccess, files, filesBasePath } = params;
      const err = validate?.();
      if (err) {
        toast.error(err);
        return;
      }
      setSaving(true);
      try {
        let photo_urls: string[] | undefined;
        if (files && files.length > 0 && filesBasePath) {
          photo_urls = await uploadFiles(filesBasePath, files);
        }
        const enriched: Parameters<typeof saveEvent>[0] = {
          ...payload,
          ...(photo_urls ? { photo_urls } : {}),
          handler_uid: user?.uid,
          handler: user?.displayName ?? user?.email ?? undefined,
          date: (typeof payload.date === 'string' ? payload.date : null) ?? todayStr(),
        };
        await saveEvent(enriched);
        toast.success(successMsg ?? '저장 완료');
        await onSuccess?.();
      } catch (e) {
        toast.error(`저장 실패: ${(e as Error).message}`);
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  return { saving, save };
}

/* ════════════════════════════════════════════════
   1. 업로드 — 다중 파일 첨부 + 종류 분류
   ════════════════════════════════════════════════ */
function UploadWizard() {
  const { user } = useAuth();
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState<readonly string[]>(['자동 분류']);
  const [memo, setMemo] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTarget('');
    setKind(['자동 분류']);
    setMemo('');
    setFiles([]);
  };

  const onSave = async () => {
    if (files.length === 0) {
      toast.error('첨부 파일을 선택하세요');
      return;
    }
    setSaving(true);
    try {
      const basePath = `events/upload/${user?.uid ?? 'anon'}/${Date.now()}`;
      const photo_urls = await uploadFiles(basePath, files);
      await saveEvent({
        type: 'upload',
        date: todayStr(),
        title: kind[0] ?? '업로드',
        car_number: target ? sanitizeCarNumber(target) : undefined,
        memo: memo || undefined,
        upload_kind: kind[0],
        photo_urls,
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
      });
      toast.success(`${files.length}개 파일 업로드 완료`);
      reset();
    } catch (e) {
      toast.error(`업로드 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <WizardShell
      icon="ph-upload-simple"
      title="업로드"
      desc="사진 OCR · PDF 추출 · 다중 첨부"
      footDesc={files.length > 0 ? `${files.length}개 파일 선택됨` : '파일을 선택한 뒤 저장하세요'}
      footPrimary="업로드"
      saving={saving}
      onSave={onSave}
      onCancel={reset}
      body={
        <>
          <FormRow label="첨부 파일" required>
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && <div className="hint">{files.map((f) => f.name).join(', ')}</div>}
          </FormRow>
          <FormRow label="대상 (선택)">
            <div className="picker-row">
              <input
                type="text"
                placeholder="차량번호 (없으면 미연결)"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="업로드 종류">
            <OptionGroup
              options={[
                '자동 분류',
                '차량등록증',
                '보험증권',
                '할부스케줄',
                '과태료',
                '견적서·청구서',
                '계약서',
                '사고 사진',
                '반납 사진',
                '기타',
              ]}
              value={kind}
              onChange={setKind}
            />
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="업로드 관련 메모 (선택)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   2. 고객응대
   ════════════════════════════════════════════════ */
function EungdaeWizard({ prefill }: { prefill?: OperationPrefill }) {
  const { saving, save } = useWizardSave();
  const billings = useRtdbCollection<RtdbBilling>('billings');

  // filter=overdue 일 때 가장 오래된 미납자 자동 선택 (target 비어있을 때만)
  const oldestOverdue = useMemo(() => {
    if (prefill?.filter !== 'overdue') return undefined;
    const t = todayStr();
    const overdue = billings.data.filter((b) => {
      const amount = Number(b.amount ?? 0);
      const paid = Number(b.paid_total ?? 0);
      if (amount <= 0 || paid >= amount) return false;
      if (!b.due_date || b.due_date >= t) return false;
      return Boolean(b.contract_code);
    });
    overdue.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    return overdue[0]?.contract_code;
  }, [prefill?.filter, billings.data]);

  const initialTarget = prefill?.contract ?? prefill?.car ?? oldestOverdue ?? '';

  const [channel, setChannel] = useState<readonly string[]>(['전화']);
  const [target, setTarget] = useState(initialTarget);
  const [topic, setTopic] = useState<readonly string[]>([prefill?.topic ?? '미납독촉']);
  const [actions, setActions] = useState<readonly string[]>([]);
  const [memo, setMemo] = useState('');

  // billings 로드 후 oldestOverdue 결정되면 자동 채움 (target이 비어있을 때만)
  // biome-ignore lint/correctness/useExhaustiveDependencies: target 비교는 초기 상태 전용
  useEffect(() => {
    if (!target && oldestOverdue) setTarget(oldestOverdue);
  }, [oldestOverdue]);

  const reset = () => {
    setChannel(['전화']);
    setTarget('');
    setTopic(['미납독촉']);
    setActions([]);
    setMemo('');
  };

  return (
    <WizardShell
      icon="ph-phone"
      title="고객응대"
      desc="통화·방문·민원·문의"
      footDesc="필수 3종 입력 완료 · 평균 30초 소요"
      footPrimary="저장"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'consultation',
            title: topic[0] ?? '고객응대',
            car_number: target ? sanitizeCarNumber(target) : undefined,
            contact_channel: channel[0],
            contact_topic: topic[0],
            contact_actions: actions,
            memo: memo || undefined,
          },
          validate: () => {
            if (!channel[0]) return '응대 방식을 선택하세요';
            if (!target) return '대상을 입력하세요';
            if (!topic[0]) return '주제를 선택하세요';
            return null;
          },
          successMsg: '고객응대 저장 완료',
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="응대 방식" required>
            <OptionGroup
              options={['전화', '방문', '문자', '이메일', '대면', '기타']}
              value={channel}
              onChange={setChannel}
            />
          </FormRow>
          <FormRow label="대상" required>
            <div className="picker-row">
              <input
                type="text"
                placeholder="계약자·차량번호·계약코드"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="hint">예: J0012 홍길동 / 12가 3456</div>
          </FormRow>
          <FormRow label="주제" required>
            <OptionGroup
              options={['미납독촉', '갱신문의', '사고문의', '서류요청', '신규문의', '민원', '기타']}
              value={topic}
              onChange={setTopic}
            />
          </FormRow>
          <FormRow label="조치">
            <OptionGroup
              options={['안내완료', '재연락약속', '입금약속', '담당자전달', '서류발송']}
              value={actions}
              onChange={setActions}
              multi
            />
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="결과·다음 액션 메모 (선택)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   3. 차량수선
   ════════════════════════════════════════════════ */
function SuseonWizard() {
  const { saving, save } = useWizardSave();
  const [maintType, setMaintType] = useState<readonly string[]>(['정기정비']);
  const [carNumber, setCarNumber] = useState('');
  const [vendor, setVendor] = useState<readonly string[]>([]);
  const [vendorCustom, setVendorCustom] = useState('');
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<readonly string[]>(['완료']);
  const [memo, setMemo] = useState('');

  const reset = () => {
    setMaintType(['정기정비']);
    setCarNumber('');
    setVendor([]);
    setVendorCustom('');
    setContent('');
    setAmount('');
    setResult(['완료']);
    setMemo('');
  };

  return (
    <WizardShell
      icon="ph-wrench"
      title="차량수선"
      desc="정비·수리·상품화·외관관리"
      footDesc="사진 첨부 권장"
      footPrimary="저장"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'vehicle_repair',
            title: content || maintType[0] || '수선',
            car_number: carNumber ? sanitizeCarNumber(carNumber) : undefined,
            maint_type: maintType[0],
            vendor: vendor[0] === '+ 신규' ? vendorCustom : vendor[0],
            content,
            amount: amount ? Number(amount.replace(/,/g, '')) : undefined,
            work_status: result[0],
            memo: memo || undefined,
          },
          validate: () => {
            if (!maintType[0]) return '수선 종류를 선택하세요';
            if (!carNumber) return '차량번호를 입력하세요';
            return null;
          },
          successMsg: '차량수선 저장 완료',
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="수선 종류" required>
            <OptionGroup
              options={['정기정비', '고장수리', '사고수리', '외관관리', '상품화', '점검만', '기타']}
              value={maintType}
              onChange={setMaintType}
            />
          </FormRow>
          <FormRow label="차량" required>
            <div className="picker-row">
              <input
                type="text"
                placeholder="차량번호"
                value={carNumber}
                onChange={(e) => setCarNumber(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="정비소">
            <OptionGroup
              options={['한국정비', '강남자동차정비', '토탈오토케어', '+ 신규']}
              value={vendor}
              onChange={setVendor}
            />
            {vendor[0] === '+ 신규' && (
              <input
                type="text"
                placeholder="신규 정비소 이름"
                value={vendorCustom}
                onChange={(e) => setVendorCustom(e.target.value)}
                style={{ marginTop: 6 }}
              />
            )}
          </FormRow>
          <FormRow label="내역">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="작업 내역"
            />
          </FormRow>
          <FormRow label="비용">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="원"
            />
          </FormRow>
          <FormRow label="결과">
            <OptionGroup
              options={['완료', '진행중', '미수리 복귀', '견적 대기']}
              value={result}
              onChange={setResult}
            />
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="작업 사진 첨부 또는 추가 메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   4. 사고접수
   ════════════════════════════════════════════════ */
function SagoWizard({ prefill }: { prefill?: OperationPrefill }) {
  const { saving, save } = useWizardSave();
  const [target, setTarget] = useState(prefill?.car ?? prefill?.contract ?? '');
  const [occurredAt, setOccurredAt] = useState('');
  const [location, setLocation] = useState('');
  const [accidentType, setAccidentType] = useState<readonly string[]>(['쌍방']);
  const [otherInfo, setOtherInfo] = useState('');
  const [insurance, setInsurance] = useState<readonly string[]>(['자차']);
  const [receiptNo, setReceiptNo] = useState('');
  const [memo, setMemo] = useState('');

  const reset = () => {
    setTarget('');
    setOccurredAt('');
    setLocation('');
    setAccidentType(['쌍방']);
    setOtherInfo('');
    setInsurance(['자차']);
    setReceiptNo('');
    setMemo('');
  };

  return (
    <WizardShell
      icon="ph-warning"
      iconClass="danger"
      title="사고접수"
      desc="사건 발생 + 보험접수"
      footDesc="사진 첨부 필수 — 보험금 청구 근거"
      footPrimary="저장"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'accident',
            title: `사고 ${accidentType[0] ?? ''}`.trim(),
            car_number: target ? sanitizeCarNumber(target) : undefined,
            occurred_at: occurredAt || undefined,
            date: occurredAt ? occurredAt.slice(0, 10) : todayStr(),
            location: location || undefined,
            accident_type: accidentType[0],
            other_party: otherInfo || undefined,
            insurance_kind: insurance[0],
            receipt_no: receiptNo || undefined,
            memo: memo || undefined,
          },
          validate: () => {
            if (!target) return '차량/계약을 입력하세요';
            if (!occurredAt) return '발생일시를 입력하세요';
            if (!accidentType[0]) return '사고 종류를 선택하세요';
            if (!insurance[0]) return '보험 처리를 선택하세요';
            return null;
          },
          successMsg: '사고접수 저장 완료',
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="차량/계약" required>
            <div className="picker-row">
              <input
                type="text"
                placeholder="차량번호·계약코드"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="발생일시" required>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </FormRow>
          <FormRow label="사고 장소">
            <input
              type="text"
              placeholder="주소 또는 위치"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </FormRow>
          <FormRow label="사고 종류" required>
            <OptionGroup
              options={['단독', '쌍방', '주차사고', '추돌', '도난', '침수', '기타']}
              value={accidentType}
              onChange={setAccidentType}
            />
          </FormRow>
          <FormRow label="상대 정보">
            <input
              type="text"
              placeholder="상대 차량번호·연락처·과실비율"
              value={otherInfo}
              onChange={(e) => setOtherInfo(e.target.value)}
            />
          </FormRow>
          <FormRow label="보험 처리" required>
            <OptionGroup
              options={['자차', '대물', '자손', '미신청']}
              value={insurance}
              onChange={setInsurance}
            />
          </FormRow>
          <FormRow label="접수번호">
            <input
              type="text"
              placeholder="보험사 접수번호"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
            />
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="사고 경위 메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   5. 출고
   ════════════════════════════════════════════════ */
function ChulgoWizard() {
  const { saving, save } = useWizardSave();
  const [contract, setContract] = useState('');
  const [date, setDate] = useState(todayStr());
  const [from, setFrom] = useState('차고지 A');
  const [to, setTo] = useState('');
  const [mileage, setMileage] = useState('');
  const [fuel, setFuel] = useState<readonly string[]>(['가득']);
  const [checks, setChecks] = useState<readonly string[]>([
    '키 2개',
    '매뉴얼',
    '블랙박스 정상',
    '외관 양호',
  ]);
  const [memo, setMemo] = useState('');

  const reset = () => {
    setContract('');
    setDate(todayStr());
    setFrom('차고지 A');
    setTo('');
    setMileage('');
    setFuel(['가득']);
    setChecks(['키 2개', '매뉴얼', '블랙박스 정상', '외관 양호']);
    setMemo('');
  };

  return (
    <WizardShell
      icon="ph-paper-plane-tilt"
      title="출고"
      desc="인도 체크리스트 (계약 시작)"
      footDesc="사진은 반납 정산 기준이 됩니다"
      footPrimary="출고 완료"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'release',
            title: `출고 ${contract}`.trim(),
            contract_code: contract || undefined,
            date,
            from_location: from || undefined,
            to_location: to || undefined,
            delivery_location: to || undefined,
            mileage: mileage ? Number(mileage.replace(/,/g, '')) : undefined,
            fuel_level: fuel[0],
            checklist: checks,
            memo: memo || undefined,
          },
          validate: () => {
            if (!contract) return '계약을 입력하세요';
            if (!mileage) return '주행거리를 입력하세요';
            return null;
          },
          successMsg: '출고 등록 완료',
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="계약" required>
            <div className="picker-row">
              <input
                type="text"
                placeholder="계약코드 또는 차량번호"
                value={contract}
                onChange={(e) => setContract(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="출고일자" required>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormRow>
          <FormRow label="출고지 → 인도지">
            <div className="picker-row">
              <input
                type="text"
                placeholder="차고지"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <input
                type="text"
                placeholder="고객 인도지"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="주행거리" required>
            <input
              type="text"
              placeholder="km"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
            />
          </FormRow>
          <FormRow label="연료 상태">
            <OptionGroup
              options={['가득', '3/4', '1/2', '1/4', '부족']}
              value={fuel}
              onChange={setFuel}
            />
          </FormRow>
          <FormRow label="체크리스트">
            <OptionGroup
              options={['키 2개', '매뉴얼', '블랙박스 정상', '외관 양호', '손상 (사진)']}
              value={checks}
              onChange={setChecks}
              multi
            />
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="외관·내부·주행거리 사진 (3~5장)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   6. 반납
   ════════════════════════════════════════════════ */
function BanabWizard() {
  const { saving, save } = useWizardSave();
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const assets = useRtdbCollection<RtdbAsset>('assets');
  const [contract, setContract] = useState('');
  const [reason, setReason] = useState<readonly string[]>(['정산반납 (만기)']);
  const [date, setDate] = useState(todayStr());
  const [mileage, setMileage] = useState('');
  const [fuel, setFuel] = useState<readonly string[]>(['1/2']);
  const [damage, setDamage] = useState('');
  const [extras, setExtras] = useState<readonly string[]>([]);
  const [deposit, setDeposit] = useState('');

  const reset = () => {
    setContract('');
    setReason(['정산반납 (만기)']);
    setDate(todayStr());
    setMileage('');
    setFuel(['1/2']);
    setDamage('');
    setExtras([]);
    setDeposit('');
  };

  /** 입력된 contract(코드 또는 차번호)와 일치하는 contracts row 찾기 */
  const findContract = useCallback((): RtdbContract | null => {
    const q = contract.trim();
    if (!q) return null;
    const car = sanitizeCarNumber(q);
    return (
      contracts.data.find((c) => c.contract_code === q) ??
      contracts.data.find((c) => c.car_number === car && c.status !== 'deleted') ??
      null
    );
  }, [contract, contracts.data]);

  /** 반납 후속 작업: asset.status='idle' + 정산서 PDF 다운로드 */
  const finalizeReturn = useCallback(async () => {
    const c = findContract();
    if (!c) {
      toast.warning('계약 매칭 실패 — 정산서/자산 상태 갱신 생략');
      return;
    }

    // 자산 상태를 휴차로 전환
    try {
      const carNum = c.car_number;
      const asset = carNum ? assets.data.find((a) => a.car_number === carNum && a._key) : undefined;
      if (asset?._key) {
        await update(ref(getRtdb(), `assets/${asset._key}`), {
          status: 'idle',
          asset_status: '차고지대기',
          updated_at: serverTimestamp(),
        });
      }
    } catch (e) {
      toast.warning(`자산 상태 갱신 실패: ${(e as Error).message}`);
    }

    // 정산서 PDF 다운로드
    try {
      const detailModel =
        (c.car_number && assets.data.find((a) => a.car_number === c.car_number)?.detail_model) ||
        '';
      downloadSettlementPdf({
        contract_code: c.contract_code,
        contractor_name: c.contractor_name,
        contractor_phone: c.contractor_phone,
        car_number: c.car_number,
        detail_model: detailModel,
        start_date: c.start_date,
        end_date: c.end_date,
        return_date: date,
        return_reason: reason[0],
        return_mileage: mileage ? Number(mileage.replace(/,/g, '')) : undefined,
        return_fuel: fuel[0],
        damage,
        extra_charges: extras,
        deposit_refund: deposit ? Number(String(deposit).replace(/,/g, '')) : undefined,
      });
      toast.success('정산서 PDF 다운로드');
    } catch (e) {
      toast.warning(`정산서 PDF 실패: ${(e as Error).message}`);
    }
  }, [findContract, assets.data, date, reason, mileage, fuel, damage, extras, deposit]);

  return (
    <WizardShell
      icon="ph-tray-arrow-down"
      title="반납"
      desc="정산 + 사유 4종"
      footDesc="저장 시 자산 휴차 전환 + 정산서 PDF 자동 다운로드"
      footPrimary="반납 완료"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'return',
            title: `반납 ${contract}`.trim(),
            contract_code: contract || undefined,
            return_reason: reason[0],
            date,
            return_mileage: mileage ? Number(mileage.replace(/,/g, '')) : undefined,
            return_fuel: fuel[0],
            damage: damage || undefined,
            extra_charges: extras,
            deposit_refund: deposit || undefined,
          },
          validate: () => {
            if (!contract) return '계약을 입력하세요';
            if (!reason[0]) return '반납 사유를 선택하세요';
            if (!mileage) return '반납 주행을 입력하세요';
            return null;
          },
          successMsg: '반납 저장 완료',
          onSuccess: async () => {
            await finalizeReturn();
            reset();
          },
        })
      }
      body={
        <>
          <FormRow label="계약" required>
            <div className="picker-row">
              <input
                type="text"
                placeholder="계약코드 또는 차량번호"
                value={contract}
                onChange={(e) => setContract(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="반납 사유" required>
            <OptionGroup
              options={['정산반납 (만기)', '해지반납 (중도)', '강제회수 (잠수)', '기타회수']}
              value={reason}
              onChange={setReason}
            />
          </FormRow>
          <FormRow label="반납일자" required>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormRow>
          <FormRow label="반납 주행" required>
            <input
              type="text"
              placeholder="km"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
            />
          </FormRow>
          <FormRow label="연료 상태">
            <OptionGroup
              options={['가득', '3/4', '1/2', '1/4', '부족']}
              value={fuel}
              onChange={setFuel}
            />
          </FormRow>
          <FormRow label="손상 내역">
            <textarea
              placeholder="외관 흠집·내부 오염·파손 부위 (사진 첨부)"
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
            />
          </FormRow>
          <FormRow label="추가 청구">
            <OptionGroup
              options={['과주행료', '연료 부족', '손상 청구', '청소비']}
              value={extras}
              onChange={setExtras}
              multi
            />
            <div className="hint">선택 시 정산서에 자동 반영</div>
          </FormRow>
          <FormRow label="보증금">
            <input
              type="text"
              placeholder="환급액"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   7. 시동제어
   ════════════════════════════════════════════════ */
function SidongWizard({ prefill }: { prefill?: OperationPrefill }) {
  const { saving, save } = useWizardSave();
  const [target, setTarget] = useState(prefill?.car ?? prefill?.contract ?? '');
  const initialAction =
    prefill?.action === 'unlock'
      ? '제어 해제'
      : prefill?.action === 'lock'
        ? '시동 제어'
        : '시동 제어';
  const [action, setAction] = useState<readonly string[]>([initialAction]);
  const [reason, setReason] = useState<readonly string[]>(['미납 60일+']);
  const [memo, setMemo] = useState('');

  const reset = () => {
    setTarget('');
    setAction(['시동 제어']);
    setReason(['미납 60일+']);
    setMemo('');
  };

  return (
    <WizardShell
      icon="ph-lock"
      iconClass="danger"
      title="시동제어"
      desc="미납 차량 원격 제어/해제"
      footDesc="⚠ GPS 장비로 즉시 실행됩니다"
      footPrimaryDanger
      footPrimary="실행"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: action[0] === '제어 해제' ? 'ignition_unlock' : 'ignition_lock',
            title: `${action[0]} · ${reason[0] ?? ''}`.trim(),
            car_number: target ? sanitizeCarNumber(target) : undefined,
            ignition_action: action[0],
            ignition_reason: reason[0],
            memo: memo || undefined,
          },
          validate: () => {
            if (!target) return '대상을 입력하세요';
            if (!action[0]) return '동작을 선택하세요';
            if (!reason[0]) return '사유를 선택하세요';
            return null;
          },
          successMsg: `${action[0]} 저장 완료`,
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="대상" required>
            <div className="picker-row">
              <input
                type="text"
                placeholder="차량번호·계약자"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="동작" required>
            <OptionGroup options={['시동 제어', '제어 해제']} value={action} onChange={setAction} />
          </FormRow>
          <FormRow label="사유" required>
            <OptionGroup
              options={['미납 60일+', '무단 운행', '납부 완료', '계약 해지']}
              value={reason}
              onChange={setReason}
            />
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="고객 통보 여부·기타 메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   8. 기타이용
   ════════════════════════════════════════════════ */
function IyongWizard() {
  const { saving, save } = useWizardSave();
  const [useType, setUseType] = useState<readonly string[]>(['시승']);
  const [carNumber, setCarNumber] = useState('');
  const [from, setFrom] = useState('차고지 A');
  const [to, setTo] = useState('');
  const [memo, setMemo] = useState('');

  const reset = () => {
    setUseType(['시승']);
    setCarNumber('');
    setFrom('차고지 A');
    setTo('');
    setMemo('');
  };

  return (
    <WizardShell
      icon="ph-van"
      title="기타이용"
      desc="시승·세차·재배치·점검"
      footPrimary="저장"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'general_use',
            title: useType[0] ?? '기타이용',
            car_number: carNumber ? sanitizeCarNumber(carNumber) : undefined,
            use_type: useType[0],
            from_location: from || undefined,
            to_location: to || undefined,
            memo: memo || undefined,
          },
          validate: () => {
            if (!useType[0]) return '이용 종류를 선택하세요';
            if (!carNumber) return '차량을 입력하세요';
            return null;
          },
          successMsg: '기타이용 저장 완료',
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="이용 종류" required>
            <OptionGroup
              options={['시승', '세차', '주유', '차고지 재배치', '직원 출장', '기타']}
              value={useType}
              onChange={setUseType}
            />
          </FormRow>
          <FormRow label="차량" required>
            <div className="picker-row">
              <input
                type="text"
                placeholder="차량번호"
                value={carNumber}
                onChange={(e) => setCarNumber(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="출발 → 도착">
            <div className="picker-row">
              <input
                type="text"
                placeholder="출발지"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <input
                type="text"
                placeholder="도착지"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="이유·결과 메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   9. 메모
   ════════════════════════════════════════════════ */
function MemoWizard() {
  const { saving, save } = useWizardSave();
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const reset = () => {
    setTarget('');
    setTitle('');
    setContent('');
  };

  return (
    <WizardShell
      icon="ph-clipboard-text"
      title="메모"
      desc="자유 메모 + 첨부"
      footPrimary="저장"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'memo',
            title: title || '메모',
            car_number: target ? sanitizeCarNumber(target) : undefined,
            content,
            memo: content,
          },
          validate: () => {
            if (!title) return '제목을 입력하세요';
            return null;
          },
          successMsg: '메모 저장 완료',
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="대상 (선택)">
            <div className="picker-row">
              <input
                type="text"
                placeholder="차량·계약 (없어도 됨)"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="제목" required>
            <input
              type="text"
              placeholder="메모 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormRow>
          <FormRow label="내용">
            <textarea
              placeholder="자유롭게"
              style={{ height: 120 }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   10. 요청등록
   ════════════════════════════════════════════════ */
function YocheongWizard() {
  const { saving, save } = useWizardSave();
  const [recipient, setRecipient] = useState<readonly string[]>(['이대리 (회계)']);
  const [reqTitle, setReqTitle] = useState('');
  const [related, setRelated] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<readonly string[]>(['보통']);
  const [detail, setDetail] = useState('');

  const reset = () => {
    setRecipient(['이대리 (회계)']);
    setReqTitle('');
    setRelated('');
    setDue('');
    setPriority(['보통']);
    setDetail('');
  };

  return (
    <WizardShell
      icon="ph-envelope"
      title="요청 등록"
      desc="직원에게 업무 지시 / 협조 요청"
      footDesc="받는 사람 일지에 자동 표시"
      footPrimary="요청 발송"
      saving={saving}
      onCancel={reset}
      onSave={() =>
        save({
          payload: {
            type: 'request',
            title: reqTitle || '요청',
            assignee: recipient[0],
            car_number: related ? sanitizeCarNumber(related) : undefined,
            due_date: due || undefined,
            priority: priority[0],
            memo: detail || undefined,
          },
          validate: () => {
            if (!recipient[0]) return '받는 사람을 선택하세요';
            if (!reqTitle) return '요청 내용을 입력하세요';
            if (!due) return '마감일을 입력하세요';
            return null;
          },
          successMsg: '요청 발송 완료',
          onSuccess: reset,
        })
      }
      body={
        <>
          <FormRow label="받는 사람" required>
            <OptionGroup
              options={['박과장 (정비)', '이대리 (회계)', '최주임 (영업)', '정상무 (관리)']}
              value={recipient}
              onChange={setRecipient}
            />
          </FormRow>
          <FormRow label="요청 내용" required>
            <input
              type="text"
              placeholder="간단한 요청 제목"
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
            />
          </FormRow>
          <FormRow label="관련 대상">
            <div className="picker-row">
              <input
                type="text"
                placeholder="차량·계약 (선택)"
                value={related}
                onChange={(e) => setRelated(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow label="마감" required>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </FormRow>
          <FormRow label="우선순위">
            <OptionGroup
              options={['낮음', '보통', '높음', '긴급']}
              value={priority}
              onChange={setPriority}
            />
          </FormRow>
          <FormRow label="상세">
            <textarea
              placeholder="상세 내용·기준·참고사항"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   11. 받은요청 — list (mock 유지)
   ════════════════════════════════════════════════ */
interface ReqRow {
  date: string;
  who: string;
  text: string;
  rel: string;
  relMuted?: boolean;
  due: string;
  dueClass?: 't-danger' | 't-warn' | 't-muted';
  status: '진행중' | '완료' | '지연';
}

const RECEIVED_ROWS: ReqRow[] = [
  {
    date: '2026-04-22',
    who: '사장',
    text: '매각건 알아보기 — 수익성 분석 후 보고',
    rel: '78라 9012',
    due: 'D-1',
    dueClass: 't-danger',
    status: '진행중',
  },
  {
    date: '2026-04-21',
    who: '전무',
    text: 'J01 회원사 4월 결산 보고서',
    rel: 'J01 전체',
    relMuted: true,
    due: 'D-3',
    dueClass: 't-warn',
    status: '진행중',
  },
  {
    date: '2026-04-19',
    who: '김상무',
    text: '홍길동 미납건 추심 진행',
    rel: '12가 3456',
    due: 'D-7',
    status: '진행중',
  },
  {
    date: '2026-04-15',
    who: '사장',
    text: '3월 자금 결산 보고',
    rel: '전체',
    relMuted: true,
    due: '완료',
    dueClass: 't-muted',
    status: '완료',
  },
  {
    date: '2026-04-12',
    who: '전무',
    text: 'J03 신규 거래 제안서',
    rel: 'J03',
    relMuted: true,
    due: '완료',
    dueClass: 't-muted',
    status: '완료',
  },
];

function ReceivedList() {
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <div className="v3-alerts-head">
          <span className="dot" />
          <span className="title">받은 요청</span>
          <span className="count">· 진행 3건 · 완료 12건</span>
        </div>
      </div>

      <div className="v3-filter-bar">
        <select defaultValue="">
          <option value="">상태 전체</option>
          <option>진행중</option>
          <option>완료</option>
          <option>취소</option>
        </select>
        <select defaultValue="">
          <option value="">요청자 전체</option>
          <option>사장</option>
          <option>전무</option>
          <option>김상무</option>
        </select>
        <select defaultValue="30">
          <option value="30">기간 30일</option>
          <option value="90">90일</option>
          <option value="all">전체</option>
        </select>
        <div className="v3-search">
          <input type="text" placeholder="내용 검색" />
        </div>
      </div>

      <div className="v3-table-wrap">
        <table className="v3-table">
          <thead>
            <tr>
              <th className="center" style={{ width: 32 }}>
                #
              </th>
              <th style={{ width: 96 }}>접수일</th>
              <th style={{ width: 80 }}>요청자</th>
              <th>요청 내용</th>
              <th style={{ width: 110 }}>관련 대상</th>
              <th style={{ width: 80 }}>마감</th>
              <th style={{ width: 80 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {RECEIVED_ROWS.map((r, i) => (
              <tr key={`${r.date}-${r.who}-${r.text}`}>
                <td className="center t-muted">{i + 1}</td>
                <td className="num">{r.date}</td>
                <td>{r.who}</td>
                <td>{r.text}</td>
                <td className={r.relMuted ? 't-muted' : 'car-num'}>{r.rel}</td>
                <td className={`num ${r.dueClass ?? ''}`}>{r.due}</td>
                <td>
                  <span
                    className={`tag ${r.status === '완료' ? 'active' : r.status === '지연' ? 'sale' : 'repair'}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="v3-table-foot">
        <div>최근 30일 15건 · 진행중 3 · 완료 12 · 평균 처리 4.2일</div>
        <div style={{ color: 'var(--c-text-muted)' }}>(mock 데이터)</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   12. 시킨요청 — list (mock 유지)
   ════════════════════════════════════════════════ */
const SENT_ROWS: ReqRow[] = [
  {
    date: '2026-04-24',
    who: '박과장',
    text: '외관사진 다시 촬영 (조명 문제)',
    rel: '90마 3456',
    due: 'D-1',
    dueClass: 't-danger',
    status: '진행중',
  },
  {
    date: '2026-04-23',
    who: '이대리',
    text: '4월 미납 회원사별 정리',
    rel: '전체',
    relMuted: true,
    due: 'D-3',
    dueClass: 't-warn',
    status: '진행중',
  },
  {
    date: '2026-04-22',
    who: '최주임',
    text: 'J0033 사고 보험금 청구 진행',
    rel: 'J0033',
    due: 'D-7',
    status: '진행중',
  },
  {
    date: '2026-04-20',
    who: '박과장',
    text: '78라9012 정비 견적 받기',
    rel: '78라 9012',
    due: 'D+2 지연',
    dueClass: 't-danger',
    status: '지연',
  },
  {
    date: '2026-04-18',
    who: '이대리',
    text: '3월 카드매출 정산 대조',
    rel: '—',
    relMuted: true,
    due: '완료',
    dueClass: 't-muted',
    status: '완료',
  },
];

function SentList() {
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <div className="v3-alerts-head">
          <span className="dot" />
          <span className="title">내가 시킨 요청</span>
          <span className="count">· 진행 5건 · 완료 23건</span>
        </div>
      </div>

      <div className="v3-filter-bar">
        <select defaultValue="">
          <option value="">상태 전체</option>
          <option>진행중</option>
          <option>완료</option>
          <option>지연</option>
        </select>
        <select defaultValue="">
          <option value="">받는사람 전체</option>
          <option>박과장</option>
          <option>이대리</option>
          <option>최주임</option>
        </select>
        <select defaultValue="30">
          <option value="30">기간 30일</option>
          <option value="90">90일</option>
        </select>
        <div className="v3-search">
          <input type="text" placeholder="내용 검색" />
        </div>
      </div>

      <div className="v3-table-wrap">
        <table className="v3-table">
          <thead>
            <tr>
              <th className="center" style={{ width: 32 }}>
                #
              </th>
              <th style={{ width: 96 }}>지시일</th>
              <th style={{ width: 80 }}>받는사람</th>
              <th>지시 내용</th>
              <th style={{ width: 110 }}>관련 대상</th>
              <th style={{ width: 80 }}>마감</th>
              <th style={{ width: 80 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {SENT_ROWS.map((r, i) => (
              <tr key={`${r.date}-${r.who}-${r.text}`}>
                <td className="center t-muted">{i + 1}</td>
                <td className="num">{r.date}</td>
                <td>{r.who}</td>
                <td>{r.text}</td>
                <td className={r.relMuted ? 't-muted' : 'car-num'}>{r.rel}</td>
                <td className={`num ${r.dueClass ?? ''}`}>{r.due}</td>
                <td>
                  <span
                    className={`tag ${r.status === '완료' ? 'active' : r.status === '지연' ? 'sale' : 'repair'}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="v3-table-foot">
        <div>최근 30일 28건 · 진행중 5 · 완료 23 · 지연 1 · 평균 처리 3.1일</div>
        <div style={{ color: 'var(--c-text-muted)' }}>(mock 데이터)</div>
      </div>
    </div>
  );
}
