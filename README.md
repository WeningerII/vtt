# VTT Platform - Virtual Tabletop Gaming Platform

🎲 **A modern, scalable, production-ready virtual tabletop platform for immersive tabletop RPG experiences.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🚀 Features

### **Core Platform**

- **Real-time Multiplayer** - WebSocket-based synchronization for seamless collaborative gameplay
- **Campaign Management** - Create, organize, and manage multiple RPG campaigns
- **User Management** - Complete authentication, authorization, and user profiles
- **Asset Management** - Upload, organize, and share game assets (maps, tokens, audio)
- **Game Systems** - D&D 5e, Pathfinder 2e, Call of Cthulhu, Cyberpunk Red, and more

{{ ... }}
└─────────────────────────────────────────────────────────────────┘

## 🛠️ Technology Stack

### **Frontend**

- **Framework**: Next.js 14 with TypeScript
- **UI Library**: React 18 with custom design system
- **Styling**: Tailwind CSS with class-variance-authority
- **State Management**: React Context + Custom hooks

{{ ... }}

- **Logging**: Structured JSON logs with centralized aggregation
- **Security**: WAF, VPC isolation, encrypted storage

## 🚦 Getting Started

### **Prerequisites**

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16 (for production)

{{ ... }}

### **Development Setup**

1. **Clone the repository**

````bash
git clone <https://github.com/weningerii/vtt.git>
cd vtt

```text
1. **Install dependencies**

```bash
pnpm install

```text
1. **Setup environment**

```bash
cp .env.example .env.dev

# Edit .env.dev with your configuration

```text
1. **Start development services**

```bash

# Start database and cache services

docker-compose up -d postgres redis minio

# Run database migrations

pnpm run db:migrate

# Start development servers

pnpm run dev

```text
1. **Access the application**
- **Client**: <http://localhost:3000>
- **API**: <http://localhost:8080>
- **MinIO Console**: <http://localhost:9090>

### **Available Scripts**

```bash

# Development

pnpm run dev              # Start all development servers
pnpm run dev:client       # Start client only
pnpm run dev:server       # Start server only

# Building

pnpm run build            # Build all applications
pnpm run build:client     # Build client application
pnpm run build:server     # Build server application

# Testing

pnpm run test             # Run all tests
pnpm run test:unit        # Run unit tests
pnpm run test:e2e         # Run end-to-end tests
pnpm run test:coverage    # Generate coverage report

# Security

pnpm run audit            # Run security audit on dependencies
pnpm run audit:security   # Run comprehensive security scan
pnpm run audit:full       # Run all security audits

# Database

pnpm run db:migrate       # Run database migrations
pnpm run db:seed          # Seed development data
pnpm run db:studio        # Open Prisma Studio

# Linting & Formatting

pnpm run lint             # Lint all code
pnpm run format           # Format all code
pnpm run type-check       # Run TypeScript checks

```text
## 📦 Project Structure

```text
vtt/
├── apps/                      # Application services
│   ├── client/               # Next.js frontend application
│   ├── server/               # Express.js API server
│   ├── bots/                 # Discord bot services
│   └── editor/               # Campaign editor interface
├── packages/                  # Shared packages
│   ├── user-management/      # Authentication & user system
│   ├── content/              # Content management system
│   ├── core-ecs/             # Entity-Component-System engine
│   ├── ai/                   # AI integration services
│   ├── analytics/            # Analytics and metrics
│   └── renderer/             # WebGL rendering engine
├── infra/                    # Infrastructure as code
│   ├── terraform/            # AWS infrastructure
│   ├── k8s/                  # Kubernetes manifests
│   └── docker/               # Docker configurations
├── docs/                     # Documentation
│   ├── api/                  # API documentation
│   └── adr/                  # Architecture decision records
└── e2e/                      # End-to-end tests

```text
## 🔐 Security & Compliance

- **Authentication**: JWT-based with refresh token rotation
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: End-to-end encryption for sensitive data
- **Privacy**: GDPR compliant with data export/deletion
- **Security Headers**: Comprehensive CSP, HSTS, and security headers
- **Vulnerability Scanning**: Automated dependency and container scanning
- **Penetration Testing**: Regular security assessments

## 🚀 Deployment

### **Production Deployment**

1. **Infrastructure Setup**

```bash
cd infra/terraform
terraform init
terraform workspace new production
terraform plan -var-file="production.tfvars"
terraform apply

```text
1. **Application Deployment**

```bash

# Automated via GitHub Actions on push to main

git push origin main

# Manual deployment

kubectl apply -f infra/k8s/production/

```text
1. **Domain Configuration**
- Configure DNS to point to load balancer
- SSL certificates managed automatically via cert-manager

### **Environment Variables**

Critical environment variables for production:

```bash

# Database

DB_HOST=your-postgres-host
DB_PASSWORD=your-secure-password

# Authentication

JWT_ACCESS_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# External Services

STRIPE_SECRET_KEY=your-stripe-key
REDIS_AUTH_TOKEN=your-redis-token

### AI Providers

See `docs/ai-providers.md` for full details on configuration, failover, and testing.

Key environment flags:

- `AI_ENABLE_AUTO_PROVIDERS` — when set to `'false'`, real providers are not auto-registered even if API keys are present. Defaults to `'true'` in `.env.example`.
- `AI_ENABLE_LOCAL_PROVIDER` — when `'true'`, registers the LocalAI provider (if available). Defaults to `'false'`.

In CI and E2E tests, these are set to disable auto-registration for deterministic runs.

## 📊 Monitoring & Observability

- **Metrics**: Prometheus with custom application metrics
- **Dashboards**: Grafana with pre-built VTT platform dashboards
- **Alerting**: AlertManager with PagerDuty/Slack integration
- **Logging**: Structured JSON logs with ELK/EFK stack
- **Tracing**: Distributed tracing with Jaeger
- **Uptime**: External monitoring with status page

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Workflow**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run the test suite (`pnpm run test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### **Code Standards**

- **TypeScript**: Strict mode enabled
- **ESLint**: Extended configuration with custom rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality gates
- **Conventional Commits**: Standardized commit messages

## 📋 API Documentation

Comprehensive API documentation is available at:

- **Development**: <http://localhost:8080/docs>
- **Production**: <https://api.vtt.platform.com/docs>

Key API endpoints:

- `POST /api/v1/auth/login` - User authentication
- `GET /api/v1/campaigns` - List user campaigns
- `POST /api/v1/campaigns` - Create new campaign
- `WS /ws` - Real-time WebSocket connection

## 🗺️ Roadmap

### **Q1 2025**

- [ ] Advanced dice system with 3D physics
- [ ] Voice/video chat integration
- [ ] Mobile companion app
- [ ] Marketplace for community content

### **Q2 2025**

- [ ] AR/VR support for immersive gameplay
- [ ] Advanced AI game master assistance
- [ ] Multi-language localization
- [ ] Enhanced accessibility features

### **Q3 2025**

- [ ] Tournament and event system
- [ ] Advanced analytics dashboard
- [ ] Community forums integration
- [ ] Plugin/extension system

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Contributors**: Thank you to all our amazing contributors
- **Community**: The tabletop gaming community for inspiration
- **Open Source**: Built on the shoulders of giants in the OSS community
- **Game Systems**: Thanks to publishers for making their systems available

---

**Built with ❤️ for the tabletop gaming community**

For support, feature requests, or questions, please [open an issue](https://github.com/weningerii/vtt/issues) or join our [Discord community](https://discord.gg/vtt-platform).
````
