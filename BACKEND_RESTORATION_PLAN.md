# VTT Backend Restoration Plan

**Objective**: Restore full backend functionality for complete client-server connectivity  
**Current Status**: Frontend operational, backend has 1093+ TypeScript compilation errors  
**Target**: Production-ready backend with WebSocket, API endpoints, and database integration

## Phase 1: Critical Infrastructure (Priority 1)

### 1.1 Database Schema Alignment
**Issue**: Prisma schema doesn't match code expectations
- Missing tables: `token`, `encounter`, `game_session`, `combat_state`
- Missing enums: `CHARACTER_GENERATION` in JobType
- Schema has only basic models (Map, User, Campaign, Character, Asset)

**Action Plan**:
```sql
-- Add missing enums
ALTER TYPE "JobType" ADD VALUE 'CHARACTER_GENERATION';
ALTER TYPE "JobType" ADD VALUE 'CONTENT_GENERATION';

-- Add missing tables
CREATE TABLE "Token" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  z FLOAT DEFAULT 0,
  rotation FLOAT DEFAULT 0,
  scale FLOAT DEFAULT 1.0,
  visible BOOLEAN DEFAULT true,
  scene_id UUID REFERENCES "Scene"(id),
  character_id UUID REFERENCES "Character"(id),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE "Encounter" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  scene_id UUID REFERENCES "Scene"(id),
  status VARCHAR DEFAULT 'planning',
  current_turn INTEGER DEFAULT 0,
  round_number INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE "GameSession" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES "Campaign"(id),
  active_scene_id UUID REFERENCES "Scene"(id),
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now()
);
```

### 1.2 AI Provider Dependencies
**Issue**: Missing AI provider classes (`OpenAIProvider`, `AnthropicProvider`)
- 40+ compilation errors in AI modules
- Broken imports and undefined classes

**Action Plan**:
1. **Immediate Fix**: Disable AI modules temporarily
2. **Long-term**: Implement provider interfaces
3. **Files to Fix**:
   - `src/ai/assistant-broken.ts` - Comment out AI provider usage
   - `src/ai/character.ts` - Add fallback implementations
   - `src/ai/content-broken.ts` - Already partially fixed

### 1.3 Test Framework Configuration
**Issue**: Jest types not configured, 200+ test compilation errors
- Missing `@types/jest` imports in tsconfig
- Test files trying to compile in production build

**Action Plan**:
```json
// tsconfig.json - exclude test files from build
{
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "src/test/**/*"]
}

// Add jest types to dev dependencies
"@types/jest": "^29.5.0"
```

## Phase 2: Core Backend Services (Priority 2)

### 2.1 WebSocket Server Implementation
**Current State**: Multiple WebSocket managers exist but compilation fails
- `UnifiedWebSocketManager.ts` - Most complete implementation
- `WebSocketManager.ts` - Legacy version
- `vttSocketManager.ts` - VTT-specific features

**Action Plan**:
1. **Fix UnifiedWebSocketManager**: Resolve Prisma model references
2. **Implement Core Events**:
   - Token movement and updates
   - Combat state synchronization
   - Chat message broadcasting
   - Scene changes and map updates
3. **Connection Management**:
   - Client authentication via JWT
   - Session persistence and reconnection
   - Rate limiting and abuse prevention

### 2.2 REST API Endpoints
**Current State**: 32 route files exist but many have compilation errors
- Authentication routes (OAuth integration)
- Campaign management (CRUD operations)
- Character sheet management
- Asset serving and upload
- Combat and encounter management

**Action Plan**:
```typescript
// Priority API endpoints to restore:
POST   /api/auth/login          // OAuth authentication
GET    /api/campaigns           // List user campaigns
POST   /api/campaigns           // Create new campaign
GET    /api/campaigns/:id       // Get campaign details
POST   /api/characters          // Create character
GET    /api/characters/:id      // Get character sheet
PUT    /api/characters/:id      // Update character
POST   /api/sessions            // Start game session
GET    /api/sessions/:id        // Get session state
POST   /api/tokens              // Create/move tokens
PUT    /api/tokens/:id          // Update token state
```

### 2.3 Database Connection & ORM
**Current State**: Prisma configured but schema mismatches cause failures
- PostgreSQL connection configured
- Migration files exist but incomplete
- Generated client doesn't match code usage

**Action Plan**:
1. **Update Schema**: Add missing models and relationships
2. **Generate Client**: `npx prisma generate` after schema fixes
3. **Run Migrations**: `npx prisma migrate dev` for development
4. **Connection Pooling**: Configure for production load

## Phase 3: Integration & Testing (Priority 3)

### 3.1 Client-Server Communication
**Integration Points**:
- WebSocket connection establishment
- Authentication flow (OAuth → JWT → WebSocket auth)
- Real-time token movement
- Character sheet synchronization
- Combat state management

**Testing Plan**:
```javascript
// Integration test scenarios:
1. User login → Campaign selection → Game session join
2. Token drag/drop → WebSocket broadcast → UI update
3. Character sheet edit → API save → Real-time sync
4. Combat initiative → Turn management → State persistence
5. Chat messages → Broadcast → Message history
```

### 3.2 Performance Optimization
**Based on Earlier Audit Results**:
- WebSocket message processing: 429K+ ops/sec (excellent)
- Database queries: Optimize for character/campaign operations
- Memory management: Monitor long-running sessions
- Connection scaling: Support 20+ concurrent game tables

## Implementation Timeline

### Week 1: Foundation
- [ ] Fix database schema and run migrations
- [ ] Disable/stub AI provider dependencies
- [ ] Configure test exclusions in TypeScript build
- [ ] Get basic server compilation working

### Week 2: Core Services
- [ ] Restore WebSocket server functionality
- [ ] Implement priority API endpoints
- [ ] Test basic client-server connectivity
- [ ] Verify authentication flow

### Week 3: VTT Features
- [ ] Token movement and real-time sync
- [ ] Character sheet management
- [ ] Combat state management
- [ ] Chat system integration

### Week 4: Polish & Production
- [ ] Performance testing and optimization
- [ ] Error handling and logging
- [ ] Production deployment configuration
- [ ] Full integration testing

## Risk Mitigation

### High-Risk Areas
1. **Database Migrations**: Backup existing data before schema changes
2. **WebSocket Stability**: Implement reconnection logic and error recovery
3. **Authentication Security**: Validate OAuth integration and JWT handling
4. **Performance Under Load**: Test with multiple concurrent sessions

### Fallback Strategies
1. **Minimal Backend**: If full restoration takes too long, implement minimal API for UI testing
2. **Mock Services**: Create stub implementations for complex AI features
3. **Progressive Restoration**: Restore features incrementally rather than all-at-once

## Success Criteria

### Phase 1 Complete
- ✅ TypeScript compilation succeeds (0 errors)
- ✅ Server starts without crashes
- ✅ Database connections established

### Phase 2 Complete
- ✅ WebSocket server accepts connections
- ✅ Core API endpoints respond correctly
- ✅ Authentication flow functional

### Phase 3 Complete
- ✅ Full client-server integration working
- ✅ Real-time VTT features operational
- ✅ Performance meets desktop gaming requirements

---

**Next Action**: Begin Phase 1 implementation starting with database schema fixes and AI provider stubbing.
