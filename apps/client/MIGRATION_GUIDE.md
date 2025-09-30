# VTT Client Migration Guide

This guide documents the migration from ad-hoc fix scripts to a proper migration system.

## Background

The `fix-*.js` scripts were temporary solutions created during iterative debugging. They have been consolidated into a proper migration system that addresses root causes systematically.

## What Changed

### Old Approach (11 ad-hoc scripts)

- `fix-all-final-errors.js`
- `fix-all-remaining-errors.js`
- `fix-all-ts-comprehensive.js`
- `fix-all-typescript-errors.js`
- `fix-final-remaining-errors.js`
- `fix-final-ts-errors.js`
- `fix-remaining-errors-final.js`
- `fix-remaining-ts-errors.js`
- `fix-syntax-errors.js`
- `fix-syntax-issues.js`
- `fix-typescript-errors.js`

These scripts had overlapping functionality, were difficult to maintain, and didn't address root causes.

### New Approach (5 organized migrations)

Located in `scripts/migrations/`:

1. **01-tsconfig-migration.js** - TypeScript configuration
2. **02-msw-v2-migration.js** - MSW v2 API migration
3. **03-react-query-v5-migration.js** - React Query v5 migration
4. **04-test-fixes-migration.js** - Test infrastructure fixes
5. **05-component-fixes-migration.js** - Component-level fixes

## Root Causes Addressed

### 1. TypeScript Configuration Issues

**Problem:** `rootDir` conflicts with files outside `src/`, missing `resolveJsonModule`

**Solution:** `01-tsconfig-migration.js` properly configures TypeScript to:

- Remove restrictive `rootDir`
- Enable JSON module resolution
- Include necessary paths

### 2. MSW v1 → v2 Breaking Changes

**Problem:** MSW updated API from `rest` to `http`, changed handler signatures

**Solution:** `02-msw-v2-migration.js` systematically updates:

```javascript
// Before (v1)
rest.get('/api/users', (req, res, ctx) => {
  return res(ctx.json({ users: [] }));
});

// After (v2)
http.get('/api/users', ({ request }) => {
  return HttpResponse.json({ users: [] });
});
```

### 3. React Query v4 → v5 Breaking Changes

**Problem:** API changes in React Query v5

**Solution:** `03-react-query-v5-migration.js` updates:

- `cacheTime` → `gcTime`
- `"loading"` status → `"pending"`
- Removes deprecated `logger` configuration
- Fixes `exactOptionalPropertyTypes` issues

### 4. Test Infrastructure Issues

**Problem:** Missing required props, incorrect imports, uninitialized refs

**Solution:** `04-test-fixes-migration.js` adds:

- Mock props for components
- Proper test imports
- `useRef` null initialization
- Hook mocks where needed

### 5. Component Implementation Issues

**Problem:** Missing imports, incorrect context usage, optional chaining

**Solution:** `05-component-fixes-migration.js` fixes:

- React imports for JSX
- Optional chaining for nullable values
- Property naming (removes underscores)
- Creates missing hooks

## How to Use

### Step 1: Backup Your Work

```bash
git add -A
git commit -m "Pre-migration checkpoint"
```

### Step 2: Run Migrations

```bash
# Run all migrations
npm run migrate

# Or run individually
node scripts/migrations/01-tsconfig-migration.js
node scripts/migrations/02-msw-v2-migration.js
# etc.
```

### Step 3: Verify Changes

```bash
# Review changes
git diff

# Type check
npm run type-check

# Run tests
npm test

# Build
npm run build
```

### Step 4: Cleanup Old Scripts

Once migrations are successful and tests pass:

```bash
# Archive old fix scripts
node scripts/migrations/cleanup-old-fix-scripts.js

# After verification, delete archives
rm -rf scripts/migrations/archived-fix-scripts
```

## Safety Features

### Backups

Each migration creates backups before making changes:

- Location: `scripts/migrations/backups/`
- Format: `filename.timestamp.backup`
- Auto-created on first migration run

### Idempotency

All migrations are idempotent - safe to run multiple times. They:

- Check if changes already applied
- Skip unnecessary modifications
- Log what was changed

### Rollback

If issues occur:

1. Use Git: `git checkout -- .`
2. Or restore from backups in `scripts/migrations/backups/`

## Dependencies Required

The migrations use standard Node.js modules. If using the glob pattern matching in `02-msw-v2-migration.js`, you may need:

```bash
npm install --save-dev glob
```

## Common Issues

### Migration fails with "file not found"

**Cause:** File structure differs from expected

**Solution:** Check file paths in migration scripts, adjust as needed

### TypeScript still shows errors after migration

**Cause:** May need to restart TypeScript server or rebuild

**Solution:**

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
npm install

# Restart IDE TypeScript server
```

### Tests fail after migration

**Cause:** May need to update snapshots or add additional mocks

**Solution:**

```bash
# Update snapshots
npm test -- -u

# Review failed tests manually
```

## Benefits of New System

1. **Organized:** Clear separation of concerns by migration type
2. **Maintainable:** Each migration has single responsibility
3. **Documented:** Comments explain root causes and solutions
4. **Safe:** Automatic backups and idempotent operations
5. **Traceable:** Clear logging of all changes made
6. **Professional:** Follows industry best practices for migrations

## Contributing

If you need to add new migrations:

1. Create `scripts/migrations/NN-description-migration.js`
2. Follow existing migration structure
3. Include backup functionality
4. Make it idempotent
5. Add clear logging
6. Update `run-all-migrations.js` array
7. Document in this guide

## Related Documentation

- [MSW v2 Migration Guide](https://mswjs.io/docs/migrations/1.x-to-2.x/)
- [React Query v5 Migration Guide](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5)
- [TypeScript Configuration Reference](https://www.typescriptlang.org/tsconfig)

## Questions?

If you encounter issues:

1. Check the migration logs for specific errors
2. Review the backup files to see what changed
3. Check related documentation links above
4. Restore from Git if needed and report the issue
