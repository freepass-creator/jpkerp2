export interface UploadRow {
  _id: string;
  _direct: boolean;
  _raw?: {
    filename?: string;
    rows?: unknown[];
    [k: string]: unknown;
  };
  _records?: Record<string, unknown>[];
  uploaded_at?: number;
  method: 'bulk' | 'single';
  method_label: '대량' | '개별';
  type: string;
  type_label: string;
  filename: string;
  total: number;
  ok: number;
  skip: number;
  fail: number;
  committed_label: string;
}
