import { z } from 'zod';
import { DateStringSchema, StatusSchema, TimestampSchema } from './common';

export const ContractStatus = z.enum([
  'draft',       // freepasserp 동기화 직후 초안
  '계약대기',
  '계약진행',
  '계약완료',
  '계약해지',
]);
export type ContractStatus = z.infer<typeof ContractStatus>;

export const SyncStatus = z.enum([
  'pending_review', // 동기화 직후 검토 대기
  'active',         // 관리자 승인 완료
  'closed',         // 종료
]);
export type SyncStatus = z.infer<typeof SyncStatus>;

export const ContractSchema = z.object({
  contract_code: z.string(),
  partner_code: z.string(),
  asset_id: z.string(),
  customer_id: z.string(),
  primary_assignee_uid: z.string(),

  contract_status: ContractStatus,

  start_date: DateStringSchema,
  end_date: DateStringSchema.optional(),
  rent_months: z.number(),
  rent_amount: z.number(),
  deposit: z.number().optional(),
  auto_debit_day: z.number().min(1).max(31).optional(),

  // 연장·재계약
  original_contract_id: z.string().optional(),
  is_extension: z.boolean().default(false),
  is_renewal: z.boolean().default(false),

  // freepasserp 동기화
  sync_status: SyncStatus,
  freepasserp_contract_id: z.string().optional(),

  contract_doc_urls: z.array(z.string()).default([]),
  insurance_doc_urls: z.array(z.string()).default([]),

  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  status: StatusSchema.default('active'),
});

export type Contract = z.infer<typeof ContractSchema>;
