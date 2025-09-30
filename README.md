# VTT Platform

A virtual tabletop platform for tabletop RPG experiences.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker & Docker Compose
- PostgreSQL 16

## Quick Start

1. **Install dependencies**

```bash
pnpm install
```

2. **Setup environment**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start services**

```bash
# Start database and dependencies
docker-compose up -d

# Run database migrations
pnpm run db:migrate

# Start development
pnpm run dev
```

4. **Access**

- Client: <http://localhost:3000>
- API: <http://localhost:8080>

## Available Scripts

```bash
# Development
pnpm run dev              # Start all services
pnpm run dev:client       # Start client only
pnpm run dev:server       # Start server only
pnpm run dev:bot          # Start bot service

# Build & Test
pnpm run build            # Build all
pnpm run test             # Run tests
pnpm run lint             # Lint code
pnpm run typecheck        # Type check
pnpm run format           # Format code

# Database
pnpm run db:gen           # Generate Prisma client
pnpm run db:migrate       # Run migrations
pnpm run db:studio        # Open Prisma Studio

# Docker
pnpm run stack:up         # Start Docker services
pnpm run stack:down       # Stop Docker services
```

## Project Structure

```
vtt/
├── apps/                 # Applications
│   ├── client/          # Frontend
│   ├── server/          # Backend API
│   ├── bots/            # Bot services
│   └── editor/          # Editor interface
└── packages/            # Shared packages
    ├── core/            # Core functionality
    ├── renderer/        # WebGL renderer
    ├── auth/            # Authentication
    └── ...              # Other packages
```

## License

MIT
