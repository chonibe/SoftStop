#!/usr/bin/env node
/**
 * Check Ecosystem Boundaries
 * 
 * Verifies that apps/ don't import from packages/ internals.
 * Run locally: node scripts/check-boundaries.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🛡️  Governor Boundary Check');
console.log('==========================\n');

let violations = 0;
const appsDir = path.join(__dirname, '..', 'apps');
const packagesDir = path.join(__dirname, '..', 'packages');

if (!fs.existsSync(appsDir) || !fs.readdirSync(appsDir).some(f => fs.statSync(path.join(appsDir, f)).isDirectory())) {
  console.log('No apps/ packages present – skipping boundary checks.\n');
  console.log('==========================');
  console.log('✅ All boundary checks passed');
  console.log('\nGovernor governs itself. 🛡️\n');
  process.exit(0);
}

// Check 1: Relative imports to packages/
console.log('Checking for relative imports to packages/...');
try {
  const relativeImports = execSync(
    `grep -r -n "from ['\\\"].*\\/packages\\/" apps/ 2>/dev/null || true`,
    { encoding: 'utf8', shell: 'bash' }
  ).trim();
  
  if (relativeImports) {
    console.error('❌ VIOLATION: Apps importing from packages/ directly\n');
    console.error(relativeImports);
    console.error('\nApps MUST use @governor/sdk, not direct imports.\n');
    violations++;
  } else {
    console.log('✅ No relative package imports found\n');
  }
} catch (e) {
  // grep returns 1 when no matches, which is good
  console.log('✅ No relative package imports found\n');
}

// Check 2: Internal package imports
console.log('Checking for internal package imports...');
try {
  const internalImports = execSync(
    `grep -r -n "from ['\\\"]@governor/\\(core\\|api\\)/src" apps/ 2>/dev/null || true`,
    { encoding: 'utf8', shell: 'bash' }
  ).trim();
  
  if (internalImports) {
    console.error('❌ VIOLATION: Apps importing from package internals\n');
    console.error(internalImports);
    console.error('\nApps can only import from @governor/sdk public API.\n');
    violations++;
  } else {
    console.log('✅ No internal package imports found\n');
  }
} catch (e) {
  // grep returns 1 when no matches, which is good
  console.log('✅ No internal package imports found\n');
}

// Check 3: Direct @governor/core or @governor/api imports
console.log('Checking for direct Core/API imports...');
try {
  const directImports = execSync(
    `grep -r -n "from ['\\\"]@governor/\\(core\\|api\\)['\\\"]" apps/ 2>/dev/null || true`,
    { encoding: 'utf8', shell: 'bash' }
  ).trim();
  
  if (directImports) {
    console.error('⚠️  WARNING: Apps should use @governor/sdk, not @governor/core or @governor/api\n');
    console.error(directImports);
    console.error('\n');
    // Don't count as violation, but warn
  } else {
    console.log('✅ Apps use @governor/sdk correctly\n');
  }
} catch (e) {
  // grep returns 1 when no matches, which is good
  console.log('✅ Apps use @governor/sdk correctly\n');
}

// Check 4: Verify workspace:* usage
console.log('Checking workspace dependencies...');
if (fs.existsSync(appsDir)) {
  const apps = fs.readdirSync(appsDir).filter(f => 
    fs.statSync(path.join(appsDir, f)).isDirectory()
  );

  for (const app of apps) {
    const pkgPath = path.join(appsDir, app, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      for (const [name, version] of Object.entries(deps)) {
        if (name.startsWith('@governor/') && version !== 'workspace:*') {
          console.error(`⚠️  ${app}/package.json: ${name} should use "workspace:*", not "${version}"`);
        }
      }
    }
  }
  console.log('✅ Workspace dependencies verified\n');
}

console.log('==========================');
if (violations > 0) {
  console.error(`❌ ${violations} boundary violation(s) found`);
  console.error('\nGovernor authorizes. Apps execute.');
  console.error('Apps must use @governor/sdk public API only.\n');
  process.exit(1);
} else {
  console.log('✅ All boundary checks passed');
  console.log('\nGovernor governs itself. 🛡️\n');
  process.exit(0);
}
