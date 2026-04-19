import { z } from 'zod';
import { DateStringSchema, StatusSchema, TimestampSchema } from './common';

export const LifecycleStage = z.enum([
  'acquired',     // 취득
  'marketing',    // 영업 (freepasserp 상품 등록 상태)
  'contracted',   // 계약 완료, 출고 대기
  'delivered',    // 출고 완료
  'operating',    // 운영중
  'expiring',     // 만기 임박 (auto: 30일 이내)
  'returned',     // 반납 완료
  'disposed',     // 매각
  'renewed',      // 연장 운행중
]);
export type LifecycleStage = z.infer<typeof LifecycleStage>;

export const LoanSchema = z.object({
  company: z.string(),
  principal: z.number(),
  interest_rate: z.number().optional(),
  term_months: z.number(),
  start_date: DateStringSchema,
  monthly_payment: z.number(),
  paid_months: z.number().default(0),
  balance: z.number(),
});
export type Loan = z.infer<typeof LoanSchema>;

export const AssetSchema = z.object({
  asset_id: z.string(),
  partner_code: z.string(),
  car_number: z.string(),
  vin: z.string().optional(),
  manufacturer: z.string(),
  model: z.string(),
  detail_model: z.string().optional(),
  trim: z.string().optional(),
  car_year: z.number().optional(),
  fuel_type: z.string().optional(),
  ext_color: z.string().optional(),
  int_color: z.string().optional(),
  first_registration_date: DateStringSchema.optional(),

  lifecycle_stage: LifecycleStage,
  primary_assignee_uid: z.string().optional(),

  current_mileage: z.number().optional(),
  last_maint_date: DateStringSchema.optional(),

  loan: LoanSchema.optional(),

  acquired_at: TimestampSchema.optional(),
  acquisition_cost: z.number().optional(),
  disposed_at: TimestampSchema.optional(),
  disposal_price: z.number().optional(),

  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  status: StatusSchema.default('active'),
});

export type Asset = z.infer<typeof AssetSchema>;

// 파생 통계 (Cloud Function 집계)
export const AssetStatsSchema = z.object({
  total_revenue: z.number(),
  loan_principal: z.number(),
  loan_paid: z.number(),
  loan_balance: z.number(),
  loan_interest: z.number(),
  maint_cost: z.number(),
  accident_cost: z.number(),
  fuel_cost: z.number(),
  wash_cost: z.number(),
  penalty_cost: z.number(),
  delivery_cost: z.number(),
  total_cost: z.number(),
  profit: z.number(),
  unpaid_count: z.number(),
  unpaid_amount: z.number(),
  max_overdue_days: z.number(),
  updated_at: TimestampSchema,
});

export type AssetStats = z.infer<typeof AssetStatsSchema>;
