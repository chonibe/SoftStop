#!/usr/bin/env node
/**
 * Run Governor database migration on Supabase
 *
 * Usage:
 *   node scripts/run-migration.js
 *
 * Environment variables:
 *   DATABASE_URL - Direct Postgres connection string (recommended for DDL)
 *   SUPABASE_URL - Your Supabase project URL (for table verification)
 *   SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 *
 * If DATABASE_URL is set, migrations run via pg. Otherwise falls back to
 * exec_sql RPC (if available) or prints manual instructions.
 */

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xutgikcqbjdubwveidir.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   Set it in .env file or pass it as an environment variable');
  process.exit(1);
}

async function runWithPg() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const migrationsDir = path.join(__dirname, '..', 'governor', 'api', 'db', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('\n📄 Migration:', file);
    console.log('🔄 Executing...\n');

    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`  Statement ${i + 1}/${statements.length}...`);
      await client.query(statement);
    }
  }

  await client.end();
}

async function runMigration() {
  console.log('🚀 Running Governor database migration...\n');
  console.log('🗄️  Target database:', SUPABASE_URL);

  const migrationsDir = path.join(__dirname, '..', 'governor', 'api', 'db', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  if (DATABASE_URL) {
    try {
      await runWithPg();
    } catch (err) {
      console.error('❌ Migration failed:', err.message);
      console.log('\n📋 Run migrations manually in Supabase SQL Editor:');
      migrationFiles.forEach(f => console.log(`   - governor/api/db/migrations/${f}`));
      process.exit(1);
    }
  } else {
    let ran = false;
    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      const statements = migrationSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const s of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql: s + ';' });
        if (error) {
          console.warn('\n⚠️  exec_sql RPC not available. Use DATABASE_URL for auto-migration.');
          console.log('\n📋 Run migrations manually in Supabase SQL Editor:');
          migrationFiles.forEach(f => console.log(`   - governor/api/db/migrations/${f}`));
          console.log('   Get DATABASE_URL from: Project Settings → Database → Connection string (URI)\n');
          break;
        }
        ran = true;
      }
    }
  }

  // Verify tables
  console.log('\n✅ Verifying tables...\n');

  const tables = [
    ['governor_events', '001_init'],
    ['governor_user_state', '001_init'],
    ['analytics_users', '002_analytics'],
    ['analytics_events', '002_analytics'],
    ['tenant_api_keys', '004_api_keys'],
  ];

  let allOk = true;
  for (const [table, migration] of tables) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (error && error.message.includes('does not exist')) {
      console.log(`❌ ${table} missing (run governor/api/db/migrations/${migration}.sql in Supabase SQL Editor)`);
      allOk = false;
    } else {
      console.log(`✅ ${table}`);
    }
  }

  if (allOk) {
    console.log('\n🎉 All migrations verified.\n');
  } else {
    console.log('\n📋 Run SQL files in Supabase Dashboard → SQL Editor.\n');
  }
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
