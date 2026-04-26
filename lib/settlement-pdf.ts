/**
 * 반납 정산서 PDF 생성.
 *
 * 1페이지 — 임대차 종료 정산서:
 *   - 헤더 (당사·임차인)
 *   - 차량/계약 정보
 *   - 반납 사항 (날짜·주행·연료·손상)
 *   - 정산 내역 (보증금 환급·추가청구)
 *   - 합계
 *
 * downloadSettlementPdf — Blob → 브라우저 다운로드
 */
import { jsPDF } from 'jspdf';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 20;

export interface SettlementData {
  contract_code?: string;
  contractor_name?: string;
  contractor_phone?: string;
  car_number?: string;
  detail_model?: string;
  start_date?: string;
  end_date?: string;
  return_date: string;
  return_reason: string;
  return_mileage?: number;
  return_fuel?: string;
  damage?: string;
  extra_charges?: readonly string[];
  deposit_refund?: number;
  // 추가 청구 금액 (각 항목별)
  charge_overdrive?: number; // 과주행료
  charge_fuel?: number; // 연료 부족
  charge_damage?: number; // 손상
  charge_clean?: number; // 청소
  // 회사 정보
  company_name?: string;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function shortDate(s?: string) {
  if (!s) return '—';
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : s;
}

function fmt(n?: number) {
  return typeof n === 'number' ? `${n.toLocaleString()}원` : '—';
}

export function buildSettlementPdf(data: SettlementData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M + 10;

  // 제목
  doc.setFontSize(18);
  doc.text('임대차 종료 정산서', PAGE_W / 2, y, { align: 'center' });
  y += 14;

  doc.setFontSize(10);
  doc.text(`발행일: ${today()}`, PAGE_W - M, y, { align: 'right' });
  y += 10;

  // 발신
  doc.setFontSize(11);
  doc.text(`수신: ${data.contractor_name ?? '—'} 귀하`, M, y);
  y += 6;
  doc.text(`발신: ${data.company_name ?? '주식회사 ○○렌터카'}`, M, y);
  y += 10;

  // 본문 인사말
  doc.setFontSize(10);
  doc.text('1. 귀하의 차량 임대차계약 종료에 따른 정산 내역을 아래와 같이 통지합니다.', M, y);
  y += 10;

  // 계약 정보
  doc.setFontSize(11);
  doc.text('■ 계약 정보', M, y);
  y += 7;
  doc.setFontSize(10);
  const info: Array<[string, string]> = [
    ['계약번호', data.contract_code ?? '—'],
    ['임차인', `${data.contractor_name ?? '—'}  (${data.contractor_phone ?? '—'})`],
    ['차량번호', data.car_number ?? '—'],
    ['차종', data.detail_model ?? '—'],
    ['계약기간', `${shortDate(data.start_date)} ~ ${shortDate(data.end_date)}`],
  ];
  for (const [k, v] of info) {
    doc.text(`  · ${k}: ${v}`, M, y);
    y += 6;
  }
  y += 4;

  // 반납 사항
  doc.setFontSize(11);
  doc.text('■ 반납 사항', M, y);
  y += 7;
  doc.setFontSize(10);
  const ret: Array<[string, string]> = [
    ['반납일자', shortDate(data.return_date)],
    ['반납사유', data.return_reason],
    ['반납주행', data.return_mileage ? `${data.return_mileage.toLocaleString()} km` : '—'],
    ['연료상태', data.return_fuel ?? '—'],
    ['손상내역', data.damage ? data.damage : '없음'],
  ];
  for (const [k, v] of ret) {
    const lines = doc.splitTextToSize(`  · ${k}: ${v}`, PAGE_W - M * 2);
    doc.text(lines, M, y);
    y += 6 * lines.length;
  }
  y += 4;

  // 정산 내역
  doc.setFontSize(11);
  doc.text('■ 정산 내역', M, y);
  y += 7;
  doc.setFontSize(10);

  const refundAmt = data.deposit_refund ?? 0;
  const charges: Array<[string, number]> = [];
  if (data.charge_overdrive) charges.push(['과주행료', data.charge_overdrive]);
  if (data.charge_fuel) charges.push(['연료 부족', data.charge_fuel]);
  if (data.charge_damage) charges.push(['손상 청구', data.charge_damage]);
  if (data.charge_clean) charges.push(['청소비', data.charge_clean]);

  doc.text(`  · 보증금 환급: ${fmt(refundAmt)}`, M, y);
  y += 6;
  if (charges.length === 0 && (data.extra_charges?.length ?? 0) > 0) {
    // 금액 미입력 — 항목만 표시
    doc.text(`  · 추가 청구 항목: ${data.extra_charges?.join(', ')}`, M, y);
    y += 6;
  } else {
    for (const [k, v] of charges) {
      doc.text(`  · ${k}: ${fmt(v)}`, M, y);
      y += 6;
    }
  }

  const chargeTotal = charges.reduce((s, [, v]) => s + v, 0);
  const finalAmt = refundAmt - chargeTotal;
  y += 4;

  // 합계 박스
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(M, y, PAGE_W - M * 2, 18);
  doc.setFontSize(11);
  doc.text('합계 (환급 - 청구)', M + 5, y + 7);
  const sign = finalAmt >= 0 ? '환급' : '추가 청구';
  doc.setFontSize(13);
  doc.text(`${sign}  ${Math.abs(finalAmt).toLocaleString()}원`, PAGE_W - M - 5, y + 12, {
    align: 'right',
  });
  y += 26;

  // 안내문
  doc.setFontSize(10);
  const notice = [
    '2. 본 정산서에 이의가 있으실 경우 발행일로부터 7일 이내에 회신 부탁드립니다.',
    '3. 미회신 시 위 내역대로 정산이 확정됩니다.',
  ];
  for (const line of notice) {
    const wrapped = doc.splitTextToSize(line, PAGE_W - M * 2);
    doc.text(wrapped, M, y);
    y += 6 * wrapped.length;
  }
  y += 8;

  // 서명
  doc.setFontSize(10);
  doc.text(`${today()}`, PAGE_W / 2, y, { align: 'center' });
  y += 8;
  doc.text(`${data.company_name ?? '주식회사 ○○렌터카'}  (인)`, PAGE_W / 2, y, { align: 'center' });

  return doc;
}

export function downloadSettlementPdf(data: SettlementData): void {
  const doc = buildSettlementPdf(data);
  const fname = `정산서_${data.car_number ?? 'unknown'}_${data.return_date.replace(/-/g, '')}.pdf`;
  doc.save(fname);
}
