# ADR 0001: Layered architecture with ports and adapters

- **Status:** Accepted
- **Context:** A solo developer is building a security-sensitive funding platform in a short time, with AI assistance, and expects the product to outlive the hackathon. Verification, payment and banking providers are not yet chosen, and regulation may change what is allowed.
- **Decision:** Separate pure business rules (`domain`), use cases and ports (`application`), and adapters (`infrastructure`). Enforce the dependency direction with ESLint. Keep the Next.js layer thin.
- **Consequences:**
  - Good: rules are unit-testable without a database; providers can be swapped; AI-generated code has clear places to live and clear rules to follow.
  - Cost: a little more structure up front. We accept it only where it protects money, identity or privacy, and avoid extra abstraction elsewhere (YAGNI).
