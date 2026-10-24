# ADR 0002: Row Level Security plus server-side money movement

- **Status:** Accepted
- **Decision:** Every table has RLS enabled. Contributions, status changes and audit entries are written only server-side with the service-role key, after use-case checks (KYC, limits, milestone approval). Clients can read only what policies allow.
- **Consequences:** Clients cannot forge contributions or release funds. The service-role key must never reach the browser (`src/config/env.ts` keeps it in the server schema).
