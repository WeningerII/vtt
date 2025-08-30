# ADR 0001: Architecture Principles for AI-Driven VTT

- Status: accepted
- Date: 2025-08-22

## Context

We are designing an AI-driven virtual tabletop (VTT) with prompt-based 2D map creation, depth mapping for 3D context, procedural content population, intelligent NPC behavior, and real-time collaborative editing. The system must remain model-agnostic, API-first, observable, secure, and cost-aware, while enabling iterative delivery without technical debt.

## Decision

Adopt the following guiding principles:

1. Model-agnostic, API-first AI integration
2. Clear domain boundaries and typed contracts (Zod schemas)
3. Observability-first (metrics, traces, logs) with SLOs and dashboards
4. Test-first with provider simulators/mocks and golden datasets
5. Idempotent, durable orchestration (queues, retries, audit logs)
6. Cost controls and quality gates (budgets, rate limiting, objective checks)
7. Security and compliance by default (key mgmt, data retention, content filters)
8. Real-time collaboration via CRDTs (Yjs) and versioning
9. Incremental rollout with feature flags, migrations, and rollback
10. Modular monorepo with package/service separation and code reuse

## Options Considered

- Single-provider direct integration (tight coupling)
- Mixed in-process model hosting (ops heavy)
- API-first provider-agnostic adapter (chosen)

## Consequences

- Positive:
  - Flexibility to switch or combine providers without invasive changes
  - Strong reliability and debuggability via observability and idempotency
  - Lower long-term cost of ownership through typed boundaries and testing
- Negative / Risks:
  - Higher upfront design/infra work (adapters, mocks, logging)
  - Slight latency overhead from routing and audit layers

## Alternatives Considered

- Integrate Stable Diffusion + ControlNet directly: rejects model-agnostic principle and complicates ops.
- Build a tightly coupled editor-service monolith: hampers scaling and deployment independence.

## Security, Privacy, and Compliance

- No secrets in code; use env/secret manager.
- Data classification and retention for assets and logs.
- Provider ToS compliance and content moderation filters.

## Observability and Operations

- Emit request, job, and provider-call metrics; W3C trace context propagation.
- Runbooks for failed jobs, provider outages, and rollback.

## Testing Strategy

- Unit tests for adapters and routing; contract tests per provider; e2e workflows with mocks.
- Golden datasets for segmentation/IoU and path connectivity checks.

## Rollout and Migration

- Feature flags for provider enablement and routing changes.
- Prisma migrations with schema versioning and rollback.

## References

- Map generation research, VTT landscape analysis, and prior notes on pathfinding and CRDTs.
