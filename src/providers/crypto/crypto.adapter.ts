// src/domains/wealth-events/providers/bankx/bankx.adapter.ts
import * as z from 'zod';
import { ProviderAdapter } from '../provider-adapter';
import { buildDedupeKey } from 'src/domains/wealth-events/utils/dedupe';
import { NormalizedEventDto } from 'src/domains/wealth-events/dto/normalized-event.dto';

const CryptoSchema = z.object({
  userId: z.string(),
  platform: z.string(),
  id: z.string(),
  time: z.number(),
  type: z.enum(['crypto_deposit', 'crypto_withdrawal']).optional(),
  asset: z.string().optional(),
  amount: z.number().optional(),
  fiatValue: z.number().optional(),
  currency: z.string().optional(),
  walletId: z.string(),
});

export const CryptoAdapter: ProviderAdapter = {
  name: 'Crypto',
  schema: CryptoSchema,
  normalize(payload: unknown): NormalizedEventDto {
    const p = CryptoSchema.parse(payload);

    const timestamp = new Date(p.time).toISOString();
    const eventType =
      p.type === 'crypto_deposit' ? 'CRYPTO_DEPOSIT' : 'CRYPTO_WITHDRAWAL';

    return {
      userId: p.userId,
      provider: p.platform,
      sourceType: 'CRYPTO',
      externalEventId: p.id,
      accountId: p.walletId,
      timestamp,
      eventType,
      asset: p.asset,
      amount: p.amount,
      fiatValue: p.fiatValue,
      currency: p.currency,
      dedupeKey: buildDedupeKey({
        provider: p.platform,
        externalEventId: p.id,
        userId: p.userId,
      }),
      status: 'VALID',
      raw: payload,
    };
  },
};
