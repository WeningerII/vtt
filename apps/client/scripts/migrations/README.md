# Migration Scripts

This directory contains organized migration scripts to update the VTT client codebase.

## Purpose

These scripts address systematic issues arising from:

- MSW v1 → v2 migration
- React Query v4 → v5 migration
- TypeScript strict mode compliance
- Test infrastructure updates

## Migration Order

Run migrations in this order:

1. **01-tsconfig-migration.js** - Updates TypeScript configuration
2. **02-msw-v2-migration.js** - Migrates MSW handlers to v2 API
3. **03-react-query-v5-migration.js** - Updates React Query to v5 API
4. **04-test-fixes-migration.js** - Fixes test files and utilities
5. **05-component-fixes-migration.js** - Addresses component-specific issues

## Running Migrations

```bash
# Run all migrations
npm run migrate

# Run specific migration
node scripts/migrations/01-tsconfig-migration.js
```

## Rollback

Each migration creates a backup in `scripts/migrations/backups/` before making changes.

## Notes

- Migrations are idempotent - safe to run multiple times
- Each migration logs changes to console
- Review changes with `git diff` before committing
