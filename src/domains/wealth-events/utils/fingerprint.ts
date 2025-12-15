import crypto from 'crypto';
import { NormalizedEventDto } from '../dto/normalized-event.dto';
export function buildFingerprint(event: NormalizedEventDto): string {
  const fingerprintPayload = {
    eventType: event.eventType,
    amount: event.amount,
    currency: event.currency,
    asset: event.asset,
    fiatValue: event.fiatValue,
    timestamp: event.timestamp,
    description: event.description,
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprintPayload))
    .digest('hex');
}
