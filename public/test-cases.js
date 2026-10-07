const stages = ["client", "headers", "authentication", "rate-limit", "policy", "service", "response"];
const rows = [
  ["sim.identity.tokens", "accepts valid tokens and rejects expired or revoked tokens", "simulator", "both", [200,401], ["Authentication"], "replay", false, "test/simulators/identity.test.ts"],
  ["sim.identity.timeout", "fails closed on timeout and never leaks token values", "simulator", "both", [500], ["Authentication","Error hygiene"], "replay", false, "test/simulators/identity.test.ts"],
  ["sim.payment.concurrent", "charges once when concurrent retries use same idempotency key", "simulator", "both", [201], ["Idempotency"], "replay", true, "test/simulators/payment-audit.test.ts"],
  ["sim.payment.conflict", "rejects key reuse with different payload", "simulator", "both", [409], ["Idempotency"], "replay", true, "test/simulators/payment-audit.test.ts"],
  ["sim.audit.redaction", "redacts secrets from append-only audit events", "simulator", "both", [200], ["Audit logging"], "replay", true, "test/simulators/payment-audit.test.ts"],
  ["sim.store.ownership", "enforces document ownership at repository boundary", "simulator", "both", [404], ["Authorization"], "replay", false, "test/simulators/stores.test.ts"],
  ["sim.store.rate", "atomically permits only configured request count", "simulator", "both", [429], ["Rate limiting"], "replay", true, "test/simulators/stores.test.ts"],
  ["sim.store.failure", "fails explicitly when external storage is unavailable", "simulator", "both", [500], ["Resilience"], "replay", false, "test/simulators/stores.test.ts"],
  ...["express","nest"].flatMap(framework => [
    [`contract.${framework}.auth`, "requires authentication and hides foreign resources", "contract", framework, [200,401,404], ["Authentication","Authorization"], "live", false, "test/contract/http.test.ts"],
    [`contract.${framework}.writes`, "validates writes and ignores client authority claims", "contract", framework, [400], ["Validation","Least privilege"], "live", false, "test/contract/http.test.ts"],
    [`contract.${framework}.limits`, "rate limits, returns secure headers, and hides internal errors", "contract", framework, [429,500], ["Rate limiting","Headers","Error hygiene"], "live", true, "test/contract/http.test.ts"],
    [`contract.${framework}.payment`, "makes payment retries idempotent", "contract", framework, [200,201,409], ["Idempotency"], "live", true, "test/contract/http.test.ts"]
  ]),
  ["deploy.site", "serves health and interactive site", "deployment", "both", [200], ["Deployment"], "deployment", false, "test/deployment/public.test.ts"],
  ["deploy.routes", "routes same behavior through both public framework paths", "deployment", "both", [200], ["Contract"], "deployment", false, "test/deployment/public.test.ts"],
  ["deploy.headers", "sets public security headers and rejects unsupported methods", "deployment", "both", [404,405], ["Headers"], "deployment", false, "test/deployment/public.test.ts"],
  ["deploy.json", "maps malformed JSON to 400 without internal details", "deployment", "both", [400], ["Validation","Error hygiene"], "deployment", false, "test/deployment/public.test.ts"],
  ["e2e.express.contract", "express serves the security contract", "e2e-http", "express", [200,400,401,404], ["Contract"], "live", false, "test/e2e/api.spec.ts"],
  ["e2e.nest.contract", "nest serves the security contract", "e2e-http", "nest", [200,400,401,404], ["Contract"], "live", false, "test/e2e/api.spec.ts"],
  ["e2e.smoke", "@smoke serves health, static files, and deployment headers", "e2e-http", "both", [200,404,405], ["Deployment","Headers"], "deployment", false, "test/e2e/api.spec.ts"],
  ["e2e.request-id", "preserves safe request IDs and replaces invalid IDs", "e2e-http", "express", [200], ["Request ID"], "live", false, "test/e2e/api.spec.ts"],
  ["e2e.boundaries", "enforces payload limits, safe failures, rate limits, and payment idempotency", "e2e-http", "both", [200,201,409,413,429,500], ["Validation","Error hygiene","Rate limiting","Idempotency"], "live", true, "test/e2e/api.spec.ts"],
  ["ui.smoke", "@smoke renders controls and static assets", "browser", "both", [200], ["Accessibility"], "live", false, "test/e2e/public.spec.ts"],
  ["ui.guide", "@smoke guide filters controls and deep-links to a lab preset", "browser", "both", [200], ["Navigation","Accessibility"], "live", false, "test/e2e/public.spec.ts"],
  ...["Express","NestJS"].flatMap(label => { const framework = label.toLowerCase().replace("js", ""); return [
    [`ui.${framework}.documents`, `${label} owned and foreign document scenarios`, "browser", framework, [200,404], ["Authorization"], "live", false, "test/e2e/public.spec.ts"],
    [`ui.${framework}.errors`, `${label} validates invalid documents and safe failures`, "browser", framework, [400,500], ["Validation","Error hygiene"], "live", false, "test/e2e/public.spec.ts"],
    [`ui.${framework}.identity`, `${label} rejects missing and expired identity`, "browser", framework, [401], ["Authentication"], "live", false, "test/e2e/public.spec.ts"]
  ]; }),
  ["ui.visualization", "visualizes every test mode accessibly at narrow width", "browser", "both", [200,500], ["Accessibility"], "replay", false, "test/e2e/public.spec.ts"],
  ["ui.payment", "replays payment safely", "browser", "express", [200,201], ["Idempotency"], "live", true, "test/e2e/public.spec.ts"]
];

export const testCases = rows.map(([id, name, layer, framework, expectedStatus, controls, executionMode, mutates, sourceFile]) => ({
  id, name, layer, framework, expectedStatus, controls, stages, executionMode, mutates, sourceFile
}));

