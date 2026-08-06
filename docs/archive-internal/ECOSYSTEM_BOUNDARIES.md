# Ecosystem Boundary Enforcement

**Date:** 2026-02-04  
**Status:** Active  
**Enforcement Level:** Automated (ESLint + CI + Pre-push)

---

## Purpose

Enforce Governor's core tenet: **"Governor authorizes. Governor does not execute."**

This means:
- `packages/` (Core) = Authorization only
- `apps/` (Ecosystem) = Execution only
- Ecosystem must use Core through published SDK, not internal imports

---

## The Boundary

```
governer/
├── packages/          ← CORE (Permit Authority)
│   ├── core/         → Pure authorization logic
│   ├── api/          → HTTP API for permits
│   └── sdk/          → Public client library
│
├── apps/              ← ECOSYSTEM (Execution)
│   ├── shopify/      → E-commerce integration
│   └── demo/         → Example implementation
```

**Rule:** Code in `apps/` can ONLY import from `@governor/sdk`, never from `packages/` internals.

---

## What's Blocked

### ❌ Relative Imports to Packages

```typescript
// In apps/shopify/app/services/something.ts

// BLOCKED - Reaching across directories
import { internal } from '../../../packages/core/src/internal';
import { helper } from '../../packages/api/src/utils';
```

### ❌ Internal Package Imports

```typescript
// BLOCKED - Importing from package internals
import { something } from '@governor/core/src/internal';
import { util } from '@governor/api/src/utils';
```

### ⚠️ Direct Core/API Imports (Warning)

```typescript
// WARNED - Should use SDK instead
import { evaluateCheck } from '@governor/core';
import { handler } from '@governor/api';
```

---

## What's Allowed

### ✅ SDK Imports Only

```typescript
// In apps/shopify/app/services/governor.service.ts

// CORRECT - Using published SDK
import { Governor, createGovernor } from '@governor/sdk';
import type { CheckRequest, CheckResponse } from '@governor/sdk';

const governor = createGovernor({
  apiUrl: process.env.GOVERNOR_API_URL,
  apiKey: process.env.GOVERNOR_API_KEY
});
```

---

## Enforcement Layers

### Layer 1: ESLint (Write-time)

**File:** `apps/.eslintrc.js`

Blocks imports as you write code:

```typescript
import { x } from '../../../packages/core/src/helpers';
                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
❌ TENET VIOLATION: Apps must use @governor/sdk, not direct package imports
```

**How to check:**
```bash
cd apps/shopify
pnpm lint
```

### Layer 2: Pre-push Hook (Commit-time)

**File:** `.git/hooks/pre-push`

Blocks push if violations detected:

```bash
git push
🛡️  Governor Pre-Push Check
Checking ecosystem boundaries...
❌ VIOLATION: Apps importing from packages/ directly
apps/shopify/app/test.ts:1:import from '../../../packages/core'
```

**How to test:**
```bash
# Pre-push hook runs automatically on:
git push
```

### Layer 3: GitHub Actions (PR-time)

**File:** `.github/workflows/tenet-check.yml`

Job: `ecosystem-boundary-check`

Blocks PR merge if violations found:

```
❌ Ecosystem Boundary Check: FAILED

Apps importing from package internals
apps/shopify/app/services/test.ts:5:from "@governor/core/src/internal"

Apps can only import from @governor/sdk public API.
```

### Layer 4: Local Script (Development)

**File:** `scripts/check-boundaries.js`

Run manually during development:

```bash
npm run check:boundaries
# Or
node scripts/check-boundaries.js
```

Output:
```
🛡️  Governor Boundary Check
==========================

Checking for relative imports to packages/...
✅ No relative package imports found

Checking for internal package imports...
✅ No internal package imports found

Checking for direct Core/API imports...
✅ Apps use @governor/sdk correctly

Checking workspace dependencies...
✅ Workspace dependencies verified

==========================
✅ All boundary checks passed

Governor governs itself. 🛡️
```

---

## Why This Matters

### Without Boundaries:

```typescript
// Shopify app directly imports Core
import { calculateCooldown } from '../../../packages/core/src/rules/helpers';

// Core team refactors internal helpers
// ❌ Shopify app breaks, even though public API didn't change
```

### With Boundaries:

```typescript
// Shopify app uses SDK
import { Governor } from '@governor/sdk';

// Core can refactor internals freely
// ✅ Shopify app unaffected, SDK handles changes
```

---

## Development Workflow

### Adding New Features

1. **Add to Core** (`packages/core/`)
   - Implement internal logic
   - Export through `src/index.ts` (the public API)

2. **Use in SDK** (`packages/sdk/`)
   - SDK wraps Core's public API
   - Provides ergonomic client interface

3. **Use in Apps** (`apps/`)
   - Import from `@governor/sdk` only
   - Never reach into Core internals

### Example:

```typescript
// 1. Core (packages/core/src/index.ts)
export { evaluateCheck } from './rules/engine';

// 2. SDK (packages/sdk/src/client.ts)
import { evaluateCheck } from '@governor/core';
export class Governor {
  check() { return evaluateCheck(...); }
}

// 3. App (apps/shopify/app/services/governor.service.ts)
import { Governor } from '@governor/sdk';
const gov = new Governor();
gov.check();
```

---

## Testing Boundaries

### Test 1: Try to Violate

Create a test file:

```typescript
// apps/shopify/app/test-violation.ts
import { internal } from '../../../packages/core/src/internal';  // ❌

export const test = () => internal();
```

Run checks:
```bash
npm run check:boundaries
# Should fail with error
```

### Test 2: Correct Usage

```typescript
// apps/shopify/app/test-correct.ts
import { Governor } from '@governor/sdk';  // ✅

export const test = async () => {
  const gov = new Governor({ apiUrl: '...', apiKey: '...' });
  return gov.check({ userId: '123', actionType: 'urgency' });
};
```

Run checks:
```bash
npm run check:boundaries
# Should pass
```

---

## Workspace Dependencies

Apps use `workspace:*` for local development:

```json
// apps/shopify/package.json
{
  "dependencies": {
    "@governor/sdk": "workspace:*"  // ← Links to local packages/sdk/
  }
}
```

**Why `workspace:*`?**
- During development: Links to local `packages/sdk/`
- Changes to SDK instantly available in apps
- Fast iteration without publishing

**When publishing:**
- Replace `workspace:*` with actual version: `"^1.0.0"`
- Or use pnpm's automatic replacement on publish

---

## Troubleshooting

### Error: "Cannot find module '@governor/sdk'"

**Cause:** SDK not built or linked

**Fix:**
```bash
pnpm install          # Install all dependencies
pnpm build:packages   # Build SDK
```

### Error: "TENET VIOLATION: Apps must use @governor/sdk"

**Cause:** You're importing from packages internals

**Fix:**
1. Find the import statement causing the error
2. Replace with SDK import
3. If functionality not in SDK, add it to SDK first

### Warning: "Should use workspace:*"

**Cause:** App has hardcoded version instead of workspace link

**Fix:**
```json
// Change from:
"@governor/sdk": "1.0.0"

// To:
"@governor/sdk": "workspace:*"
```

---

## Related Documentation

- [TENETS.md](../TENETS.md) - Core tenets and purity test
- [GOVERNANCE_FIX.md](GOVERNANCE_FIX.md) - Why we need enforcement
- [SPRINT_2_POSTMORTEM.md](../SPRINT_2_POSTMORTEM.md) - The violation that led to this
- [packages/sdk/README.md](../packages/sdk/README.md) - SDK documentation

---

## Scripts Reference

```bash
# Check boundaries only
npm run check:boundaries

# Check tenets only
npm run check:tenets

# Check everything
npm run check:all

# Run in CI
.github/workflows/tenet-check.yml → ecosystem-boundary-check job
```

---

**Governor authorizes. Apps execute. The boundary is enforced.** 🛡️
