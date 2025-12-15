// src/domains/wealth-events/utils/dedupe.ts
import crypto from 'crypto';

export function buildDedupeKey(input: Record<string, unknown>) {
  const str = JSON.stringify(input);
  return crypto.createHash('sha256').update(str).digest('hex');
}
