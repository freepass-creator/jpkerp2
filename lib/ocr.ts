/**
 * ocr.ts — Google Vision OCR (jpkerp core/ocr.js 이식)
 *
 * 이미지: Vision API TEXT_DETECTION
 * PDF: pdf.js로 텍스트 레이어 추출 (디지털) 또는 이미지 OCR (스캔)
 */

// 주의: 프로덕션에선 env로 옮기는 게 좋지만, 기존 jpkerp 흐름 유지를 위해 공용 키 하드코드.
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_VISION_KEY ?? 'AIzaSyBSPo1kZOefX-6NuHoQdUF1htqQDSxXsCs';
const ENDPOINT = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

// pdf.js 동적 로드 (CDN ESM)
type PdfjsModule = {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocumentLike> };
  GlobalWorkerOptions: { workerSrc: string };
};
type PdfDocumentLike = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageLike>;
};
type PdfPageLike = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
};

let _pdfjsReady: Promise<PdfjsModule> | null = null;
async function loadPdfjs(): Promise<PdfjsModule> {
  if (_pdfjsReady) return _pdfjsReady;
  _pdfjsReady = (async () => {
    // @ts-expect-error — CDN dynamic import
    const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
    const lib = mod as PdfjsModule;
    lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    return lib;
  })();
  return _pdfjsReady;
}

async function pdfToImages(file: File, scale = 2.0): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
  const images: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    images.push(dataUrl.split(',')[1]);
  }
  return images;
}

async function ocrBase64(base64: string): Promise<string> {
  const body = {
    requests: [{ image: { content: base64 }, features: [{ type: 'TEXT_DETECTION', maxResults: 1 }] }],
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vision API: ${res.status}`);
  const data = await res.json();
  return (data.responses?.[0]?.fullTextAnnotation?.text as string | undefined) ?? '';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface OcrProgress {
  stage: 'render' | 'ocr';
  done: number;
  total: number;
  message: string;
}

/** 파일 → OCR 텍스트 (이미지·PDF 모두) */
export async function ocrFile(
  file: File,
  opts: { scale?: number; concurrency?: number; onProgress?: (p: OcrProgress) => void } = {},
): Promise<{ text: string; lines: string[] }> {
  const { scale = 1.5, concurrency = 6, onProgress } = opts;
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const progress = (stage: OcrProgress['stage'], done: number, total: number, message: string) =>
    onProgress?.({ stage, done, total, message });

  let fullText = '';
  if (ext === 'pdf') {
    progress('render', 0, 1, 'PDF 분석 중...');
    const pdfjs = await loadPdfjs();
    const arrayBuf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
    const total = pdf.numPages;
    const texts = new Array<string>(total);
    let hasText = false;
    for (let i = 0; i < total; i++) {
      const page = await pdf.getPage(i + 1);
      const content = await page.getTextContent();
      const pageText = content.items.map((it) => it.str).join(' ');
      texts[i] = pageText;
      if (pageText.replace(/\s/g, '').length > 30) hasText = true;
      progress('render', i + 1, total, `텍스트 추출 ${i + 1}/${total}`);
    }
    if (hasText) {
      fullText = texts.join('\n\n--- 페이지 구분 ---\n\n');
    } else {
      const images = await pdfToImages(file, scale);
      const ocrTexts = new Array<string>(total);
      let nextIdx = 0;
      let done = 0;
      progress('ocr', 0, total, `OCR 0/${total}`);
      await Promise.all(
        Array.from({ length: Math.min(concurrency, total) }, async () => {
          while (true) {
            const i = nextIdx++;
            if (i >= total) break;
            try { ocrTexts[i] = await ocrBase64(images[i]); } catch { ocrTexts[i] = ''; }
            done++;
            progress('ocr', done, total, `OCR ${done}/${total}`);
          }
        }),
      );
      fullText = ocrTexts.join('\n\n--- 페이지 구분 ---\n\n');
    }
  } else {
    progress('ocr', 0, 1, 'OCR 중...');
    const base64 = await fileToBase64(file);
    fullText = await ocrBase64(base64);
    progress('ocr', 1, 1, 'OCR 완료');
  }

  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
  return { text: fullText, lines };
}

/** 차량번호 추출 — "12가 3456" 또는 "12가3456" */
export function extractCarNumber(text: string): string | null {
  const m = text.match(/\d{2,3}[가-힣]\s?\d{4}/g);
  return m ? m[0].replace(/\s/g, '') : null;
}

/** VIN (차대번호 17자리) */
export function extractVin(text: string): string | null {
  const m = text.match(/[A-HJ-NPR-Z0-9]{17}/g);
  return m ? m[0] : null;
}

/** 금액 (가장 큰 "숫자,숫자원" 패턴) */
export function extractAmount(text: string): number | null {
  const matches = text.match(/[\d,]+원/g) ?? [];
  const amounts = matches.map((m) => Number(m.replace(/[,원]/g, ''))).filter((n) => n > 0);
  return amounts.length ? Math.max(...amounts) : null;
}

/** 날짜 (yyyy.mm.dd / yy-mm-dd / 년월일) */
export function extractDate(text: string): string | null {
  const patterns = [
    /(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?/,
    /(\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const y = m[1].length === 2 ? (Number(m[1]) < 50 ? 2000 + Number(m[1]) : 1900 + Number(m[1])) : Number(m[1]);
      return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    }
  }
  return null;
}
