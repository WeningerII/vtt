# Design Token Migration Plan

## Overview

This document outlines the systematic approach to migrate all legacy styling to use the VTT design system tokens consistently across the entire codebase.

## Current State Analysis

### Design System Strengths
- ✅ Comprehensive CSS custom properties defined in `styles/design-system.css`
- ✅ Dark theme optimized for gaming environments
- ✅ Accessible color contrasts (WCAG 2.1 AA)
- ✅ Semantic token naming convention
- ✅ Core UI components already migrated (Input, Modal, Button)

### Migration Status
- ✅ **Completed**: Input, Modal, Button components
- ✅ **Completed**: DiceRoller mobile touch targets
- ✅ **Completed**: MobileNavigation component
- 🔄 **In Progress**: Design token migration plan
- ⏳ **Pending**: Systematic codebase audit

## Migration Strategy

### Phase 1: Discovery and Inventory (Estimated: 2-3 days)

#### 1.1 Legacy Style Detection
Run automated searches to identify legacy styling patterns:

```bash
# Find legacy Tailwind color classes
grep -r "bg-gray-\|text-gray-\|border-gray-" src/ --include="*.tsx" --include="*.ts"

# Find legacy color values
grep -r "#[0-9a-fA-F]\{3,6\}" src/ --include="*.tsx" --include="*.ts" --include="*.css"

# Find hardcoded RGB/HSL values
grep -r "rgb(\|hsl(\|rgba(\|hsla(" src/ --include="*.tsx" --include="*.ts" --include="*.css"

# Find legacy spacing
grep -r "p-[0-9]\|m-[0-9]\|px-[0-9]\|py-[0-9]" src/ --include="*.tsx"
```

#### 1.2 Component Audit Checklist
For each component, verify:
- [ ] Background colors use `var(--bg-*)`
- [ ] Text colors use `var(--text-*)`
- [ ] Border colors use `var(--border-*)`
- [ ] Accent colors use `var(--accent-*)`
- [ ] Spacing uses `var(--space-*)`
- [ ] Border radius uses `var(--radius-*)`
- [ ] Typography uses `var(--text-*)`

### Phase 2: Systematic Migration (Estimated: 1-2 weeks)

#### 2.1 Priority Order
1. **High Priority**: Gaming components (dice, combat, character sheets)
2. **Medium Priority**: Navigation, layout, common UI
3. **Low Priority**: Admin, settings, edge cases

#### 2.2 Migration Patterns

##### Color Migration
```tsx
// Before (Legacy)
className="bg-gray-800 text-white border-gray-600"

// After (Design System)
className="bg-bg-secondary text-text-primary border-border-secondary"
```

##### Spacing Migration
```tsx
// Before (Legacy)
className="p-4 m-2 px-6"

// After (Design System)
style={{
  padding: 'var(--space-4)',
  margin: 'var(--space-2)',
  paddingInline: 'var(--space-6)'
}}
```

##### Border Radius Migration
```tsx
// Before (Legacy)
className="rounded-lg"

// After (Design System)
style={{ borderRadius: 'var(--radius-lg)' }}
```

#### 2.3 CVA Integration
For components using `class-variance-authority`:

```tsx
const componentVariants = cva([
  // Base styles with design tokens
  "bg-bg-secondary text-text-primary border-border-secondary",
  "hover:bg-bg-tertiary focus-visible:ring-accent-primary/25"
], {
  variants: {
    variant: {
      primary: "bg-accent-primary text-text-primary",
      secondary: "bg-bg-tertiary text-text-secondary"
    }
  }
});
```

### Phase 3: Quality Assurance (Estimated: 3-5 days)

#### 3.1 Automated Testing
```bash
# Run existing tests to catch regressions
npm run test

# Run accessibility tests
npm run test:a11y

# Run visual regression tests (if available)
npm run test:visual
```

#### 3.2 Manual Testing Checklist
- [ ] Dark theme consistency across all components
- [ ] Color contrast ratios maintained
- [ ] Mobile responsiveness preserved
- [ ] Gaming-specific components function correctly
- [ ] Focus states and accessibility maintained

#### 3.3 Browser Testing
Test across:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Phase 4: Documentation and Tooling (Estimated: 1-2 days)

#### 4.1 Migration Documentation
- Update component documentation with new token usage
- Create migration examples for common patterns
- Document any breaking changes

#### 4.2 Development Tooling
```json
// ESLint rules to prevent legacy patterns
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value=/bg-gray-|text-gray-|border-gray-/]",
        "message": "Use design system tokens instead of legacy gray classes"
      }
    ]
  }
}
```

## Token Reference

### Color Tokens
```css
/* Backgrounds */
--bg-primary: hsl(var(--color-void));        /* Main background */
--bg-secondary: hsl(var(--color-obsidian));  /* Card backgrounds */
--bg-tertiary: hsl(var(--color-charcoal));   /* Hover states */

/* Text */
--text-primary: hsl(var(--color-snow));      /* Primary text */
--text-secondary: hsl(var(--color-pearl));   /* Secondary text */
--text-tertiary: hsl(var(--color-slate));    /* Tertiary text */

/* Borders */
--border-primary: hsl(var(--color-gunmetal)); /* Primary borders */
--border-secondary: hsl(var(--color-charcoal)); /* Secondary borders */

/* Accents */
--accent-primary: hsl(var(--color-plasma));   /* Primary accent */
--accent-secondary: hsl(var(--color-neural)); /* Secondary accent */
```

### Spacing Tokens
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Border Radius Tokens
```css
--radius-sm: 0.25rem;  /* 4px */
--radius-md: 0.375rem; /* 6px */
--radius-lg: 0.5rem;   /* 8px */
--radius-xl: 0.75rem;  /* 12px */
--radius-2xl: 1rem;    /* 16px */
--radius-full: 9999px; /* Fully rounded */
```

## Implementation Scripts

### 1. Legacy Style Detection Script
```bash
#!/bin/bash
# detect-legacy-styles.sh

echo "=== LEGACY TAILWIND COLORS ==="
grep -r "bg-gray-\|text-gray-\|border-gray-" src/ --include="*.tsx" --include="*.ts" | wc -l

echo "=== HARDCODED HEX COLORS ==="
grep -r "#[0-9a-fA-F]\{3,6\}" src/ --include="*.tsx" --include="*.ts" | wc -l

echo "=== LEGACY SPACING ==="
grep -r "p-[0-9]\|m-[0-9]\|px-[0-9]\|py-[0-9]" src/ --include="*.tsx" | wc -l

echo "=== DETAILED RESULTS ==="
echo "Run with --verbose flag for line-by-line breakdown"
```

### 2. Token Validation Script
```bash
#!/bin/bash
# validate-tokens.sh

echo "Validating design token usage..."

# Check for CSS custom property usage
TOKEN_USAGE=$(grep -r "var(--" src/ --include="*.tsx" --include="*.ts" --include="*.css" | wc -l)
echo "Design token usage count: $TOKEN_USAGE"

# Check for remaining legacy patterns
LEGACY_COUNT=$(grep -r "bg-gray-\|text-gray-\|border-gray-" src/ --include="*.tsx" | wc -l)
echo "Remaining legacy patterns: $LEGACY_COUNT"

if [ $LEGACY_COUNT -eq 0 ]; then
  echo "✅ Migration complete!"
else
  echo "⚠️  $LEGACY_COUNT legacy patterns remaining"
fi
```

## Risk Assessment

### High Risk Areas
1. **Complex Gaming Components**: Character sheets, combat trackers
2. **Dynamic Styling**: Components with runtime style generation
3. **Third-party Integration**: External libraries with custom styling

### Mitigation Strategies
1. **Incremental Migration**: One component at a time
2. **Feature Flags**: Toggle between old/new styles during testing
3. **Backup Plans**: Keep original styling in version control
4. **Stakeholder Communication**: Regular updates on progress

## Success Metrics

### Quantitative Goals
- [ ] 0 legacy Tailwind color classes in codebase
- [ ] 0 hardcoded color values in components
- [ ] 100% design token usage for colors, spacing, typography
- [ ] All accessibility tests passing
- [ ] No visual regressions in key user flows

### Qualitative Goals
- [ ] Consistent dark theme across all components
- [ ] Improved developer experience with semantic tokens
- [ ] Better maintainability and theme flexibility
- [ ] Enhanced gaming-focused visual design

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Discovery | 2-3 days | Legacy style inventory, migration roadmap |
| Migration | 1-2 weeks | Migrated components, updated styles |
| QA | 3-5 days | Testing complete, bugs fixed |
| Documentation | 1-2 days | Updated docs, tooling in place |

**Total Estimated Duration**: 2-3 weeks

## Next Steps

1. **Run Discovery Scripts**: Execute legacy style detection
2. **Create Component Inventory**: List all components needing migration
3. **Prioritize Gaming Components**: Focus on user-facing gaming features first
4. **Set Up Testing Framework**: Ensure we can catch regressions early
5. **Begin Systematic Migration**: Start with highest priority components

## Maintenance

### Post-Migration Guidelines
- New components must use design tokens exclusively
- PR reviews should check for token usage
- Automated linting prevents legacy pattern introduction
- Regular audits to maintain token consistency

### Future Enhancements
- Theme variants (high contrast, colorblind-friendly)
- Component-specific token extensions
- Advanced theming for different game systems
- Performance optimizations for token usage
