// src/domains/wealth-events/providers/bankx/bankx.adapter.ts
import * as z from 'zod';
import { ProviderAdapter } from '../provider-adapter';
import { buildDedupeKey } from 'src/domains/wealth-events/utils/dedupe';
import { NormalizedEventDto } from 'src/domains/wealth-events/dto/normalized-event.dto';

const BankXSchema = z.object({
  userId: z.string(),
  bankId: z.string(),
  txnId: z.string(),
  date: z.string(),
  type: z.enum(['credit', 'debit']).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  account: z.string(),
  description: z.string().optional(),
});

export const BankXAdapter: ProviderAdapter = {
  name: 'Bankx',
  schema: BankXSchema,
  normalize(payload: unknown): NormalizedEventDto {
    const p = BankXSchema.parse(payload);

    const timestamp = new Date(p.date).toISOString();
    const eventType = p.type === 'credit' ? 'FIAT_CREDIT' : 'FIAT_DEBIT';

    return {
      userId: p.userId,
      provider: p.bankId,
      sourceType: 'BANK',
      externalEventId: p.txnId,
      accountId: p.account,
      timestamp,
      eventType,
      amount: p.amount,
      currency: p.currency,
      description: p.description,
      dedupeKey: buildDedupeKey({
        provider: p.bankId,
        externalEventId: p.txnId,
        userId: p.userId,
      }),
      status: 'VALID',
      raw: payload,
    };
  },
};
