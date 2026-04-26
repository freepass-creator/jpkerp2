/**
 * 임대차 계약서 PDF 생성.
 *
 * 1페이지 — 자동차 임대차 계약서:
 *   - 헤더 (계약일·계약번호)
 *   - 임대인·임차인 정보
 *   - 차량 정보
 *   - 계약 조건 (기간·대여료·결제일·보증금)
 *   - 표준 계약 조항
 *   - 서명란
 *
 * downloadContractPdf — 브라우저 다운로드
 */
import { jsPDF } from 'jspdf';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;

export interface ContractPdfData {
  contract_code?: string;
  contract_date?: string; // 계약일 (없으면 today)
  contractor_name?: string;
  contractor_phone?: string;
  contractor_address?: string;
  contractor_birth?: string;
  contractor_license?: string;
  car_number?: string;
  manufacturer?: string;
  car_model?: string;
  detail_model?: string;
  vin?: string;
  car_year?: number | string;
  start_date?: string;
  end_date?: string;
  rent_months?: number;
  rent_amount?: number;
  deposit_amount?: number;
  auto_debit_day?: string | number;
  product_type?: string;
  is_extension?: boolean;
  note?: string;
  // 임대인 (회사) 정보
  company_name?: string;
  company_biz_no?: string;
  company_address?: string;
  company_ceo?: string;
}

function shortDate(s?: string) {
  if (!s) return '—';
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : s;
}

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmt(n?: number) {
  return typeof n === 'number' ? `${n.toLocaleString()}원` : '—';
}

export function buildContractPdf(data: ContractPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M + 8;

  // 제목
  doc.setFontSize(18);
  const title = data.is_extension ? '자동차 임대차 연장계약서' : '자동차 임대차 계약서';
  doc.text(title, PAGE_W / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(10);
  doc.text(`계약번호: ${data.contract_code ?? '—'}`, M, y);
  doc.text(`계약일: ${shortDate(data.contract_date ?? todayStr())}`, PAGE_W - M, y, {
    align: 'right',
  });
  y += 10;

  // 당사자
  doc.setFontSize(11);
  doc.text('■ 계약 당사자', M, y);
  y += 7;
  doc.setFontSize(10);
  doc.text('[임대인]', M, y);
  y += 6;
  const lessor: Array<[string, string]> = [
    ['상호', data.company_name ?? '주식회사 ○○렌터카'],
    ['사업자번호', data.company_biz_no ?? '—'],
    ['주소', data.company_address ?? '—'],
    ['대표자', data.company_ceo ?? '—'],
  ];
  for (const [k, v] of lessor) {
    doc.text(`  ${k}: ${v}`, M, y);
    y += 5.5;
  }
  y += 3;
  doc.text('[임차인]', M, y);
  y += 6;
  const lessee: Array<[string, string]> = [
    ['성명', data.contractor_name ?? '—'],
    ['연락처', data.contractor_phone ?? '—'],
    ['주소', data.contractor_address ?? '—'],
    ['생년월일', data.contractor_birth ?? '—'],
    ['면허번호', data.contractor_license ?? '—'],
  ];
  for (const [k, v] of lessee) {
    doc.text(`  ${k}: ${v}`, M, y);
    y += 5.5;
  }
  y += 4;

  // 차량
  doc.setFontSize(11);
  doc.text('■ 임대차 차량', M, y);
  y += 7;
  doc.setFontSize(10);
  const car: Array<[string, string]> = [
    ['차량번호', data.car_number ?? '—'],
    [
      '차종',
      [data.manufacturer, data.car_model, data.detail_model].filter(Boolean).join(' ') || '—',
    ],
    ['연식', data.car_year ? String(data.car_year) : '—'],
    ['차대번호', data.vin ?? '—'],
  ];
  for (const [k, v] of car) {
    doc.text(`  · ${k}: ${v}`, M, y);
    y += 5.5;
  }
  y += 4;

  // 계약 조건
  doc.setFontSize(11);
  doc.text('■ 계약 조건', M, y);
  y += 7;
  doc.setFontSize(10);
  const terms: Array<[string, string]> = [
    ['상품유형', data.product_type ?? '—'],
    [
      '계약기간',
      `${shortDate(data.start_date)} ~ ${shortDate(data.end_date)}${data.rent_months ? `  (${data.rent_months}개월)` : ''}`,
    ],
    ['월 대여료', fmt(data.rent_amount)],
    ['결제일', data.auto_debit_day ? `매월 ${data.auto_debit_day}일` : '—'],
    ['보증금', fmt(data.deposit_amount)],
  ];
  for (const [k, v] of terms) {
    doc.text(`  · ${k}: ${v}`, M, y);
    y += 5.5;
  }
  y += 4;

  // 표준 조항
  doc.setFontSize(11);
  doc.text('■ 계약 조항', M, y);
  y += 7;
  doc.setFontSize(9);
  const clauses = [
    '제1조(목적) 임대인은 본 계약서에 명시된 차량을 임차인에게 임대하고, 임차인은 차임을 지급한다.',
    '제2조(차임) 임차인은 매월 지정된 결제일에 월 대여료 및 부대비용을 임대인에게 납부한다.',
    '제3조(보증금) 보증금은 계약 종료 시 정산 후 환급되며, 미납·손상 발생 시 차감된다.',
    '제4조(차량 관리) 임차인은 선량한 관리자의 주의로 차량을 사용·관리하며, 정기 점검에 협조한다.',
    '제5조(위반행위) 음주운전·뺑소니·차량 양도 등 중대한 위반 시 임대인은 계약을 즉시 해지할 수 있다.',
    '제6조(반납) 계약 종료 시 임차인은 차량을 임대인이 지정한 장소에 정상 상태로 반납한다.',
    '제7조(과태료·범칙금) 임차 기간 중 발생한 과태료·범칙금은 임차인이 부담한다.',
    '제8조(보험) 차량 보험은 임대인이 가입한 보험에 따르며, 자기부담금은 임차인이 부담한다.',
    '제9조(분쟁) 본 계약과 관련한 분쟁은 임대인 본점 소재지 관할 법원을 합의관할로 한다.',
  ];
  for (const c of clauses) {
    const wrapped = doc.splitTextToSize(c, PAGE_W - M * 2);
    doc.text(wrapped, M, y);
    y += 4.8 * wrapped.length + 1;
    if (y > PAGE_H - 60) {
      doc.addPage();
      y = M + 8;
    }
  }

  if (data.note) {
    y += 4;
    doc.setFontSize(11);
    doc.text('■ 특약사항', M, y);
    y += 7;
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(data.note, PAGE_W - M * 2);
    doc.text(wrapped, M, y);
    y += 4.8 * wrapped.length;
  }

  // 서명란
  if (y > PAGE_H - 50) {
    doc.addPage();
    y = M + 8;
  } else {
    y = Math.max(y + 8, PAGE_H - 50);
  }

  doc.setFontSize(10);
  doc.text(shortDate(data.contract_date ?? todayStr()), PAGE_W / 2, y, { align: 'center' });
  y += 10;

  // 임대인 / 임차인 서명 박스
  const colW = (PAGE_W - M * 2 - 10) / 2;
  doc.text('임대인:', M, y);
  doc.text(data.company_name ?? '주식회사 ○○렌터카', M + 18, y);
  doc.text('(인)', M + colW - 8, y);
  doc.text('임차인:', M + colW + 10, y);
  doc.text(data.contractor_name ?? '—', M + colW + 28, y);
  doc.text('(인)', PAGE_W - M - 8, y);

  return doc;
}

export function downloadContractPdf(data: ContractPdfData): void {
  const doc = buildContractPdf(data);
  const fname = `계약서_${data.contract_code ?? data.car_number ?? 'unknown'}.pdf`;
  doc.save(fname);
}
