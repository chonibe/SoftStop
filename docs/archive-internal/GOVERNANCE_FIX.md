# Governor Governance Fix

**Date:** 2026-02-04  
**Issue:** Governor failed to govern itself  
**Status:** RESOLVED

---

## The Problem

A commit that violated Governor's core tenets was pushed directly to `main` and made it to production. The messaging gateway implementation:

1. **Violated Core Tenet**: "Governor authorizes, Governor does not execute"
   - Implemented email sending directly in Core (via Resend provider)
   - Should have only issued permits for external systems to execute

2. **Bypassed Tenet Checks**: The tenet-check workflow only runs on PRs, not direct pushes to main

3. **Wrong Directory Pattern**: Checks monitored `governor/` but code was in `packages/`

---

## What Was Committed (and Reverted)

Commit: `f492965` - "feat: Add Sprint 2 messaging gateway with Resend integration"  
Reverted: `c514584`

The implementation added:
- `/api/execute/message` endpoint that sends emails via Resend
- `ResendProvider` class in Core
- Direct execution logic violating the "authorize, don't execute" principle

---

## The Fix (3-Layer Defense)

### Layer 1: Updated Tenet-Check Workflow

**File:** `.github/workflows/tenet-check.yml`

Changes:
- Monitor both `governor/` AND `packages/` directories
- Added `resend` to forbidden imports list
- Check both paths in all violation scans

```yaml
# Before
CORE_CHANGED=$(... | grep -E '^governor/(api/src|core)/' ...)

# After  
CORE_CHANGED=$(... | grep -E '^(governor/(api/src|core)|packages/(api|core))/' ...)
```

### Layer 2: Local Pre-Push Hook

**File:** `.git/hooks/pre-push`

Blocks direct pushes to main that:
- Modify Core files (`governor/` or `packages/`)
- Import execution providers (resend, sendgrid, etc.)
- Bypass the PR workflow

To install:
```bash
# Unix/Mac/Linux
./scripts/setup-hooks.sh

# Windows
.\scripts\setup-hooks.ps1
```

### Layer 3: Branch Protection (Recommended)

On GitHub, enable:
- Require pull requests before merging
- Require status checks to pass (tenet-check)
- Require approvals (1+ from CODEOWNERS)
- Block force pushes

---

## Testing the Fix

Attempted to recreate the violation:

1. ✅ **Pre-push hook** - Blocked the push locally
2. ✅ **Workflow patterns** - Now matches `packages/` directory
3. ✅ **Import detection** - Now catches `resend` imports

---

## Lessons Learned

1. **Defense in depth**: Need multiple layers (local hooks + CI + branch protection)
2. **Pattern completeness**: Monitor ALL code paths, not just historical ones
3. **Test governance**: Periodically attempt violations to verify enforcement
4. **Explicit is better**: Branch protection should be required, not optional

---

## The Right Architecture

For messaging gateway Sprint 2, the correct approach is:

```
❌ WRONG (what was committed):
Client → /api/check → Permit
Client → /api/execute/message + permit → Governor sends email via Resend

✅ CORRECT:
Client → /api/check → Permit
Client → External System + permit
External System → /api/verify → Governor validates permit
External System → Sends email via Resend
```

**Governor authorizes. External systems execute.**

---

## Related Files

- `TENETS.md` - Core invariant: "Governor authorizes, Governor does not execute"
- `tenet-policy.json` - Policy configuration
- `.github/CODEOWNERS` - Who can approve governance changes
- `.github/workflows/tenet-check.yml` - Automated enforcement

---

## Prevention Checklist

- [x] Updated tenet-check to monitor packages/
- [x] Added pre-push hook
- [x] Created hook install scripts
- [x] Reverted violating commit
- [x] Documented the incident
- [ ] Enable GitHub branch protection (requires org admin)
- [ ] Schedule quarterly governance audit
- [ ] Add governance testing to CI

---

**Governor now governs itself properly. 🛡️**
