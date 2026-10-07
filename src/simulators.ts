import { ExternalError, type AuditEvent, type AuditSink, type DocumentRecord, type DocumentStore, type FailureMode, type IdentityProvider, type Payment, type PaymentGateway, type Principal, type RateLimitStore } from "./ports.js";

const check = async (mode: FailureMode): Promise<void> => {
  if (mode === "timeout") await Promise.reject(new ExternalError("timeout"));
  if (mode === "unavailable") throw new ExternalError("unavailable");
};

class IdentitySimulator implements IdentityProvider {
  private mode: FailureMode = "none";
  failWith(mode: FailureMode): void { this.mode = mode; }
  async authenticate(token: string, _requestId: string): Promise<Principal> {
    await check(this.mode);
    const users: Readonly<Record<string, Principal>> = {
      "alice-token": { id: "alice", role: "user" },
      "bob-token": { id: "bob", role: "user" },
      "admin-token": { id: "admin", role: "admin" }
    };
    const principal = users[token];
    if (!principal || token === "expired-token" || token === "revoked-token") throw new Error("unauthorized");
    return principal;
  }
}

class DocumentSimulator implements DocumentStore {
  private mode: FailureMode = "none";
  private sequence = 2;
  private readonly records = new Map<string, DocumentRecord>([
    ["document-1", { id: "document-1", ownerId: "alice", title: "Alice notes" }],
    ["document-2", { id: "document-2", ownerId: "bob", title: "Bob notes" }]
  ]);
  failWith(mode: FailureMode): void { this.mode = mode; }
  async findOwned(id: string, ownerId: string): Promise<DocumentRecord | undefined> {
    await check(this.mode);
    const record = this.records.get(id);
    return record?.ownerId === ownerId ? record : undefined;
  }
  async create(ownerId: string, title: string): Promise<DocumentRecord> {
    await check(this.mode);
    const record = { id: `document-${++this.sequence}`, ownerId, title } as const;
    this.records.set(record.id, record);
    return record;
  }
}

class RedisSimulator implements RateLimitStore {
  private mode: FailureMode = "none";
  private readonly counters = new Map<string, number>();
  failWith(mode: FailureMode): void { this.mode = mode; }
  async consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number }> {
    await check(this.mode);
    const value = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, value);
    return { allowed: value <= limit, retryAfter: Math.ceil(windowMs / 1000) };
  }
}

class PaymentSimulator implements PaymentGateway {
  private mode: FailureMode = "none";
  private readonly pending = new Map<string, Promise<Payment>>();
  private readonly fingerprints = new Map<string, number>();
  private count = 0;
  failWith(mode: FailureMode): void { this.mode = mode; }
  get chargeCount(): number { return this.count; }
  async charge(ownerId: string, key: string, amount: number, _requestId: string): Promise<Payment> {
    await check(this.mode);
    const scope = `${ownerId}:${key}`;
    const priorAmount = this.fingerprints.get(scope);
    if (priorAmount !== undefined && priorAmount !== amount) throw new Error("conflict");
    const existing = this.pending.get(scope);
    if (existing) return existing;
    this.fingerprints.set(scope, amount);
    const operation = Promise.resolve().then(() => {
      this.count++;
      return { id: `payment-${this.count}`, ownerId, amount };
    });
    this.pending.set(scope, operation);
    return operation;
  }
}

class AuditSimulator implements AuditSink {
  private mode: FailureMode = "none";
  private readonly stored: AuditEvent[] = [];
  failWith(mode: FailureMode): void { this.mode = mode; }
  get events(): readonly AuditEvent[] { return Object.freeze([...this.stored]); }
  async write(event: AuditEvent): Promise<void> {
    await check(this.mode);
    const details = Object.fromEntries(Object.entries(event.details).map(([key, value]) => [key, /token|secret|password/i.test(key) ? "[REDACTED]" : value]));
    this.stored.push(Object.freeze({ ...event, details: Object.freeze(details) }));
  }
}

export const createIdentityProvider = (): IdentityProvider => new IdentitySimulator();
export const createStores = (): { documents: DocumentStore; redis: RateLimitStore } => ({ documents: new DocumentSimulator(), redis: new RedisSimulator() });
export const createPaymentAndAudit = (): { payments: PaymentGateway; audit: AuditSink } => ({ payments: new PaymentSimulator(), audit: new AuditSimulator() });
