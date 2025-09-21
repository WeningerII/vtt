# CI Workflow Consolidation Plan

`ci.yml` and `ci-optimized.yml` share large sections of repeated logic—Node/PNPM setup, dependency installation, Prisma generation, and Trivy scanning. This plan captures a phased approach for reducing duplication while preserving the optimized fan-out used by the performance-focused workflow.

## Phase 1 – Identify Reusable Blocks

- Extract shared setup into composite actions under `.github/actions/`:
  - `setup-node-pnpm` – wraps `actions/setup-node`, `pnpm/action-setup`, and optional system package installation.
  - `install-deps` – runs `pnpm install --frozen-lockfile` with optional `--prefer-offline` flag.
  - `run-trivy` – encapsulates the Trivy invocation and SARIF upload logic.
- Document inputs/outputs for each action so both workflows can opt into caching or matrix-specific behavior.

## Phase 2 – Introduce Reusable Workflow

- Create `.github/workflows/_reusable-ci-build.yml` triggered via `workflow_call` to run lint, typecheck, build, and unit tests with matrix support.
- Allow callers to pass booleans for `run_e2e`, `shard_count`, and `enable_turbo_cache`.
- Migrate `ci-optimized.yml` to call the reusable workflow for standard jobs, keeping the `changes` job and e2e gating logic local.

## Phase 3 – Collapse Redundant Jobs

- Update `ci.yml` to reuse the composite actions and/or reusable workflow.
- Remove duplicated Trivy/security jobs once the shared action is stable.
- Align artifact naming conventions so downstream consumers (dashboards, coverage reporters) continue to function.

## Phase 4 – Cleanup & Metrics

- Delete legacy steps, ensure concurrency groups and permissions remain intact.
- Add a changelog entry summarizing the consolidation and update the developer onboarding docs to reference the new actions.
- Track workflow duration before/after to confirm no regressions; target parity with the current optimized pipeline.

## Status

- **Owner:** DevOps Guild
- **Target Sprint:** Next maintenance iteration once current security fixes ship
- **Prereqs:** Agreement on composite action inputs, validation in staging repository
