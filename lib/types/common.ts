import { z } from 'zod';

// Firestore Timestamp 또는 Date 또는 epoch ms
export const TimestampSchema = z.union([
  z.date(),
  z.number(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
  z.string(),
]);

export type Timestamp = z.infer<typeof TimestampSchema>;

export const StatusSchema = z.enum(['active', 'deleted']);
export type Status = z.infer<typeof StatusSchema>;

// YYYY-MM-DD
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다');

export const PhoneSchema = z.string().regex(/^\d{2,3}-?\d{3,4}-?\d{4}$/);
