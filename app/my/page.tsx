'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Contract {
  _key?: string;
  contract_code?: string;
  contractor_name?: string;
  car_number?: string;
  start_date?: string;
  end_date?: string;
  rent_months?: number;
  rent_amount?: number;
  deposit_amount?: number;
  auto_debit_day?: string | number;
  product_type?: string;
  contract_status?: string;
  is_extension?: boolean;
  is_renewal?: boolean;
  contract_doc_urls?: string[];
  insurance_doc_urls?: string[];
}

interface Asset {
  car_number?: string;
  manufacturer?: string;
  car_model?: string;
  detail_model?: string;
  car_year?: string | number;
  fuel_type?: string;
  ext_color?: string;
  current_mileage?: string | number;
  first_registration_date?: string;
}

interface Billing {
  bill_count?: number;
  due_date?: string;
  amount?: number;
  paid_total?: number;
  status?: string;
  extra_kind?: string;
  derived_from?: string;
}

interface Docs {
  contract_docs: string[];
  insurance_photos: string[];
  registration: { doc_name?: string; extracted: Record<string, string>; raw_text?: string } | null;
  insurance_ocr: { doc_name?: string; extracted: Record<string, string>; raw_text?: string } | null;
  other_ocr_docs: { doc_type?: string; doc_name?: string; created_at?: number }[];
}

interface Payload {
  contract: Contract;
  asset: Asset | null;
  billings: Billing[];
  docs: Docs;
}

const SESSION_KEY = 'jpk.my.session';
const today = () => new Date().toISOString().slice(0, 10);

function fmtMoney(n?: number): string {
  if (!n && n !== 0) return '—';
  return `${Number(n).toLocaleString()}원`;
}

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : String(s);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86400000);
}

function computeContractEnd(c: Contract): string {
  if (c.end_date) return c.end_date;
  if (c.start_date && c.rent_months) {
    const d = new Date(c.start_date);
    d.setMonth(d.getMonth() + Number(c.rent_months));
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return '';
}

export default function MyPortalPage() {
  const [carNumber, setCarNumber] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const refresh = useCallback(async (car: string, tok: string) => {
    const r = await fetch('/api/my', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh', car_number: car, token: tok }),
    });
    const j = await r.json();
    if (!j.ok) {
      localStorage.removeItem(SESSION_KEY);
      setToken(null);
      setData(null);
      if (r.status === 401) toast.error('세션이 만료되었습니다');
      return;
    }
    setData({ contract: j.contract, asset: j.asset, billings: j.billings, docs: j.docs });
  }, []);

  // 복원
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const { car_number, token: tok } = JSON.parse(raw) as { car_number: string; token: string };
      if (car_number && tok) {
        setCarNumber(car_number);
        setToken(tok);
        refresh(car_number, tok);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [refresh]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carNumber.trim() || !identifier.trim()) {
      toast.error('차량번호와 등록번호를 모두 입력하세요');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/my', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', car_number: carNumber, identifier }),
      });
      const j = await r.json();
      if (!j.ok) {
        toast.error(j.error || '인증 실패');
        return;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify({ car_number: carNumber, token: j.token }));
      setToken(j.token);
      setData({ contract: j.contract, asset: j.asset, billings: j.billings, docs: j.docs });
      setIdentifier('');
      toast.success('인증 완료');
    } catch (err) {
      toast.error(`오류: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setData(null);
    setCarNumber('');
  };

  if (!token || !data) {
    return <AuthView carNumber={carNumber} setCarNumber={setCarNumber} identifier={identifier} setIdentifier={setIdentifier} onSubmit={verify} loading={loading} />;
  }

  return <Dashboard data={data} onLogout={logout} />;
}

function AuthView({
  carNumber, setCarNumber, identifier, setIdentifier, onSubmit, loading,
}: {
  carNumber: string; setCarNumber: (v: string) => void;
  identifier: string; setIdentifier: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void; loading: boolean;
}) {
  return (
    <div className="my-auth">
      <div className="my-auth-card">
        <div className="my-auth-brand">
          <i className="ph-fill ph-car text-primary" style={{ fontSize: 32 }} />
          <div className="text-[18px]" style={{ fontWeight: 700, marginTop: 6 }}>JPK 렌터카</div>
          <div className="text-base text-text-muted" style={{ marginTop: 2 }}>
            내 계약 · 납부 · 문서 조회
          </div>
        </div>
        <form onSubmit={onSubmit} className="my-auth-form">
          <label className="my-auth-label">차량번호</label>
          <input
            type="text"
            value={carNumber}
            onChange={(e) => setCarNumber(e.target.value)}
            placeholder="12가3456"
            autoFocus
            className="my-auth-input"
            autoComplete="off"
          />
          <label className="my-auth-label" style={{ marginTop: 12 }}>
            등록번호
            <span className="text-2xs text-text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>
              · 전화/주민/법인/사업자 중 하나
            </span>
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="010-1234-5678 또는 뒷 4자리"
            className="my-auth-input"
            autoComplete="off"
            inputMode="numeric"
          />
          <button type="submit" disabled={loading} className="my-auth-btn">
            {loading ? <><i className="ph ph-spinner spin" />조회 중</> : '조회하기'}
          </button>
        </form>
        <div className="my-auth-help">
          개인정보 불일치 시 담당자에게 문의하세요.
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, onLogout }: { data: Payload; onLogout: () => void }) {
  const { contract, asset, billings, docs } = data;
  const endDate = computeContractEnd(contract);
  const dDay = endDate ? daysBetween(today(), endDate) : null;

  return (
    <div className="my-dash">
      <header className="my-dash-head">
        <div>
          <div className="text-xs text-text-muted">JPK 렌터카</div>
          <div className="text-[14px]" style={{ fontWeight: 700 }}>{contract.contractor_name ?? '—'}님</div>
        </div>
        <button onClick={onLogout} className="my-dash-logout">
          <i className="ph ph-sign-out" />종료
        </button>
      </header>

      <ContractCard contract={contract} endDate={endDate} dDay={dDay} />
      <NextPaymentCard contract={contract} billings={billings} />
      <BillingProgress billings={billings} />
      <VehicleCard asset={asset} contract={contract} />
      <DocumentsCard docs={docs} />
      <ContactsCard />
      <RequestsCard contract={contract} />

      <footer className="my-dash-foot">
        세션 종료까지 자동 로그아웃 · 본인 정보만 열람
      </footer>
    </div>
  );
}

function Section({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="my-card">
      <div className="my-card-head">
        <i className={`ph ${icon}`} />
        <span>{title}</span>
        {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
      </div>
      <div className="my-card-body">{children}</div>
    </section>
  );
}

function ContractCard({ contract, endDate, dDay }: { contract: Contract; endDate: string; dDay: number | null }) {
  const status = contract.contract_status ?? '—';
  const statusTone =
    status === '계약진행' ? 'success'
    : status === '계약해지' ? 'danger'
    : status === '계약완료' ? 'neutral'
    : 'warn';
  const dTone =
    dDay === null ? null
    : dDay < 0 ? 'danger'
    : dDay <= 30 ? 'warn'
    : 'neutral';
  return (
    <Section title="계약 현황" icon="ph-handshake" action={<span className={`jpk-pill tone-${statusTone}`}>{status}</span>}>
      <div className="my-kv">
        <div><span>차량</span><b>{contract.car_number ?? '—'}</b></div>
        <div><span>상품</span><b>{contract.product_type ?? '—'}</b></div>
        <div><span>기간</span><b>{fmtDate(contract.start_date)} ~ {fmtDate(endDate)}</b></div>
        <div><span>개월수</span><b>{contract.rent_months ?? '—'}개월</b></div>
        {dDay !== null && (
          <div>
            <span>만기</span>
            <b className={`jpk-pill tone-${dTone}`}>
              {dDay < 0 ? `${-dDay}일 경과` : dDay === 0 ? '오늘 만기' : `D-${dDay}`}
            </b>
          </div>
        )}
        {(contract.is_extension || contract.is_renewal) && (
          <div><span>구분</span><b>{contract.is_extension ? '연장 계약' : '재계약'}</b></div>
        )}
      </div>
    </Section>
  );
}

function computeDueTotal(b: Billing): number {
  return Number(b.amount) || 0;
}

function isPaid(b: Billing): boolean {
  return (b.paid_total ?? 0) >= computeDueTotal(b);
}

function isOverdue(b: Billing): boolean {
  if (isPaid(b)) return false;
  if (!b.due_date) return false;
  return b.due_date < today();
}

function NextPaymentCard({ contract, billings }: { contract: Contract; billings: Billing[] }) {
  const sorted = [...billings].sort((a, b) => String(a.due_date ?? '').localeCompare(String(b.due_date ?? '')));
  const upcoming = sorted.find((b) => !isPaid(b) && b.due_date && b.due_date >= today());
  const overdueList = sorted.filter(isOverdue);
  const overdueTotal = overdueList.reduce((s, b) => s + (computeDueTotal(b) - (b.paid_total ?? 0)), 0);

  return (
    <Section title="다음 결제" icon="ph-calendar-check">
      {upcoming ? (
        <div className="my-next">
          <div className="my-next-amt">{fmtMoney(upcoming.amount)}</div>
          <div className="my-next-due">{fmtDate(upcoming.due_date)} · {upcoming.bill_count}회차</div>
          {contract.auto_debit_day && (
            <div className="my-next-sub">매월 {contract.auto_debit_day}일 자동이체</div>
          )}
        </div>
      ) : (
        <div className="my-empty">예정된 결제 없음</div>
      )}

      {overdueList.length > 0 && (
        <div className="my-overdue">
          <i className="ph-fill ph-warning-circle" />
          <div>
            <b>미납 {overdueList.length}건 · {fmtMoney(overdueTotal)}</b>
            <div className="text-xs" style={{ marginTop: 2 }}>결제 확인 후 담당자에게 알려주세요</div>
          </div>
        </div>
      )}
    </Section>
  );
}

function BillingProgress({ billings }: { billings: Billing[] }) {
  const regular = billings.filter((b) => b.derived_from !== 'return_extra');
  const extras = billings.filter((b) => b.derived_from === 'return_extra');
  const paid = regular.filter(isPaid).length;
  const total = regular.length;
  const ratio = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <Section title="납부 진행률" icon="ph-chart-line-up">
      <div className="my-prog-bar"><div style={{ width: `${ratio}%` }} /></div>
      <div className="my-prog-label">
        {paid} / {total}회차 완납 ({ratio}%)
      </div>
      <details className="my-details">
        <summary>회차별 상세</summary>
        <table className="my-bill-table">
          <thead><tr><th>회차</th><th>결제일</th><th>금액</th><th>상태</th></tr></thead>
          <tbody>
            {regular.map((b, i) => {
              const paidOk = isPaid(b);
              const over = isOverdue(b);
              const tone = paidOk ? 'success' : over ? 'danger' : 'neutral';
              const label = paidOk ? '완납' : over ? '미납' : '예정';
              return (
                <tr key={`r${i}`}>
                  <td>{b.bill_count ?? i + 1}</td>
                  <td>{fmtDate(b.due_date)}</td>
                  <td>{fmtMoney(b.amount)}</td>
                  <td><span className={`jpk-pill tone-${tone}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {extras.length > 0 && (
          <>
            <div className="my-subhead">반납 추가청구</div>
            <table className="my-bill-table">
              <tbody>
                {extras.map((b, i) => (
                  <tr key={`e${i}`}>
                    <td>{b.extra_kind ?? '기타'}</td>
                    <td>{fmtDate(b.due_date)}</td>
                    <td>{fmtMoney(b.amount)}</td>
                    <td>
                      <span className={`jpk-pill tone-${isPaid(b) ? 'success' : 'warn'}`}>
                        {isPaid(b) ? '완납' : '미납'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </details>
    </Section>
  );
}

function VehicleCard({ asset, contract }: { asset: Asset | null; contract: Contract }) {
  if (!asset) {
    return (
      <Section title="내 차량" icon="ph-car">
        <div className="my-kv">
          <div><span>차량번호</span><b>{contract.car_number ?? '—'}</b></div>
        </div>
      </Section>
    );
  }
  const modelLine = [asset.manufacturer, asset.detail_model || asset.car_model, asset.car_year].filter(Boolean).join(' ');
  return (
    <Section title="내 차량" icon="ph-car">
      <div className="my-kv">
        <div><span>차량번호</span><b>{asset.car_number ?? '—'}</b></div>
        <div><span>차종</span><b>{modelLine || '—'}</b></div>
        <div><span>연료</span><b>{asset.fuel_type ?? '—'}</b></div>
        <div><span>색상</span><b>{asset.ext_color ?? '—'}</b></div>
        <div><span>최초등록</span><b>{fmtDate(asset.first_registration_date)}</b></div>
        <div><span>주행거리</span><b>{asset.current_mileage ? `${Number(asset.current_mileage).toLocaleString()} km` : '—'}</b></div>
      </div>
    </Section>
  );
}

function DocItem({ label, kind, children }: { label: string; kind: string; children: React.ReactNode }) {
  return (
    <div className="my-doc">
      <div className="my-doc-head">
        <i className={`ph ${kind}`} />
        <span>{label}</span>
      </div>
      <div className="my-doc-body">{children}</div>
    </div>
  );
}

function DocumentsCard({ docs }: { docs: Docs }) {
  const hasAny =
    docs.contract_docs.length > 0 ||
    docs.insurance_photos.length > 0 ||
    docs.registration ||
    docs.insurance_ocr ||
    docs.other_ocr_docs.length > 0;

  return (
    <Section title="문서함" icon="ph-folders">
      {!hasAny && <div className="my-empty">등록된 문서가 없습니다</div>}

      {docs.contract_docs.length > 0 && (
        <DocItem label="계약서" kind="ph-file-text">
          {docs.contract_docs.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="my-doc-link">
              <i className="ph ph-download-simple" />계약서 {i + 1}
            </a>
          ))}
        </DocItem>
      )}

      {docs.insurance_photos.length > 0 && (
        <DocItem label="보험증권" kind="ph-shield-check">
          {docs.insurance_photos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="my-doc-link">
              <i className="ph ph-image" />보험증권 {i + 1}
            </a>
          ))}
        </DocItem>
      )}

      {docs.registration && (
        <DocItem label="자동차등록증" kind="ph-identification-card">
          <OcrExtractView extracted={docs.registration.extracted} rawText={docs.registration.raw_text} />
        </DocItem>
      )}

      {docs.insurance_ocr && !docs.insurance_photos.length && (
        <DocItem label="보험증권 (OCR)" kind="ph-shield-check">
          <OcrExtractView extracted={docs.insurance_ocr.extracted} rawText={docs.insurance_ocr.raw_text} />
        </DocItem>
      )}

      {docs.other_ocr_docs.length > 0 && (
        <DocItem label="기타 문서" kind="ph-file">
          {docs.other_ocr_docs.map((d, i) => (
            <div key={i} className="my-doc-row">
              <b>{d.doc_type}</b>
              <span className="text-text-muted">{d.doc_name || '—'}</span>
            </div>
          ))}
        </DocItem>
      )}
    </Section>
  );
}

function OcrExtractView({ extracted, rawText }: { extracted: Record<string, string>; rawText?: string }) {
  const entries = Object.entries(extracted || {});
  if (entries.length === 0 && !rawText) return <div className="my-empty">추출된 정보 없음</div>;
  return (
    <div>
      {entries.length > 0 && (
        <div className="my-kv">
          {entries.slice(0, 12).map(([k, v]) => (
            <div key={k}><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
      )}
      {rawText && (
        <details className="my-details" style={{ marginTop: 8 }}>
          <summary>원본 텍스트</summary>
          <pre className="my-pre">{rawText}</pre>
        </details>
      )}
    </div>
  );
}

function ContactsCard() {
  return (
    <Section title="긴급 연락" icon="ph-phone-call">
      <div className="my-contacts">
        <a href="tel:1588-0000" className="my-contact my-contact-danger">
          <i className="ph-fill ph-warning" />
          <div>
            <div style={{ fontWeight: 700 }}>사고·정비 24시간</div>
            <div className="text-xs">1588-0000</div>
          </div>
        </a>
        <a href="tel:02-0000-0000" className="my-contact">
          <i className="ph ph-headset" />
          <div>
            <div style={{ fontWeight: 700 }}>고객센터</div>
            <div className="text-xs">평일 09-18시</div>
          </div>
        </a>
      </div>
    </Section>
  );
}

function RequestsCard({ contract }: { contract: Contract }) {
  const subject = encodeURIComponent(`[${contract.car_number ?? ''}] 계약 문의`);
  return (
    <Section title="신청·문의" icon="ph-chat-circle-text">
      <div className="my-reqs">
        <a href={`mailto:jpkpyh@gmail.com?subject=${subject}%20%EC%A3%BC%EC%86%8C%C2%B7%EC%97%B0%EB%9D%BD%EC%B2%98%20%EB%B3%80%EA%B2%BD`} className="my-req">
          <i className="ph ph-pencil-simple" />주소·연락처 변경
        </a>
        <a href={`mailto:jpkpyh@gmail.com?subject=${subject}%20%EA%B3%84%EC%95%BD%20%EC%97%B0%EC%9E%A5%20%EC%83%81%EB%8B%B4`} className="my-req">
          <i className="ph ph-arrow-clockwise" />계약 연장 상담
        </a>
        <a href={`mailto:jpkpyh@gmail.com?subject=${subject}%20%EA%B3%84%EC%95%BD%EC%84%9C%20%EC%9E%AC%EB%B0%9C%EA%B8%89`} className="my-req">
          <i className="ph ph-file-text" />계약서 재발급
        </a>
        <a href={`mailto:jpkpyh@gmail.com?subject=${subject}%20%EA%B3%BC%ED%83%9C%EB%A3%8C%20%ED%99%95%EC%9D%B8%EC%84%9C`} className="my-req">
          <i className="ph ph-receipt" />과태료 확인서
        </a>
      </div>
    </Section>
  );
}
