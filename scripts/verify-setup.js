#!/usr/bin/env node
/**
 * Verify Governor setup is complete
 * 
 * Checks:
 * - Environment variables are set
 * - Database tables exist
 * - API endpoints are working
 */

const https = require('https');

const VERCEL_URL = 'https://softstop.vercel.app';
const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

console.log('🔍 Verifying Governor setup...\n');

// Check environment variables (local)
console.log('1. Checking local environment variables...');
const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.log(`   ⚠️  Missing: ${missingVars.join(', ')}`);
  console.log('   ℹ️  This is OK if you\'re running from Vercel');
} else {
  console.log('   ✅ All environment variables set locally');
}

// Test API endpoint
console.log('\n2. Testing /api/check endpoint...');

const testPayload = JSON.stringify({
  userId: 'setup_verification_test',
  actionType: 'urgency',
  surface: 'test'
});

const options = {
  hostname: 'governer.vercel.app',
  path: '/api/check',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testPayload.length
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('   ✅ API is responding');
      try {
        const json = JSON.parse(data);
        if (json.allowed !== undefined && json.decisionId) {
          console.log('   ✅ Response format is correct');
          console.log(`   ℹ️  Decision: ${json.allowed ? 'ALLOWED' : 'BLOCKED'}`);
          console.log(`   ℹ️  Reason: ${json.reason}`);
          console.log('\n✅ Setup verification complete!');
          console.log('\nNext steps:');
          console.log('  - Review examples/README.md for integration guides');
          console.log('  - Check Supabase Table Editor for logged events');
          console.log('  - Start integrating Governor into your app\n');
        } else {
          console.log('   ⚠️  Unexpected response format');
          console.log(`   Response: ${data}`);
        }
      } catch (e) {
        console.log('   ⚠️  Invalid JSON response');
        console.log(`   Response: ${data}`);
      }
    } else if (res.statusCode === 500) {
      console.log('   ❌ API error (500)');
      console.log('   Possible causes:');
      console.log('     - Environment variables not set in Vercel');
      console.log('     - Database tables not created');
      console.log('   See SETUP.md for instructions');
    } else {
      console.log(`   ❌ Unexpected status code: ${res.statusCode}`);
      console.log(`   Response: ${data}`);
    }
  });
});

req.on('error', (e) => {
  console.log(`   ❌ Request failed: ${e.message}`);
  console.log('   Check your internet connection and try again');
});

req.write(testPayload);
req.end();
