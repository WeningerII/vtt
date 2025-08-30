# AI Providers: Configuration, Failover, and Testing

This document explains how AI providers are registered and controlled via environment flags, how failover works, and how to configure tests/CI for deterministic behavior.

## Environment Flags

- AI_ENABLE_AUTO_PROVIDERS
  - Default: true (see .env.example)
  - When 'false', the core registry will NOT auto-register real providers (OpenAI, OpenRouter, Anthropic, Gemini, Replicate, HuggingFace), even if API keys are present.

- AI_ENABLE_LOCAL_PROVIDER
  - Default: false
  - When 'true', the LocalAIProvider is registered (if LocalAI runtime is configured). Useful for local/offline dev.

These flags are consumed in `packages/core/src/AIProviderRegistry.ts` by `initializeDefaultProviders()`.

## Recommended setups

- Development
  - Keep AI_ENABLE_AUTO_PROVIDERS=true only if you want real providers to be auto-registered when API keys are present.
  - Otherwise set AI_ENABLE_AUTO_PROVIDERS=false to avoid accidental external calls.

- Testing (Playwright/Jest)
  - `.env.test` sets `AI_ENABLE_AUTO_PROVIDERS=false` so real providers are not auto-registered.
  - `playwright.config.ts` also exports webServer env with these flags set to ensure consistency during E2E runs.

- CI
  - `.github/workflows/ci.yml` sets `AI_ENABLE_AUTO_PROVIDERS=false` and `AI_ENABLE_LOCAL_PROVIDER=false` for unit/integration and E2E jobs to ensure deterministic tests.

## Failover and retries

The registry executes requests with retry and provider failover:
- Providers are tried in priority order.
- Each provider is retried up to `maxRetries` with `timeout` enforcement.
- If all candidates fail, an error is thrown. See `executeWithFailover()` and `withTimeout()` in `AIProviderRegistry.ts`.

## Usage stats

On provider registration, usage stats are reset to avoid stale data affecting tests. Stats track total/success/failed requests, tokens, cost estimate, etc.

## Enabling real providers locally

If you want to use real providers in dev:
- Set AI_ENABLE_AUTO_PROVIDERS=true
- Provide relevant API keys (e.g., OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)

## Enabling LocalAI

- Set AI_ENABLE_LOCAL_PROVIDER=true
- Ensure your LocalAI runtime is reachable and configured per your environment.

