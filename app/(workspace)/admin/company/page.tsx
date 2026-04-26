'use client';

/**
 * 일반관리 (v3) — Phase 8.
 *
 * 5 sub-tab:
 *   1. 회사관리 (default · 회사 정보 form)
 *   2. 직원관리 (users RTDB → AG Grid)
 *   3. 부서·팀 (직원 부서 derived 또는 placeholder)
 *   4. 정책·규정 (placeholder)
 *   5. 일반비용 (placeholder)
 *
 * 디자인은 jpkerp-v3/prototype.html `data-page="general"` 기준.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, ref, set } from 'firebase/database';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { EditableField } from '@/components/shared/editable-field';
import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { SimpleRtdbGrid } from '@/components/shared/simple-rtdb-grid';
import {
  ErrorBox,
  LoadingBox,
  PanelHeader,
  PlaceholderBlock,
  StatSep,
  TableFoot,
  cellTd,
  cellTh,
} from '@/components/v3/panels';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { getRtdb } from '@/lib/firebase/rtdb';
import {
  MONO_CELL_STYLE,
  MONO_CELL_STYLE_BOLD,
  rowNumColumn,
  typedColumn,
} from '@/lib/grid/typed-column';
import { fmt, fmtDate } from '@/lib/utils';
import type { ColDef } from 'ag-grid-community';

type SubpageId =
  | 'general-company'
  | 'general-staff'
  | 'general-dept'
  | 'general-policy'
  | 'general-expense'
  | 'general-member'
  | 'general-vendor'
  | 'general-card-account'
  | 'general-document';

interface TabSpec {
  id: SubpageId;
  label: string;
  action: string; // empty string => 버튼 숨김
}

const TABS: TabSpec[] = [
  { id: 'general-company', label: '회사관리', action: '+ 회사 정보 수정' },
  { id: 'general-staff', label: '직원관리', action: '+ 직원 등록' },
  { id: 'general-dept', label: '부서·팀', action: '+ 부서 등록' },
  { id: 'general-member', label: '회원사', action: '+ 회원사 등록' },
  { id: 'general-vendor', label: '거래처', action: '+ 거래처 등록' },
  { id: 'general-card-account', label: '법인카드·계좌', action: '+ 카드/계좌 등록' },
  { id: 'general-document', label: '문서·결재', action: '+ 문서 등록' },
  { id: 'general-policy', label: '정책·규정', action: '+ 정책 등록' },
  { id: 'general-expense', label: '일반비용', action: '+ 비용 등록' },
];

const TAB_CRUMB: Record<SubpageId, string> = {
  'general-company': '회사관리',
  'general-staff': '직원관리',
  'general-dept': '부서·팀',
  'general-member': '회원사',
  'general-vendor': '거래처',
  'general-card-account': '법인카드·계좌',
  'general-document': '문서·결재',
  'general-policy': '정책·규정',
  'general-expense': '일반비용',
};

export default function GeneralAdminPage() {
  const [active, setActive] = useState<SubpageId>('general-company');
  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <>
      <div className="page-head">
        <i className="ph ph-folders" />
        <div className="title">일반관리</div>
        <div className="crumbs">› {TAB_CRUMB[active]}</div>
      </div>

      <div className="v3-tabs">
        <div className="v3-tab-list">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`v3-tab ${active === t.id ? 'is-active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="action">
          {activeTab.action && (
            <button type="button" disabled>
              {activeTab.action}
            </button>
          )}
        </div>
      </div>

      {active === 'general-company' ? (
        <CompanySubpage />
      ) : active === 'general-staff' ? (
        <StaffSubpage />
      ) : active === 'general-dept' ? (
        <DeptSubpage />
      ) : active === 'general-member' ? (
        <MemberSubpage />
      ) : active === 'general-vendor' ? (
        <VendorSubpage />
      ) : active === 'general-card-account' ? (
        <CardAccountSubpage />
      ) : active === 'general-document' ? (
        <DocumentSubpage />
      ) : active === 'general-policy' ? (
        <PlaceholderSubpage label="정책·규정" icon="ph-scroll" />
      ) : (
        <PlaceholderSubpage label="일반비용" icon="ph-receipt" />
      )}
    </>
  );
}

/* ── 회원사 sub-page (partners) ── */

const MEMBER_COLS: ColDef[] = [
  rowNumColumn(),
  typedColumn('text', {
    headerName: '회사코드',
    field: 'partner_code',
    width: 100,
    cellStyle: MONO_CELL_STYLE_BOLD,
  }),
  typedColumn('text', { headerName: '회원사명', field: 'partner_name', width: 160 }),
  typedColumn('text', { headerName: '대표자', field: 'ceo', width: 80 }),
  typedColumn('text', { headerName: '사업자번호', field: 'biz_no', width: 120 }),
  typedColumn('text', { headerName: '전화', field: 'phone', width: 115 }),
  typedColumn('text', { headerName: '담당자', field: 'contact_name', width: 80 }),
  typedColumn('text', { headerName: '담당연락처', field: 'contact_phone', width: 115 }),
  typedColumn('text', { headerName: '주소', field: 'address', flex: 1, minWidth: 180 }),
  typedColumn('select', { headerName: '상태', field: 'status', width: 75 }),
];

function MemberSubpage() {
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader icon="ph-buildings" title="회원사" count="· 운영사·관리코드 마스터" />
      </div>
      <div className="v3-table-wrap">
        <div className="v3-grid-host">
          <SimpleRtdbGrid
            path="partners"
            columnDefs={MEMBER_COLS}
            storageKey="jpk.grid.admin.member"
            emptyMessage="등록된 회원사가 없습니다"
          />
        </div>
      </div>
      <TableFoot trailing="회원사·고객사 마스터 — 신규는 /input?type=partner">
        <span className="v3-stat-mut">계약·자산·청구 모든 데이터의 partner_code 기준</span>
      </TableFoot>
    </div>
  );
}

/* ── 거래처 sub-page (vendors) ── */

const VENDOR_COLS: ColDef[] = [
  rowNumColumn(),
  typedColumn('text', {
    headerName: '거래처명',
    field: 'vendor_name',
    width: 140,
    cellStyle: { fontWeight: '600' },
  }),
  typedColumn('select', { headerName: '업종', field: 'vendor_type', width: 90 }),
  typedColumn('text', { headerName: '담당자', field: 'contact_name', width: 90 }),
  typedColumn('text', { headerName: '연락처', field: 'phone', width: 115 }),
  typedColumn('text', { headerName: '주소', field: 'address', flex: 1, minWidth: 180 }),
  typedColumn('text', { headerName: '사업자번호', field: 'biz_no', width: 120 }),
  typedColumn('text', { headerName: '계좌', field: 'bank_account', width: 140 }),
  typedColumn('text', { headerName: '비고', field: 'note', width: 160 }),
];

function VendorSubpage() {
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader icon="ph-briefcase" title="거래처" count="· 정비·보험·세차 등 협력사" />
      </div>
      <div className="v3-table-wrap">
        <div className="v3-grid-host">
          <SimpleRtdbGrid
            path="vendors"
            columnDefs={VENDOR_COLS}
            storageKey="jpk.grid.admin.vendor"
            emptyMessage="등록된 거래처가 없습니다"
          />
        </div>
      </div>
      <TableFoot trailing="vendors RTDB — 정비·보험·세차·탁송 등">
        <span className="v3-stat-mut">events.partner_code 매칭으로 비용 추적</span>
      </TableFoot>
    </div>
  );
}

/* ── 법인카드·계좌 sub-page (cards + bank_accounts) ── */

const CARD_COLS: ColDef[] = [
  rowNumColumn(),
  typedColumn('text', {
    headerName: '카드번호',
    field: 'card_no',
    width: 170,
    cellStyle: MONO_CELL_STYLE,
  }),
  typedColumn('select', { headerName: '카드사', field: 'card_company', width: 90 }),
  typedColumn('text', { headerName: '사용자', field: 'card_user', width: 90 }),
  typedColumn('number', {
    headerName: '한도',
    field: 'card_limit',
    width: 110,
    valueFormatter: (p) => (p.value ? fmt(Number(p.value)) : '-'),
  }),
  typedColumn('select', { headerName: '결제일', field: 'pay_day', width: 70 }),
  typedColumn('select', { headerName: '용도', field: 'usage', width: 100 }),
  typedColumn('select', { headerName: '상태', field: 'status', width: 70 }),
];

const ACCOUNT_COLS: ColDef[] = [
  rowNumColumn(),
  typedColumn('select', { headerName: '은행', field: 'bank_name', width: 90 }),
  typedColumn('text', {
    headerName: '계좌번호',
    field: 'account_no',
    width: 170,
    cellStyle: MONO_CELL_STYLE,
  }),
  typedColumn('text', { headerName: '예금주', field: 'holder', width: 100 }),
  typedColumn('select', { headerName: '용도', field: 'usage', width: 110 }),
  typedColumn('text', { headerName: '별칭', field: 'alias', width: 100 }),
  typedColumn('select', { headerName: '상태', field: 'status', width: 70 }),
];

function CardAccountSubpage() {
  const [section, setSection] = useState<'card' | 'account'>('card');
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader
          icon="ph-credit-card"
          title="법인카드 · 계좌"
          count={`· ${section === 'card' ? '법인 결제용 카드' : '법인 입금·출금 계좌'}`}
          trailing={
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${section === 'card' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSection('card')}
              >
                법인카드
              </button>
              <button
                type="button"
                className={`btn btn-sm ${section === 'account' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSection('account')}
              >
                계좌
              </button>
            </div>
          }
        />
      </div>
      <div className="v3-table-wrap">
        <div className="v3-grid-host">
          {section === 'card' ? (
            <SimpleRtdbGrid
              path="cards"
              columnDefs={CARD_COLS}
              storageKey="jpk.grid.admin.card"
              emptyMessage="등록된 법인카드가 없습니다"
            />
          ) : (
            <SimpleRtdbGrid
              path="bank_accounts"
              columnDefs={ACCOUNT_COLS}
              storageKey="jpk.grid.admin.account"
              emptyMessage="등록된 계좌가 없습니다"
            />
          )}
        </div>
      </div>
      <TableFoot trailing="cards / bank_accounts RTDB — 카드사·은행별 한도·잔액 마스터">
        <span className="v3-stat-mut">
          {section === 'card' ? '법인 결제용 카드' : '법인 입금·출금 계좌'}
        </span>
      </TableFoot>
    </div>
  );
}

/* ── 문서·결재 sub-page (seals + contract_templates + approvals) ── */

const SEAL_COLS: ColDef[] = [
  rowNumColumn(),
  typedColumn('text', {
    headerName: '인감명',
    field: 'name',
    width: 160,
    cellStyle: { fontWeight: '600' },
  }),
  typedColumn('select', { headerName: '구분', field: 'seal_type', width: 100 }),
  typedColumn('text', { headerName: '설명', field: 'description', flex: 1, minWidth: 200 }),
  typedColumn('date', {
    headerName: '등록일',
    field: 'created_date',
    width: 100,
    valueFormatter: (p) => fmtDate(p.value as string),
  }),
  typedColumn('select', { headerName: '상태', field: 'status', width: 70 }),
];

const CONTRACT_TEMPLATE_COLS: ColDef[] = [
  rowNumColumn(),
  typedColumn('text', {
    headerName: '템플릿명',
    field: 'name',
    width: 200,
    cellStyle: { fontWeight: '600' },
  }),
  typedColumn('select', { headerName: '구분', field: 'template_type', width: 100 }),
  typedColumn('text', { headerName: '설명', field: 'description', flex: 1, minWidth: 200 }),
  typedColumn('text', {
    headerName: '파일명',
    field: 'file_name',
    width: 180,
    cellStyle: { color: 'var(--c-text-muted)' },
  }),
  typedColumn('date', {
    headerName: '등록일',
    field: 'created_date',
    width: 100,
    valueFormatter: (p) => fmtDate(p.value as string),
  }),
  typedColumn('select', { headerName: '상태', field: 'status', width: 70 }),
];

const APPROVAL_COLS: ColDef[] = [
  rowNumColumn(),
  typedColumn('text', {
    headerName: '결재번호',
    field: 'approval_no',
    width: 140,
    cellStyle: MONO_CELL_STYLE,
  }),
  typedColumn('select', { headerName: '구분', field: 'approval_type', width: 110 }),
  typedColumn('text', {
    headerName: '제목',
    field: 'title',
    flex: 1,
    minWidth: 220,
    cellStyle: { fontWeight: '600' },
  }),
  typedColumn('text', { headerName: '기안자', field: 'drafter', width: 90 }),
  typedColumn('date', {
    headerName: '기안일',
    field: 'drafted_at',
    width: 100,
    valueFormatter: (p) => fmtDate(p.value as string),
  }),
  typedColumn('select', {
    headerName: '상태',
    field: 'status',
    width: 90,
    cellStyle: (p) => {
      const v = p.value as string;
      const color =
        v === '승인'
          ? 'var(--c-success)'
          : v === '반려'
            ? 'var(--c-danger)'
            : v === '대기' || v === '진행중'
              ? 'var(--c-warn)'
              : 'var(--c-text-muted)';
      return { color, fontWeight: '600' };
    },
  }),
  typedColumn('text', { headerName: '현재결재자', field: 'current_approver', width: 110 }),
];

function DocumentSubpage() {
  const [section, setSection] = useState<'seal' | 'contract' | 'approval'>('approval');
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader
          icon="ph-check-square"
          title="문서 · 결재"
          count={
            section === 'seal'
              ? '· 법인 인감 이미지'
              : section === 'contract'
                ? '· 표준 계약서 템플릿'
                : '· 품의·기안·승인'
          }
          trailing={
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${section === 'approval' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSection('approval')}
              >
                전자결재
              </button>
              <button
                type="button"
                className={`btn btn-sm ${section === 'contract' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSection('contract')}
              >
                계약서
              </button>
              <button
                type="button"
                className={`btn btn-sm ${section === 'seal' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSection('seal')}
              >
                인감
              </button>
            </div>
          }
        />
      </div>
      <div className="v3-table-wrap">
        <div className="v3-grid-host">
          {section === 'approval' ? (
            <SimpleRtdbGrid
              path="approvals"
              columnDefs={APPROVAL_COLS}
              storageKey="jpk.grid.admin.approval"
              emptyMessage="진행중인 결재가 없습니다"
            />
          ) : section === 'contract' ? (
            <SimpleRtdbGrid
              path="contract_templates"
              columnDefs={CONTRACT_TEMPLATE_COLS}
              storageKey="jpk.grid.admin.contract"
              emptyMessage="등록된 계약서 템플릿이 없습니다"
            />
          ) : (
            <SimpleRtdbGrid
              path="seals"
              columnDefs={SEAL_COLS}
              storageKey="jpk.grid.admin.seal"
              emptyMessage="등록된 인감이 없습니다"
            />
          )}
        </div>
      </div>
      <TableFoot trailing="approvals / contract_templates / seals 통합 — 인감·계약서·전자결재">
        <span className="v3-stat-mut">사내 문서·결재 워크플로 마스터</span>
      </TableFoot>
    </div>
  );
}

/* ── 회사관리 ── */

const COMPANY_FIELDS: Array<{ k: string; l: string; span?: number }> = [
  { k: 'biz_name', l: '회사명' },
  { k: 'biz_no', l: '사업자번호' },
  { k: 'ceo', l: '대표자' },
  { k: 'phone', l: '대표 전화' },
  { k: 'biz_type', l: '업태' },
  { k: 'biz_item', l: '종목' },
  { k: 'address', l: '주소', span: 2 },
  { k: 'reg_no', l: '사업용 등록' },
  { k: 'hometax_id', l: '홈택스 ID' },
  { k: 'bank_name', l: '입금은행' },
  { k: 'bank_account', l: '입금계좌' },
  { k: 'bank_holder', l: '예금주' },
];

const COMPANY_QK = ['settings', 'company'];

async function fetchCompany(): Promise<Record<string, string>> {
  const snap = await get(ref(getRtdb(), 'settings/company'));
  return (snap.val() as Record<string, string>) ?? {};
}

function CompanySubpage() {
  const qc = useQueryClient();
  const { data = {}, isLoading } = useQuery({
    queryKey: COMPANY_QK,
    queryFn: fetchCompany,
  });

  const save = (field: string) => async (v: string) => {
    const next = { ...data, [field]: v };
    qc.setQueryData(COMPANY_QK, next);
    try {
      await set(ref(getRtdb(), 'settings/company'), next);
    } catch (e) {
      qc.invalidateQueries({ queryKey: COMPANY_QK });
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader
          icon="ph-buildings"
          title="회사 기본정보"
          count={`· ${data.biz_name || '회사명 미입력'}`}
        />
      </div>

      <div className="v3-table-wrap">
        {isLoading ? (
          <LoadingBox label="회사 정보 로드 중..." />
        ) : (
          <div style={{ padding: 16, maxWidth: 800 }}>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {COMPANY_FIELDS.map((f) => (
                <div key={f.k} style={{ gridColumn: f.span ? `span ${f.span}` : undefined }}>
                  <EditableField label={f.l} value={data[f.k] ?? ''} onSave={save(f.k)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <TableFoot>
        <span className="v3-stat-mut">필드 클릭 → 자동 저장 (저장 버튼 없음)</span>
      </TableFoot>
    </div>
  );
}

/* ── 직원관리 ── */

interface StaffRow {
  _key?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  position?: string;
  join_date?: string;
  status?: string;
  [k: string]: unknown;
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  superadmin: { label: '최고관리자', color: 'var(--c-err)' },
  admin: { label: '관리자', color: 'var(--c-accent)' },
  staff: { label: '직원', color: 'var(--c-text)' },
  pending: { label: '승인대기', color: 'var(--c-warn)' },
};

function StaffSubpage() {
  const gridRef = useRef<JpkGridApi<StaffRow> | null>(null);
  const users = useRtdbCollection<StaffRow>('users');

  const stats = useMemo(() => {
    let active = 0;
    let leave = 0;
    let resigned = 0;
    for (const u of users.data) {
      const s = (u.status ?? '재직').toString();
      if (s.includes('휴직')) leave += 1;
      else if (s.includes('퇴직') || s.includes('해지')) resigned += 1;
      else active += 1;
    }
    return { total: users.data.length, active, leave, resigned };
  }, [users.data]);

  const cols = useMemo<ColDef<StaffRow>[]>(
    () => [
      rowNumColumn<StaffRow>(),
      typedColumn('text', {
        headerName: '이름',
        field: 'name',
        width: 100,
        cellStyle: { fontWeight: '600' },
      }),
      typedColumn('text', { headerName: '이메일', field: 'email', width: 200 }),
      typedColumn('text', { headerName: '연락처', field: 'phone', width: 120 }),
      typedColumn('select', {
        headerName: '권한',
        field: 'role',
        width: 100,
        cellStyle: (p: { value: unknown }) => ({
          color: ROLE_META[p.value as string]?.color ?? 'var(--c-text)',
          fontWeight: '600',
        }),
        valueFormatter: (p) => ROLE_META[p.value as string]?.label ?? (p.value as string) ?? '-',
      }),
      typedColumn('select', { headerName: '부서', field: 'department', width: 100 }),
      typedColumn('select', { headerName: '직책', field: 'position', width: 90 }),
      typedColumn('date', { headerName: '입사일', field: 'join_date', width: 100 }),
      typedColumn('select', { headerName: '상태', field: 'status', width: 80 }),
    ],
    [],
  );

  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader
          icon="ph-users"
          title="직원"
          count={`· 재직 ${stats.active}명 · 휴직 ${stats.leave}명 · 퇴직 ${stats.resigned}명`}
        />
      </div>

      <div className="v3-table-wrap">
        {users.loading ? (
          <LoadingBox label="직원 데이터 로드 중..." />
        ) : users.error ? (
          <ErrorBox error={users.error} />
        ) : (
          <div className="v3-grid-host">
            <JpkGrid<StaffRow>
              ref={gridRef}
              columnDefs={cols}
              rowData={users.data}
              getRowId={(d) => d._key ?? d.email ?? ''}
              storageKey="jpk.grid.admin.staff"
            />
          </div>
        )}
      </div>

      <TableFoot>
        총 {stats.total}명
        <StatSep />
        재직 {stats.active}
        <StatSep />
        휴직 {stats.leave}
        <StatSep />
        퇴직 {stats.resigned}
      </TableFoot>
    </div>
  );
}

/* ── 부서·팀 — users 데이터에서 부서별 집계 ── */

interface DeptRow {
  dept: string;
  count: number;
  lead?: string;
}

function DeptSubpage() {
  const users = useRtdbCollection<StaffRow>('users');

  const rows = useMemo<DeptRow[]>(() => {
    const map = new Map<string, DeptRow>();
    for (const u of users.data) {
      const d = (u.department ?? '미지정').toString();
      const r = map.get(d) ?? { dept: d, count: 0 };
      r.count += 1;
      // role=admin 이상 직원을 대표자로 추정
      if (!r.lead && (u.role === 'admin' || u.role === 'superadmin')) {
        r.lead = u.name ?? '';
      }
      map.set(d, r);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [users.data]);

  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader
          icon="ph-tree-structure"
          title="부서·팀"
          count={`· ${rows.length}개 부서 · 인원 ${users.data.length}`}
        />
      </div>

      <div className="v3-table-wrap">
        {users.loading ? (
          <LoadingBox label="데이터 로드 중..." />
        ) : rows.length === 0 ? (
          <LoadingBox label="등록된 부서가 없습니다. 직원관리에서 부서를 입력하면 자동 집계됩니다." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr
                style={{
                  background: 'var(--c-bg-soft)',
                  borderBottom: '1px solid var(--c-border)',
                }}
              >
                <th style={cellTh(40)}>#</th>
                <th style={{ ...cellTh(), textAlign: 'left' }}>부서명</th>
                <th style={cellTh(120)}>대표자(추정)</th>
                <th style={cellTh(80)}>인원</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.dept} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ ...cellTd(), color: 'var(--c-text-muted)' }}>{i + 1}</td>
                  <td style={{ ...cellTd(), textAlign: 'left', fontWeight: 600 }}>{r.dept}</td>
                  <td style={cellTd()}>{r.lead || '—'}</td>
                  <td style={cellTd()}>{r.count}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TableFoot>
        {rows.length}개 부서 · 총 {users.data.length}명
        <StatSep />
        <span className="v3-stat-mut">(직원 department 필드 자동 집계 — 부서 마스터 미구현)</span>
      </TableFoot>
    </div>
  );
}

/* ── 미구현 sub-page placeholder ── */

function PlaceholderSubpage({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <PanelHeader icon={icon} title={label} count="· 준비 중" />
      </div>
      <PlaceholderBlock
        title={`${label} 준비 중`}
        desc={
          label === '정책·규정'
            ? '대여 약관·요금 산정·정비 규정 등 사내 규정 관리 화면'
            : '임대료·인건비·광고·통신 등 일반 운영비 관리 화면'
        }
      />
    </div>
  );
}
