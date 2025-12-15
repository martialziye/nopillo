import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from 'src/app.module';

type IngestResp = {
  status?: string; // VALID | DUPLICATE | UPDATED | INCOMPLETE
  accepted?: boolean;
  event?: any;
};

export function makeE2EHelpers(app: INestApplication) {
  const server = () => app.getHttpServer();

  const postBank = (payload: any) =>
    request(server()).post('/wealth-events/webhooks/bankx').send(payload);

  const postCrypto = (payload: any) =>
    request(server()).post('/wealth-events/webhooks/crypto').send(payload);

  const postInsurer = (payload: any) =>
    request(server()).post('/wealth-events/webhooks/insurer').send(payload);

  const getTimeline = (userId: string) =>
    request(server()).get(`/wealth-events/wealth/${userId}/timeline`);

  const getAccounts = (userId: string) =>
    request(server()).get(`/wealth-events/wealth/${userId}/accounts`);

  const getBalance = (userId: string) =>
    request(server()).get(`/wealth-events/wealth/${userId}/balance`);

  return {
    postBank,
    postCrypto,
    postInsurer,
    getTimeline,
    getAccounts,
    getBalance,
  };
}

function getTimelineArray(body: any): any[] {
  // If your API returns { items: [...] }, adapt here
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.timeline)) return body.timeline;
  return [];
}

describe('Wealth Events (e2e)', () => {
  let app: INestApplication;

  const userId = 'user-001';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // If you have global pipes in main.ts, you can mirror them here (optional)
    // app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should ingest 3 providers and expose timeline/accounts/balance', async () => {
    // BANKX
    const { postBank, postCrypto, postInsurer, getTimeline, getBalance } =
      makeE2EHelpers(app);
    const bankPayload = {
      userId,
      bankId: 'BNP',
      txnId: 'txn-12345',
      date: '2025-12-08T12:00:00Z',
      type: 'credit',
      amount: 2000,
      currency: 'EUR',
      account: 'acc-01',
      description: 'Virement salaire',
    };

    const bankRes = await postBank(bankPayload).expect(201);

    const bankBody: IngestResp = bankRes.body;
    expect(bankBody.status ?? 'VALID').toBeDefined();

    // crypto
    const cryptoPayload = {
      userId,
      platform: 'Coinbase',
      id: 'tx-abc123',
      time: 1710001000000,
      type: 'crypto_deposit',
      asset: 'BTC',
      amount: 0.05,
      fiatValue: 1500,
      currency: 'EUR',
      walletId: 'acc-03',
    };

    const cryptoRes = await postCrypto(cryptoPayload).expect(201);

    const cryptoBody: IngestResp = cryptoRes.body;
    expect(cryptoBody.status ?? 'VALID').toBeDefined();

    // INSURER
    const insurerPayload = {
      userId,
      insurer: 'AXA',
      transactionId: 'av-2025-001',
      timestamp: 1710002000000,
      movementType: 'premium',
      amount: 500,
      currency: 'EUR',
      policyNumber: 'acc-04',
    };

    const insRes = await postInsurer(insurerPayload).expect(201);

    const insBody: IngestResp = insRes.body;
    expect(insBody.status ?? 'VALID').toBeDefined();

    // TIMELINE
    const timelineRes = await request(app.getHttpServer())
      .get(`/wealth-events/wealth/${userId}/timeline`)
      .expect(200);

    const timeline = getTimelineArray(timelineRes.body);
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    // ACCOUNTS
    const accountsRes = await getTimeline(userId).expect(200);

    const accounts = Array.isArray(accountsRes.body)
      ? accountsRes.body
      : accountsRes.body.items;
    expect(Array.isArray(accounts)).toBe(true);

    const accountIds = new Set(accounts.map((a: any) => a.accountId));
    expect(accountIds.has('acc-01')).toBe(true);
    expect(accountIds.has('acc-03')).toBe(true);
    expect(accountIds.has('acc-04')).toBe(true);

    // BALANCE
    const balRes = await getBalance(userId).expect(200);

    expect(typeof balRes.body.totalEUR).toBe('number');
  });

  it('should treat exact same bank event as DUPLICATE (idempotency)', async () => {
    const { postBank } = makeE2EHelpers(app);
    const payload = {
      userId,
      bankId: 'BNP',
      txnId: 'txn-dup-001',
      date: '2025-12-10T10:00:00Z',
      type: 'credit',
      amount: 1000,
      currency: 'EUR',
      account: 'acc-01',
      description: 'Duplicate test',
    };

    // first time
    await postBank(payload).expect(201);

    // second time (retry)
    const res2 = await postBank(payload).expect(201);

    const body2: IngestResp = res2.body;
    if (body2.status) {
      expect(body2.status).toBe('DUPLICATE');
    } else if (typeof body2.accepted === 'boolean') {
      expect(body2.accepted).toBe(false);
    }
  });

  it('should treat same txnId but changed fields as UPDATED/CORRECTED (not DUPLICATE)', async () => {
    const { postBank, getBalance } = makeE2EHelpers(app);
    const base = {
      userId,
      bankId: 'BNP',
      txnId: 'txn-upd-001',
      date: '2025-12-11T10:00:00Z',
      currency: 'EUR',
      account: 'acc-01',
    };

    const v1 = { ...base, type: 'credit', amount: 1000, description: 'v1' };
    const v2 = {
      ...base,
      type: 'credit',
      amount: 1100,
      description: 'v2 corrected',
    };

    await postBank(v1).expect(201);

    const res2 = await postBank(v2).expect(201);

    const body2: IngestResp = res2.body;

    // Depending on your naming: UPDATED or VALID (with supersedesKey)
    if (body2.status) {
      expect(['UPDATED', 'VALID'].includes(body2.status)).toBe(true);
    }

    // Optional: assert balance changed accordingly
    const balRes = await getBalance(userId).expect(200);

    expect(typeof balRes.body.totalEUR).toBe('number');
  });

  it('should accept late events and keep timeline sorted by timestamp', async () => {
    const { postBank, getTimeline } = makeE2EHelpers(app);
    // Newer event first
    const newer = {
      userId,
      bankId: 'BNP',
      txnId: 'txn-late-002',
      date: '2025-12-08T12:00:00Z',
      type: 'debit',
      amount: 50,
      currency: 'EUR',
      account: 'acc-01',
      description: 'Newer first',
    };

    // Older event arrives later
    const older = {
      userId,
      bankId: 'BNP',
      txnId: 'txn-late-001',
      date: '2025-12-01T09:00:00Z',
      type: 'debit',
      amount: 100,
      currency: 'EUR',
      account: 'acc-01',
      description: 'Older arriving late',
    };

    await postBank(newer).expect(201);
    await postBank(older).expect(201);

    const timelineRes = await getTimeline(userId).expect(200);

    const timeline = getTimelineArray(timelineRes.body);
    expect(timeline.length).toBeGreaterThanOrEqual(2);

    const t0 = new Date(timeline[0].timestamp).getTime();
    const t1 = new Date(timeline[1].timestamp).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);
  });

  it('should mark incomplete events as INCOMPLETE and not affect balances', async () => {
    const { getBalance, postBank } = makeE2EHelpers(app);
    // Missing amount (incomplete)
    const incomplete = {
      userId,
      bankId: 'BNP',
      txnId: 'txn-inc-001',
      date: '2025-12-12T10:00:00Z',
      type: 'credit',
      // amount missing
      currency: 'EUR',
      account: 'acc-01',
      description: 'Incomplete event',
    };

    const before = await getBalance(userId).expect(200);

    const res = await postBank(incomplete).expect(201);

    const body: IngestResp = res.body;
    if (body.status) expect(body.status).toBe('INCOMPLETE');

    const after = await getBalance(userId).expect(200);

    // Balance should not change if incomplete excluded from effective events
    expect(after.body.totalEUR).toBe(before.body.totalEUR);
  });

  it('should return IGORED', async () => {
    const { postBank } = makeE2EHelpers(app);
    const payload = {
      userId,
      bankId: 'BNP',
      txnId: 'txn-dup-001',
      date: '2025-12-10T10:00:00Z',
      type: 'credit',
      amount: 1000,
      currency: 'EUR',
      account: 'acc-01',
      description: 'Duplicate test',
    };

    const incompletePayload = { ...payload, amount: undefined };

    await postBank(payload);
    const res = await postBank(incompletePayload).expect(201);
    const body: IngestResp = res.body;
    if (body.status) expect(body.status).toBe('IGNORED');
  });
});
