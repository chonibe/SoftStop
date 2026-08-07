import { defineConfig } from 'vitepress'

export const DEMO_URL = 'https://softstop.vercel.app'
export const GITHUB_URL = 'https://github.com/chonibe/SoftStop'
/** Public docs origin (separate Vercel project). */
export const DOCS_PUBLIC_URL = 'https://softstop-docs.vercel.app'

const sidebar = [
  {
    text: 'Start',
    collapsed: false,
    items: [
      { text: 'Concept', link: '/start/concept' },
      { text: 'Governing AI agents', link: '/start/governing-ai-agents' },
      { text: 'Getting started', link: '/start/getting-started' },
      { text: 'Adoption contract', link: '/start/adoption-contract' }
    ]
  },
  {
    text: 'Integrate',
    collapsed: false,
    items: [
      { text: 'Workflow', link: '/integrate/workflow' },
      { text: 'JS SDK', link: '/integrate/sdk-js' },
      { text: 'Python SDK', link: '/integrate/sdk-python' },
      { text: 'Examples', link: '/integrate/examples' }
    ]
  },
  {
    text: 'API',
    collapsed: false,
    items: [
      { text: 'check', link: '/api/check' },
      { text: 'record', link: '/api/record' },
      { text: 'merge', link: '/api/merge' },
      { text: 'pressure & activity', link: '/api/pressure' },
      { text: 'verify', link: '/api/verify' },
      { text: 'health', link: '/api/health' },
      { text: 'Errors', link: '/api/errors' }
    ]
  },
  {
    text: 'Integrations',
    collapsed: false,
    items: [
      { text: 'PostHog', link: '/integrations/posthog' }
    ]
  },
  {
    text: 'Policies',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/policies/' },
      { text: 'Default pack', link: '/policies/default-pack' },
      { text: 'Action types', link: '/policies/action-types' }
    ]
  },
  {
    text: 'Self-host',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/self-host/' },
      { text: 'Docker', link: '/self-host/docker' },
      { text: 'Environment', link: '/self-host/env' },
      { text: 'Storage', link: '/self-host/storage' }
    ]
  },
  {
    text: 'Ops',
    collapsed: false,
    items: [
      { text: 'Orphan rate', link: '/ops/orphan-rate' },
      { text: 'Security', link: '/ops/security' },
      { text: 'Troubleshooting', link: '/ops/troubleshooting' }
    ]
  }
]

export default defineConfig({
  title: 'SoftStop',
  description:
    'The Circuit Breaker for Autonomous Agents and Customer Outreach.',
  lang: 'en-US',
  cleanUrls: true,
  appearance: 'dark',
  // Local self-host console URLs are intentional; not part of the docs site.
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  head: [
    ['link', { rel: 'icon', href: '/softstop-icon.png', type: 'image/png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'SoftStop Docs' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'The Circuit Breaker for Autonomous Agents and Customer Outreach.'
      }
    ],
    ['meta', { property: 'og:image', content: '/softstop-cover.png' }],
    ['meta', { name: 'theme-color', content: '#0B0B0F' }],
    ['link', { rel: 'preconnect', href: 'https://api.fontshare.com' }],
    [
      'link',
      { rel: 'preconnect', href: 'https://cdn.fontshare.com', crossorigin: '' }
    ],
    [
      'link',
      {
        href: 'https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap',
        rel: 'stylesheet'
      }
    ]
  ],
  themeConfig: {
    logo: { light: '/softstop-mark.svg', dark: '/softstop-mark-dark.svg' },
    siteTitle: 'SoftStop',
    nav: [
      { text: 'Start', link: '/start/getting-started' },
      { text: 'Integrate', link: '/integrate/workflow' },
      { text: 'API', link: '/api/check' },
      { text: 'Policies', link: '/policies/' },
      { text: 'Self-host', link: '/self-host/' },
      { text: 'Ops', link: '/ops/orphan-rate' },
      { text: 'Demo', link: DEMO_URL },
      { text: 'GitHub', link: GITHUB_URL }
    ],
    sidebar,
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    outline: { level: [2, 3] },
    footer: {
      message: 'Authorize-only pressure permit. MIT licensed.',
      copyright: 'SoftStop'
    }
  }
})
