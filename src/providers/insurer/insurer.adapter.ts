// src/domains/wealth-events/providers/bankx/bankx.adapter.ts
import * as z from 'zod';
import { ProviderAdapter } from '../provider-adapter';
import { buildDedupeKey } from 'src/domains/wealth-events/utils/dedupe';
import { NormalizedEventDto } from 'src/domains/wealth-events/dto/normalized-event.dto';

const InsurerSchema = z.object({
  userId: z.string(),
  insurer: z.string(),
  transactionId: z.string(),
  timestamp: z.number(),
  movementType: z.enum(['premium', 'payout']).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  policyNumber: z.string(),
});

export const InsurerAdapter: ProviderAdapter = {
  name: 'Insurer',
  schema: InsurerSchema,
  normalize(payload: unknown): NormalizedEventDto {
    const p = InsurerSchema.parse(payload);

    const timestamp = new Date(p.timestamp).toISOString();
    const eventType =
      p.movementType === 'premium' ? 'INSURANCE_PREMIUM' : 'INSURANCE_PAYOUT';

    return {
      userId: p.userId,
      provider: p.insurer,
      sourceType: 'INSURER',
      externalEventId: p.transactionId,
      accountId: p.policyNumber,
      timestamp,
      eventType,
      amount: p.amount,
      currency: p.currency,
      dedupeKey: buildDedupeKey({
        provider: p.insurer,
        externalEventId: p.transactionId,
        userId: p.userId,
      }),
      status: 'VALID',
      raw: payload,
    };
  },
};
