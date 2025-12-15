import { NormalizedEventDto } from '../dto/normalized-event.dto';
export function computeScore(event: NormalizedEventDto): number {
  let score = 0;

  if (event.accountId) score += 1;
  if (event.timestamp) score += 1;

  if (typeof event.amount === 'number') score += 1;
  if (typeof event.currency === 'string') score += 1;

  if (typeof event.asset === 'string') score += 1;
  if (typeof event.fiatValue === 'number') score += 1;

  if (event.eventType) score += 1;
  if (event.description) score += 1;

  return score;
}

export function compareEventScore(
  existing: NormalizedEventDto,
  incoming: NormalizedEventDto,
): NormalizedEventDto {
  // Prefer VALID over INCOMPLETE
  if (existing.status !== incoming.status) {
    if (existing.status === 'VALID') return existing;
    if (incoming.status === 'VALID') return incoming;
  }

  // Prefer higher completeness
  const existingScore = computeScore(existing) ?? 0;
  const incomingScore = computeScore(incoming) ?? 0;

  if (existingScore !== incomingScore) {
    return existingScore > incomingScore ? existing : incoming;
  }

  // Last write wins (incoming)
  return incoming;
}
