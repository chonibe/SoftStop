# Governor Setup Guide

Complete setup guide for deploying Governor to production.

## Prerequisites

- Supabase account with a project created
- Vercel account
- GitHub repository connected to Vercel

## Step 1: Database Migration

Run the database migration to create required tables in Supabase.

### Option A: Supabase Dashboard (Manual)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. For each migration file in `governor/api/db/migrations/`:
   - Click **New Query**
   - Copy/paste the contents of `001_init.sql`, then run
   - Copy/paste the contents of `002_analytics.sql`, then run

### Option B: Migration Script (Automatic)

Add to `.env` (copy from `.env.example`):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
```

Get `DATABASE_URL` from: **Project Settings → Database → Connection string (URI)**

```bash
node scripts/run-migration.js
```

Without `DATABASE_URL`, the script falls back to RPC (if available) or prints manual instructions.

### Verify Tables Created

After running the migration, verify in Supabase Dashboard → Table Editor:
- ✅ `governor_events` table exists
- ✅ `governor_user_state` table exists
- ✅ `analytics_users` table exists (validity test)
- ✅ `analytics_events` table exists (validity test)

## Step 2: Configure Vercel Environment Variables

1. Go to your Vercel project: https://vercel.com/chonibes-projects/governer
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

```
SUPABASE_URL=https://xutgikcqbjdubwveidir.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

Get your service role key from:
- Supabase Dashboard → Project Settings → API → `service_role` key

4. Click **Save**
5. Build and deploy:
   ```bash
   npm run build    # compiles governor TS to dist/ (required for api/check and api/record)
   vercel deploy --prod
   ```
   Ensure your Vercel project build settings run `npm run build` so the API routes can load the compiled code from `dist/`.

## Step 3: Test the API

### Test /api/check endpoint

```bash
curl -X POST https://governer.vercel.app/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_001",
    "actionType": "urgency",
    "surface": "email"
  }'
```

**Expected response:**
```json
{
  "allowed": true,
  "reason": "allowed",
  "decisionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Test /api/record endpoint

```bash
curl -X POST https://governer.vercel.app/api/record \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_001",
    "actionType": "urgency",
    "outcome": "executed",
    "decisionId": "<decision_id_from_check>",
    "signals": {
      "dismissed": false
    }
  }'
```

**Expected response:**
```json
{
  "ok": true
}
```

### Verify in Supabase

Go to Supabase Table Editor and check:
- `governor_events`: Should have 2 new rows (check + record)
- `governor_user_state`: Should have 1 row for `test_user_001`

## Step 4: Run Unit Tests

```bash
npm test
```

All tests should pass.

## Step 5: Integration

See [examples/README.md](examples/README.md) for integration guides in:
- Node.js
- Python
- Browser/JavaScript

## Troubleshooting

### Issue: 500 Error from /api/check

**Cause:** Environment variables not set in Vercel

**Fix:**
1. Check Vercel → Settings → Environment Variables
2. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
3. Redeploy

### Issue: "relation governor_events does not exist"

**Cause:** Migration not run

**Fix:** Run the migration (see Step 1)

### Issue: Tests failing

**Cause:** Dependencies not installed

**Fix:**
```bash
npm install
npm test
```

## Next Steps

Once setup is complete:
1. Review the [integration examples](examples/README.md)
2. Integrate Governor into your application
3. Monitor usage in Supabase Table Editor
4. Adjust rules in `governor/api/src/rules/config.ts` as needed

## Support

For issues or questions:
- Review [governor/README.md](governor/README.md) for technical details
- Check [docs/CONCEPT.md](docs/CONCEPT.md) for how Governor works
- Review [docs/ONE_PAGER.md](docs/ONE_PAGER.md) for the big picture
