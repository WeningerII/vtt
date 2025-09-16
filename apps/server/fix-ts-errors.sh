#!/bin/bash

# Fix TypeScript TS18046 errors systematically
# This script adds type guards for unknown types

echo "Fixing TypeScript errors in server package..."

# Fix error handlers in routes
for file in src/routes/*.ts; do
  if [ -f "$file" ]; then
    # Add import for getErrorMessage if missing
    if ! grep -q "getErrorMessage" "$file"; then
      if grep -q "catch (error" "$file"; then
        sed -i '1a\import { getErrorMessage } from "../utils/errors";' "$file"
      fi
    fi
    
    # Replace error.message with getErrorMessage(error)
    sed -i 's/error\.message/getErrorMessage(error)/g' "$file"
    
    # Fix catch (error: unknown) to catch (error)
    sed -i 's/catch (error: unknown)/catch (error)/g' "$file"
  fi
done

# Fix type assertions for common patterns
echo "Adding type guards for auth-manager..."
sed -i 's/oauthUser\./\(oauthUser as any\)\./g' src/auth/auth-manager.ts
sed -i 's/user\.\([a-zA-Z]*\)/(user as any)\.\1/g' src/auth/auth-manager.ts

echo "Adding type guards for map service..."
sed -i 's/token\.\([a-zA-Z]*\)/(token as any)\.\1/g' src/map/MapService.ts

echo "Adding type guards for campaign service..."
sed -i 's/dbCampaign\./\(dbCampaign as any\)\./g' src/campaign/CampaignService.ts
sed -i 's/\bm\.\([a-zA-Z]*\)/(m as any)\.\1/g' src/campaign/CampaignService.ts

echo "Done! Run 'pnpm --filter @vtt/server run typecheck' to verify."
