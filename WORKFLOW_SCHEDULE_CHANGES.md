# Workflow Schedule Optimization

## Problem

Multiple workflows were running too frequently, overwhelming GitHub Actions with excessive runs and causing system-wide failures.

## Changes Made

| Workflow                 | Before                     | After                                   | Reduction         |
| ------------------------ | -------------------------- | --------------------------------------- | ----------------- |
| **CI Monitoring**        | Every 15 minutes (96x/day) | Twice daily at 8 AM & 8 PM UTC (2x/day) | **98% reduction** |
| **Resource Optimizer**   | Every 4 hours (6x/day)     | Daily at 3 AM UTC (1x/day)              | **83% reduction** |
| **Infrastructure Drift** | Twice daily (2x/day)       | Weekly on Mondays (1x/week)             | **86% reduction** |

## Rationale

### CI Monitoring (15min → twice daily)

- **15 minutes was insane** - appropriate for critical production systems only
- **Twice daily** provides adequate monitoring for development repositories
- Still captures workflow completion events in real-time via `workflow_run` trigger

### Resource Optimizer (4hr → daily)

- **Every 4 hours** was overkill for resource optimization
- **Daily optimization** is sufficient for build caching and cleanup
- Reduces GitHub Actions minute consumption by 83%

### Infrastructure Drift (2x daily → weekly)

- **Twice daily** assumes production infrastructure exists
- **Weekly checks** are appropriate for development/staging environments
- Prevents failures when infrastructure isn't deployed

## Impact

- **Eliminates workflow spam** that was causing cascading failures
- **Reduces GitHub Actions costs** by ~90%
- **Maintains monitoring capabilities** with reasonable frequency
- **Prevents API rate limiting** from excessive GitHub API calls

## Next Steps

1. Monitor Actions tab for stability over next 24 hours
2. Re-enable more aggressive schedules only when infrastructure is production-ready
3. Add workflow dispatch triggers for manual execution when needed
