export type FailureMode = "none" | "timeout" | "unavailable";

export class ExternalError extends Error {
  constructor(public readonly kind: Exclude<FailureMode, "none">) {
    super(kind);
  }
}

export type Principal = Readonly<{ id: string; role: "user" | "admin" }>;
export type DocumentRecord = Readonly<{ id: string; ownerId: string; title: string }>;
export type Payment = Readonly<{ id: string; ownerId: string; amount: number }>;
export type AuditEvent = Readonly<{
  actor: string;
  action: string;
  requestId: string;
  details: Readonly<Record<string, unknown>>;
}>;

export interface FailureInjectable { failWith(mode: FailureMode): void }
export interface IdentityProvider extends FailureInjectable { authenticate(token: string, requestId: string): Promise<Principal> }
export interface DocumentStore extends FailureInjectable {
  findOwned(id: string, ownerId: string): Promise<DocumentRecord | undefined>;
  create(ownerId: string, title: string): Promise<DocumentRecord>;
}
export interface RateLimitStore extends FailureInjectable { consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number }> }
export interface PaymentGateway extends FailureInjectable {
  charge(ownerId: string, key: string, amount: number, requestId: string): Promise<Payment>;
  readonly chargeCount: number;
}
export interface AuditSink extends FailureInjectable {
  write(event: AuditEvent): Promise<void>;
  readonly events: readonly AuditEvent[];
}
