# ADR 0002: Provider-Agnostic AI Adapter Architecture

- Status: accepted
- Date: 2025-08-22

## Context

We need to support prompt-based 2D map generation, depth estimation, and semantic segmentation while remaining model- and provider-agnostic. Existing integrations include Gemini and GPT via APIs. We want to avoid tight coupling to any single model (e.g., Stable Diffusion + ControlNet) and enable routing, fallback, cost controls, and observability across providers (OpenAI, Google, Stability, Replicate, etc.).

## Decision

Introduce a provider-agnostic AI adapter with:

- Unified interfaces for `textToImage`, `depth`, and `segmentation`
- A provider registry and routing policy (weighted, cost, latency, capability-based)
- Context propagation (traceId, budget, timeouts, abort)
- Structured results (costUSD, latencyMs, model, provider)
- Audit hooks (request/response metadata) for logging and quality gates
- A dummy provider for local development and tests

## Options Considered

- Direct model integration (tight coupling, inflexible)
- Hosted-only single provider integration (vendor lock-in)
- Provider-agnostic adapter with routing (chosen)

## Consequences

- Positive:
  - Swap/compose providers at runtime; safer experimentation
  - Centralized cost/latency and quality tracking, easier SLOs and alerts
  - Testability via mocks/dummy provider
- Negative / Risks:
  - Slightly higher complexity and indirection
  - Requires well-defined schemas for requests/results and audit events

## Interfaces (summary)

- `AIProvider` with optional `textToImage`, `depth`, `segmentation` methods
- `AIRegistry` to register and discover providers and capabilities
- `AIRouter` to apply routing policies and execute calls
- Request/Result types for each task; `AIContext` with budget/trace

## Observability & Cost Controls

- Emit metrics per job and provider call (latency, costUSD, success)
- Structured audit logs with request/response metadata and error context
- Budgets and timeouts enforced in `AIRouter`

## Testing Strategy

- Unit tests for router and provider mocks
- Contract tests per provider adapter
- Golden datasets for segmentation IoU and path connectivity follow-ups

## Rollout

- Feature flag per provider; canary routes based on policy weights
- Incremental adoption in generation and analysis services

## References

- VTT research notes on map generation, CRDT collaboration, and pathfinding
