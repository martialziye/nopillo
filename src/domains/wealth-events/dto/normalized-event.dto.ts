export type ProviderName = 'Bankx' | 'Crypto' | 'Insurer';

export type NormalizedEventType =
  | 'FIAT_CREDIT'
  | 'FIAT_DEBIT'
  | 'CRYPTO_DEPOSIT'
  | 'CRYPTO_WITHDRAWAL'
  | 'INSURANCE_PREMIUM'
  | 'INSURANCE_PAYOUT';

export type EventStatus =
  | 'VALID'
  | 'INCOMPLETE'
  | 'DUPLICATE'
  | 'SUPERSDED'
  | 'IGNORED';
export type SourceType = 'BANK' | 'CRYPTO' | 'INSURER';

export class NormalizedEventDto {
  userId: string;

  provider: string;
  sourceType: SourceType;
  externalEventId?: string; // provider txnId/id/transactionId if exists
  accountId: string; // acc-01 / walletId / policyNumber etc.

  timestamp: string; // ISO string (always)
  eventType: NormalizedEventType;

  // money side
  currency?: string; // EUR...
  amount?: number; // fiat amount

  // crypto side
  asset?: string;
  fiatValue?: number;

  description?: string;

  // reconciliation fields
  dedupeKey: string;
  status: EventStatus;
  supersedesKey?: string; // if it replaced another event

  raw: unknown; // keep original payload (super useful for debugging)
}
