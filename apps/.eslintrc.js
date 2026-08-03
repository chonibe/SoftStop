/**
 * ESLint config for Governor Ecosystem Apps
 * 
 * Enforces tenet: Apps must use @governor/sdk, never direct imports from packages/
 */

module.exports = {
  root: false,  // Inherits from root config
  rules: {
    // CRITICAL: Block direct imports from packages/
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/packages/**', '../../../packages/**', '../../packages/**'],
          message: '❌ TENET VIOLATION: Apps must use @governor/sdk, not direct package imports. Governor authorizes, it does not expose internals.'
        },
        {
          group: ['@governor/core/src/**', '@governor/api/src/**'],
          message: '❌ TENET VIOLATION: Cannot import from package internals. Use @governor/sdk public API only.'
        }
      ],
      paths: [
        {
          name: '@governor/core',
          message: '❌ Apps must use @governor/sdk instead of @governor/core directly.'
        },
        {
          name: '@governor/api',
          message: '❌ Apps cannot import from @governor/api. Use SDK or HTTP API.'
        }
      ]
    }]
  }
};
