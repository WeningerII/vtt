#!/bin/bash

# Deployment Readiness Verification Script
echo "🚀 VTT Deployment Readiness Check"
echo "=================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

READY=true

# Check Node version
echo -n "✓ Node.js version: "
node --version

# Check npm/pnpm
echo -n "✓ Package manager: "
if command -v pnpm &> /dev/null; then
    pnpm --version
else
    npm --version
fi

# Check build
echo -e "\n📦 Build Status:"
if [ -d "apps/client/dist" ] || [ -d "apps/server/dist" ]; then
    echo -e "${GREEN}✓ Build artifacts found${NC}"
else
    echo -e "${YELLOW}⚠ No build artifacts - run 'pnpm build'${NC}"
    READY=false
fi

# Check environment file
echo -e "\n🔐 Environment Configuration:"
if [ -f ".env.production.local" ]; then
    echo -e "${GREEN}✓ Production environment configured${NC}"
else
    echo -e "${YELLOW}⚠ Create .env.production.local from .env.production template${NC}"
    echo "  Required: DATABASE_URL, JWT_SECRET, SERVER_URL, CLIENT_URL"
    READY=false
fi

# Check Docker
echo -e "\n🐳 Docker Status:"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker installed${NC}"
    if [ -f "docker-compose.prod.yml" ]; then
        echo -e "${GREEN}✓ Production compose file exists${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Docker not found (optional for containerized deployment)${NC}"
fi

# Check SSL/Database readiness
echo -e "\n🔒 Production Requirements:"
echo "  [ ] PostgreSQL database configured"
echo "  [ ] Redis cache configured (optional)"
echo "  [ ] SSL certificates obtained"
echo "  [ ] Domain DNS configured"
echo "  [ ] Backup strategy in place"

# Final status
echo -e "\n=================================="
if [ "$READY" = true ]; then
    echo -e "${GREEN}✅ Core deployment requirements met!${NC}"
    echo -e "\nNext steps:"
    echo "  1. Copy .env.production to .env.production.local and configure"
    echo "  2. Run 'pnpm build' to create production build"
    echo "  3. Deploy using Docker: 'docker-compose -f docker-compose.prod.yml up'"
    echo "  4. Or deploy to cloud: Use your preferred provider (Vercel, AWS, etc.)"
else
    echo -e "${YELLOW}⚠ Some requirements missing - see above${NC}"
fi

echo -e "\n🎮 Ready to play? Once deployed:"
echo "  - Navigate to your domain"
echo "  - Create/login to your account"
echo "  - Start or join a campaign!"
