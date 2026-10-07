import { ExternalError } from "./ports.js";
const check = async (mode) => {
    if (mode === "timeout")
        await Promise.reject(new ExternalError("timeout"));
    if (mode === "unavailable")
        throw new ExternalError("unavailable");
};
class IdentitySimulator {
    mode = "none";
    failWith(mode) { this.mode = mode; }
    async authenticate(token, _requestId) {
        await check(this.mode);
        const users = {
            "alice-token": { id: "alice", role: "user" },
            "bob-token": { id: "bob", role: "user" },
            "admin-token": { id: "admin", role: "admin" }
        };
        const principal = users[token];
        if (!principal || token === "expired-token" || token === "revoked-token")
            throw new Error("unauthorized");
        return principal;
    }
}
class DocumentSimulator {
    mode = "none";
    sequence = 2;
    records = new Map([
        ["document-1", { id: "document-1", ownerId: "alice", title: "Alice notes" }],
        ["document-2", { id: "document-2", ownerId: "bob", title: "Bob notes" }]
    ]);
    failWith(mode) { this.mode = mode; }
    async findOwned(id, ownerId) {
        await check(this.mode);
        const record = this.records.get(id);
        return record?.ownerId === ownerId ? record : undefined;
    }
    async create(ownerId, title) {
        await check(this.mode);
        const record = { id: `document-${++this.sequence}`, ownerId, title };
        this.records.set(record.id, record);
        return record;
    }
}
class RedisSimulator {
    mode = "none";
    counters = new Map();
    failWith(mode) { this.mode = mode; }
    async consume(key, limit, windowMs) {
        await check(this.mode);
        const value = (this.counters.get(key) ?? 0) + 1;
        this.counters.set(key, value);
        return { allowed: value <= limit, retryAfter: Math.ceil(windowMs / 1000) };
    }
}
class PaymentSimulator {
    mode = "none";
    pending = new Map();
    fingerprints = new Map();
    count = 0;
    failWith(mode) { this.mode = mode; }
    get chargeCount() { return this.count; }
    async charge(ownerId, key, amount, _requestId) {
        await check(this.mode);
        const scope = `${ownerId}:${key}`;
        const priorAmount = this.fingerprints.get(scope);
        if (priorAmount !== undefined && priorAmount !== amount)
            throw new Error("conflict");
        const existing = this.pending.get(scope);
        if (existing)
            return existing;
        this.fingerprints.set(scope, amount);
        const operation = Promise.resolve().then(() => {
            this.count++;
            return { id: `payment-${this.count}`, ownerId, amount };
        });
        this.pending.set(scope, operation);
        return operation;
    }
}
class AuditSimulator {
    mode = "none";
    stored = [];
    failWith(mode) { this.mode = mode; }
    get events() { return Object.freeze([...this.stored]); }
    async write(event) {
        await check(this.mode);
        const details = Object.fromEntries(Object.entries(event.details).map(([key, value]) => [key, /token|secret|password/i.test(key) ? "[REDACTED]" : value]));
        this.stored.push(Object.freeze({ ...event, details: Object.freeze(details) }));
    }
}
export const createIdentityProvider = () => new IdentitySimulator();
export const createStores = () => ({ documents: new DocumentSimulator(), redis: new RedisSimulator() });
export const createPaymentAndAudit = () => ({ payments: new PaymentSimulator(), audit: new AuditSimulator() });
