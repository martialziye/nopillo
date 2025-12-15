import { Injectable } from '@nestjs/common';
import { NormalizedEventDto } from './dto/normalized-event.dto';
import { buildFingerprint } from './utils/fingerprint';
import { compareEventScore } from './utils/score';
type IngestResult = {
  accepted: boolean;
  status: NormalizedEventDto['status'];
  event: NormalizedEventDto;
};

@Injectable()
export class WealthEventsService {
  private eventsByUser = new Map<string, NormalizedEventDto[]>();
  private dedupeIndex = new Map<string, NormalizedEventDto>();

  ingest(event: NormalizedEventDto): IngestResult {
    // mark incomplete
    if (
      !event.timestamp ||
      !event.userId ||
      !event.accountId ||
      !event.eventType ||
      !event.amount
    ) {
      event.status = 'INCOMPLETE';
    }
    const existing = this.dedupeIndex.get(event.dedupeKey);
    if (existing) {
      // If identical: DUPLICATE
      const same = buildFingerprint(existing) === buildFingerprint(event);
      if (same) {
        event.status = 'DUPLICATE';
        return { accepted: false, status: 'DUPLICATE', event: existing };
      }

      const winningEvent = compareEventScore(existing, event);

      if (winningEvent === existing) {
        return { accepted: false, status: 'IGNORED', event: existing };
      }
      // Else contradiction: supersede existing
      existing.status = 'SUPERSDED';
      event.supersedesKey = existing.dedupeKey;

      this.replaceEvent(existing, event);
      this.dedupeIndex.set(event.dedupeKey, event);

      return { accepted: true, status: 'VALID', event };
    }

    this.addEvent(event);
    this.dedupeIndex.set(event.dedupeKey, event);
    return {
      accepted: event.status !== 'INCOMPLETE',
      status: event.status,
      event,
    };
  }

  getTimeline(userId: string) {
    return (this.eventsByUser.get(userId) ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }

  getAccounts(userId: string) {
    const events = this.getEffectiveEvents(userId);
    const byAcc = new Map<
      string,
      { accountId: string; balanceEUR: number; assets: Record<string, number> }
    >();

    for (const e of events) {
      const acc = byAcc.get(e.accountId) ?? {
        accountId: e.accountId,
        balanceEUR: 0,
        assets: {},
      };

      // fiat
      if (e.currency === 'EUR' && typeof e.amount === 'number') {
        if (e.eventType === 'FIAT_CREDIT') acc.balanceEUR += e.amount;
        if (e.eventType === 'FIAT_DEBIT') acc.balanceEUR -= e.amount;
        if (e.eventType === 'INSURANCE_PREMIUM') acc.balanceEUR -= e.amount;
        if (e.eventType === 'INSURANCE_PAYOUT') acc.balanceEUR += e.amount;
      }

      if (e.asset && typeof e.amount === 'number') {
        acc.assets[e.asset] = (acc.assets[e.asset] ?? 0) + e.amount;
      }

      byAcc.set(e.accountId, acc);
    }

    return [...byAcc.values()];
  }

  getGlobalBalance(userId: string) {
    const accounts = this.getAccounts(userId);
    const totalEUR = accounts.reduce((s, a) => s + a.balanceEUR, 0);

    const cryptoEUR = this.getEffectiveEvents(userId)
      .filter((e) => typeof e.fiatValue === 'number' && e.currency === 'EUR')
      .reduce(
        (s, e) =>
          s +
          (e.eventType === 'CRYPTO_WITHDRAWAL' ? -e.fiatValue! : e.fiatValue!),
        0,
      );

    return { totalEUR: totalEUR + cryptoEUR };
  }

  private getEffectiveEvents(userId: string) {
    return (this.eventsByUser.get(userId) ?? []).filter(
      (e) => e.status === 'VALID',
    );
  }

  private addEvent(event: NormalizedEventDto) {
    const arr = this.eventsByUser.get(event.userId) ?? [];
    arr.push(event);
    this.eventsByUser.set(event.userId, arr);
  }

  private replaceEvent(oldEv: NormalizedEventDto, newEv: NormalizedEventDto) {
    const arr = this.eventsByUser.get(oldEv.userId) ?? [];
    const idx = arr.findIndex((e) => e.dedupeKey === oldEv.dedupeKey);
    if (idx >= 0) arr[idx] = newEv;
    else arr.push(newEv);
    this.eventsByUser.set(oldEv.userId, arr);
  }
}
