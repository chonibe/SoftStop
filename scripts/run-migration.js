#!/usr/bin/env node
/**
 * Run Governor database migration on Supabase
 * 
 * Usage:
 *   node scripts/run-migration.js
 * 
 * Environment variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xutgikcqbjdubwveidir.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   Set it in .env file or pass it as an environment variable');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Running Governor database migration...\n');

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'governor', 'api', 'db', 'migrations', '001_init.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file:', migrationPath);
  console.log('🗄️  Target database:', SUPABASE_URL);
  console.log('\n📝 SQL to execute:\n');
  console.log(migrationSQL);
  console.log('\n🔄 Executing migration...\n');

  // Split SQL into individual statements (basic split by semicolon)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
    
    if (error) {
      // Try direct query execution as fallback
      const { error: queryError } = await supabase.from('governor_events').select('count').limit(0);
      
      if (queryError && queryError.message.includes('does not exist')) {
        console.error('❌ Error: Unable to execute SQL directly via client.');
        console.error('   Please run the migration manually in Supabase SQL Editor:\n');
        console.error(`   1. Go to ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}`);
        console.error('   2. Navigate to SQL Editor');
        console.error('   3. Copy and paste the contents of:');
        console.error(`      ${migrationPath}`);
        console.error('   4. Click "Run"\n');
        process.exit(1);
      }
    }
  }

  // Verify tables were created
  console.log('\n✅ Verifying tables...\n');

  const { data: events, error: eventsError } = await supabase
    .from('governor_events')
    .select('count')
    .limit(0);

  const { data: state, error: stateError } = await supabase
    .from('governor_user_state')
    .select('count')
    .limit(0);

  if (eventsError && eventsError.message.includes('does not exist')) {
    console.error('❌ Table governor_events does not exist');
    console.error('\n📋 Manual migration required:');
    console.error(`   1. Go to ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`);
    console.error('   2. Copy and paste the contents of:');
    console.error(`      ${migrationPath}`);
    console.error('   3. Click "Run"\n');
    process.exit(1);
  }

  if (stateError && stateError.message.includes('does not exist')) {
    console.error('❌ Table governor_user_state does not exist');
    process.exit(1);
  }

  console.log('✅ governor_events table exists');
  console.log('✅ governor_user_state table exists');
  console.log('\n🎉 Migration completed successfully!\n');
  console.log('Next steps:');
  console.log('  1. Set environment variables in Vercel');
  console.log('  2. Test the API endpoints');
  console.log('  3. Run integration tests\n');
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
