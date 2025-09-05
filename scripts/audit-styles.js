#!/usr/bin/env node

/**
 * VTT Component Style Audit Script
 * Analyzes all React components for styling approaches and design system readiness
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Patterns to detect different styling approaches
const stylePatterns = {
  hardcodedColors: /#[0-9a-fA-F]{3,6}|rgb\(|rgba\(/g,
  tailwindClasses: /\b(bg|text|border|shadow|rounded|flex|grid|p|m|w|h)-[a-z0-9-]+/g,
  designSystemVars: /var\(--[a-z-]+\)/g,
  inlineStyles: /style={{|style={[^}]/g,
  cssModules: /styles\./g,
  styledComponents: /styled\./g,
  emotionCss: /css`|@emotion/g,
  classNames: /className=/g
};

// Component categories
const componentCategories = {
  ui: /\/ui\//,
  vtt: /\/vtt\//,
  game: /\/game\//,
  auth: /\/auth\//,
  dashboard: /\/dashboard\//,
  campaigns: /\/campaigns\//,
  map: /\/map\//,
  ai: /\/ai\//
};

class StyleAuditor {
  constructor() {
    this.results = [];
    this.summary = {
      totalComponents: 0,
      byCategory: {},
      byStyleApproach: {
        hardcodedColors: 0,
        tailwindClasses: 0,
        designSystemVars: 0,
        inlineStyles: 0,
        cssModules: 0,
        styledComponents: 0,
        emotionCss: 0
      },
      migrationEffort: {
        low: [],
        medium: [],
        high: []
      }
    };
  }

  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Skip test files
    if (fileName.includes('.test.') || fileName.includes('.spec.')) {
      return null;
    }

    const analysis = {
      file: relativePath,
      fileName: fileName,
      category: this.getCategory(relativePath),
      lines: content.split('\n').length,
      styleApproaches: {},
      hardcodedColors: [],
      tailwindClasses: [],
      designSystemUsage: [],
      migrationEffort: 'low',
      issues: [],
      recommendations: []
    };

    // Analyze each styling approach
    for (const [approach, pattern] of Object.entries(stylePatterns)) {
      const matches = content.match(pattern) || [];
      analysis.styleApproaches[approach] = matches.length;
      
      if (approach === 'hardcodedColors' && matches.length > 0) {
        analysis.hardcodedColors = [...new Set(matches)].slice(0, 10);
        analysis.issues.push(`Found ${matches.length} hardcoded colors`);
      }
      
      if (approach === 'tailwindClasses' && matches.length > 0) {
        const uniqueClasses = [...new Set(matches)];
        analysis.tailwindClasses = uniqueClasses.slice(0, 10);
        analysis.issues.push(`Found ${uniqueClasses.length} Tailwind classes`);
      }
      
      if (approach === 'designSystemVars' && matches.length > 0) {
        analysis.designSystemUsage = [...new Set(matches)].slice(0, 10);
      }
    }

    // Calculate migration effort
    const hardcodedCount = analysis.styleApproaches.hardcodedColors;
    const tailwindCount = analysis.styleApproaches.tailwindClasses;
    const inlineCount = analysis.styleApproaches.inlineStyles;
    
    if (hardcodedCount > 20 || tailwindCount > 50 || inlineCount > 10) {
      analysis.migrationEffort = 'high';
      analysis.recommendations.push('Complete refactor recommended');
    } else if (hardcodedCount > 10 || tailwindCount > 20 || inlineCount > 5) {
      analysis.migrationEffort = 'medium';
      analysis.recommendations.push('Moderate refactoring needed');
    } else {
      analysis.migrationEffort = 'low';
      analysis.recommendations.push('Minor adjustments needed');
    }

    // Add specific recommendations
    if (hardcodedCount > 0) {
      analysis.recommendations.push('Replace hardcoded colors with design system variables');
    }
    if (tailwindCount > 0) {
      analysis.recommendations.push('Migrate Tailwind classes to design system utilities');
    }
    if (inlineCount > 0) {
      analysis.recommendations.push('Extract inline styles to CSS classes');
    }
    if (analysis.styleApproaches.designSystemVars === 0) {
      analysis.recommendations.push('Start using design system variables');
    }

    return analysis;
  }

  getCategory(filePath) {
    for (const [category, pattern] of Object.entries(componentCategories)) {
      if (pattern.test(filePath)) {
        return category;
      }
    }
    return 'other';
  }

  async audit() {
    console.log(`${colors.cyan}${colors.bright}🔍 VTT Component Style Audit${colors.reset}\n`);
    
    // Find all React component files
    const componentFiles = globSync('apps/client/src/**/*.{tsx,jsx}', {
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
    });

    console.log(`Found ${componentFiles.length} component files to analyze...\n`);

    // Analyze each file
    for (const file of componentFiles) {
      const analysis = this.analyzeFile(file);
      if (analysis) {
        this.results.push(analysis);
        this.summary.totalComponents++;
        
        // Update category count
        this.summary.byCategory[analysis.category] = 
          (this.summary.byCategory[analysis.category] || 0) + 1;
        
        // Update style approach counts
        for (const [approach, count] of Object.entries(analysis.styleApproaches)) {
          if (count > 0) {
            this.summary.byStyleApproach[approach]++;
          }
        }
        
        // Categorize by migration effort
        this.summary.migrationEffort[analysis.migrationEffort].push(analysis.fileName);
      }
    }

    this.generateReport();
  }

  generateReport() {
    // Console output
    console.log(`${colors.bright}📊 Audit Summary${colors.reset}\n`);
    console.log(`Total Components: ${this.summary.totalComponents}`);
    
    console.log(`\n${colors.bright}By Category:${colors.reset}`);
    for (const [category, count] of Object.entries(this.summary.byCategory)) {
      console.log(`  ${category}: ${count} components`);
    }
    
    console.log(`\n${colors.bright}Styling Approaches Used:${colors.reset}`);
    for (const [approach, count] of Object.entries(this.summary.byStyleApproach)) {
      const percentage = ((count / this.summary.totalComponents) * 100).toFixed(1);
      const color = approach === 'designSystemVars' ? colors.green : 
                    approach === 'hardcodedColors' ? colors.red : 
                    colors.yellow;
      console.log(`  ${color}${approach}: ${count} components (${percentage}%)${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}Migration Effort Distribution:${colors.reset}`);
    console.log(`  ${colors.green}Low: ${this.summary.migrationEffort.low.length} components${colors.reset}`);
    console.log(`  ${colors.yellow}Medium: ${this.summary.migrationEffort.medium.length} components${colors.reset}`);
    console.log(`  ${colors.red}High: ${this.summary.migrationEffort.high.length} components${colors.reset}`);
    
    // High priority components
    console.log(`\n${colors.bright}${colors.red}⚠️  High Priority Components (need major refactoring):${colors.reset}`);
    const highPriority = this.results
      .filter(r => r.migrationEffort === 'high')
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10);
    
    for (const component of highPriority) {
      console.log(`  • ${component.fileName}`);
      console.log(`    Issues: ${component.issues.join(', ')}`);
      console.log(`    Lines: ${component.lines}`);
    }
    
    // Generate detailed CSV report
    this.generateCSV();
    
    // Generate migration plan
    this.generateMigrationPlan();
  }

  generateCSV() {
    const csvPath = path.join(process.cwd(), 'style-audit-report.csv');
    const headers = [
      'File',
      'Category',
      'Lines',
      'Migration Effort',
      'Hardcoded Colors',
      'Tailwind Classes',
      'Design System Vars',
      'Inline Styles',
      'CSS Modules',
      'Issues',
      'Recommendations'
    ];
    
    let csv = headers.join(',') + '\n';
    
    for (const result of this.results) {
      const row = [
        result.fileName,
        result.category,
        result.lines,
        result.migrationEffort,
        result.styleApproaches.hardcodedColors || 0,
        result.styleApproaches.tailwindClasses || 0,
        result.styleApproaches.designSystemVars || 0,
        result.styleApproaches.inlineStyles || 0,
        result.styleApproaches.cssModules || 0,
        `"${result.issues.join('; ')}"`,
        `"${result.recommendations.join('; ')}"`
      ];
      csv += row.join(',') + '\n';
    }
    
    fs.writeFileSync(csvPath, csv);
    console.log(`\n${colors.green}✅ Detailed report saved to: ${csvPath}${colors.reset}`);
  }

  generateMigrationPlan() {
    const planPath = path.join(process.cwd(), 'style-migration-plan.md');
    let markdown = '# VTT Style Migration Plan\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += '## Summary\n\n';
    markdown += `- **Total Components:** ${this.summary.totalComponents}\n`;
    markdown += `- **Components Using Design System:** ${this.summary.byStyleApproach.designSystemVars} (${((this.summary.byStyleApproach.designSystemVars / this.summary.totalComponents) * 100).toFixed(1)}%)\n`;
    markdown += `- **Components Needing Migration:** ${this.summary.totalComponents - this.summary.byStyleApproach.designSystemVars}\n\n`;
    
    markdown += '## Migration Phases\n\n';
    
    // Phase 1: High Priority
    markdown += '### Phase 1: High Priority Components (Week 1)\n\n';
    markdown += 'These components have the most technical debt and should be migrated first:\n\n';
    const highPriorityComponents = this.results.filter(r => r.migrationEffort === 'high');
    for (const comp of highPriorityComponents.slice(0, 10)) {
      markdown += `- [ ] **${comp.fileName}** (${comp.lines} lines)\n`;
      markdown += `  - ${comp.issues.join('\n  - ')}\n`;
      markdown += `  - ${comp.recommendations.join('\n  - ')}\n\n`;
    }
    
    // Phase 2: Medium Priority
    markdown += '### Phase 2: Medium Priority Components (Week 2)\n\n';
    const mediumPriorityComponents = this.results.filter(r => r.migrationEffort === 'medium');
    for (const comp of mediumPriorityComponents.slice(0, 10)) {
      markdown += `- [ ] **${comp.fileName}**\n`;
    }
    
    // Phase 3: Low Priority
    markdown += '\n### Phase 3: Low Priority Components (Week 3)\n\n';
    markdown += `${this.summary.migrationEffort.low.length} components with minor adjustments needed.\n\n`;
    
    // Migration Guidelines
    markdown += '## Migration Guidelines\n\n';
    markdown += '### Color Migration\n\n';
    markdown += '```css\n';
    markdown += '/* Before */\n';
    markdown += 'color: #007bff;\n';
    markdown += 'background: #6f42c1;\n\n';
    markdown += '/* After */\n';
    markdown += 'color: var(--color-accent-primary);\n';
    markdown += 'background: var(--gradient-plasma);\n';
    markdown += '```\n\n';
    
    markdown += '### Utility Class Migration\n\n';
    markdown += '```tsx\n';
    markdown += '// Before\n';
    markdown += 'className="bg-gray-900 text-white p-4 rounded-lg"\n\n';
    markdown += '// After\n';
    markdown += 'className="surface-primary text-primary spacing-4 radius-lg"\n';
    markdown += '```\n\n';
    
    fs.writeFileSync(planPath, markdown);
    console.log(`${colors.green}✅ Migration plan saved to: ${planPath}${colors.reset}`);
  }
}

// Run the audit
const auditor = new StyleAuditor();
auditor.audit().catch(console.error);
