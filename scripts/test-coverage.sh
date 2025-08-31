#!/bin/bash

# Unified test coverage script for VTT project
# Runs tests across all packages and apps, then merges coverage reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Running unified test coverage for VTT project${NC}"

# Clean previous coverage data
echo -e "${YELLOW}🧹 Cleaning previous coverage data...${NC}"
rm -rf coverage-merged coverage-final
find . -name "coverage" -type d -not -path "./node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Function to run tests for a specific workspace
run_workspace_tests() {
    local workspace=$1
    local test_command=$2
    
    echo -e "${BLUE}📦 Running tests for ${workspace}...${NC}"
    
    if [ -d "$workspace" ]; then
        cd "$workspace"
        
        # Check if package.json exists and has the test script
        if [ -f "package.json" ] && npm run | grep -q "test:coverage"; then
            echo -e "${GREEN}✅ Running coverage tests in ${workspace}${NC}"
            npm run test:coverage || {
                echo -e "${RED}❌ Tests failed in ${workspace}${NC}"
                cd - > /dev/null
                return 1
            }
        elif [ -f "package.json" ] && npm run | grep -q "test"; then
            echo -e "${YELLOW}⚠️  No coverage script found, running regular tests in ${workspace}${NC}"
            npm run test || {
                echo -e "${RED}❌ Tests failed in ${workspace}${NC}"
                cd - > /dev/null
                return 1
            }
        else
            echo -e "${YELLOW}⚠️  No test script found in ${workspace}, skipping${NC}"
        fi
        
        cd - > /dev/null
    else
        echo -e "${RED}❌ Directory ${workspace} not found${NC}"
        return 1
    fi
}

# Run tests for server (Jest)
echo -e "${BLUE}🖥️  Running server tests...${NC}"
run_workspace_tests "apps/server" "test:coverage"

# Run tests for client (Jest)
echo -e "${BLUE}💻 Running client tests...${NC}"
run_workspace_tests "apps/client" "test:coverage"

# Run tests for packages (Vitest)
echo -e "${BLUE}📚 Running package tests...${NC}"

# Core packages
CORE_PACKAGES=(
    "packages/core"
    "packages/dice-engine" 
    "packages/combat"
    "packages/los-fov"
    "packages/ai"
    "packages/analytics"
    "packages/audio"
    "packages/asset-pipeline"
)

for package in "${CORE_PACKAGES[@]}"; do
    if [ -d "$package" ]; then
        echo -e "${BLUE}📦 Testing ${package}...${NC}"
        run_workspace_tests "$package" "test:coverage"
    else
        echo -e "${YELLOW}⚠️  Package ${package} not found, skipping${NC}"
    fi
done

# Run E2E tests if requested
if [ "$1" = "--e2e" ]; then
    echo -e "${BLUE}🎭 Running E2E tests...${NC}"
    run_workspace_tests "." "test:e2e"
fi

# Merge coverage reports
echo -e "${BLUE}🔄 Merging coverage reports...${NC}"
node coverage.config.js

# Check if coverage merge was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Coverage merge completed successfully${NC}"
    
    # Display coverage summary
    echo -e "${BLUE}📊 Coverage Summary:${NC}"
    if [ -f "coverage-final/coverage-final.json" ]; then
        echo -e "${GREEN}📈 Detailed HTML report available at: coverage-final/html/index.html${NC}"
    fi
else
    echo -e "${RED}❌ Coverage merge failed${NC}"
    exit 1
fi

# Optional: Open coverage report in browser
if [ "$1" = "--open" ] || [ "$2" = "--open" ]; then
    if [ -f "coverage-final/html/index.html" ]; then
        echo -e "${BLUE}🌐 Opening coverage report in browser...${NC}"
        if command -v xdg-open > /dev/null; then
            xdg-open coverage-final/html/index.html
        elif command -v open > /dev/null; then
            open coverage-final/html/index.html
        else
            echo -e "${YELLOW}⚠️  Could not open browser automatically. Open coverage-final/html/index.html manually.${NC}"
        fi
    fi
fi

echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
