<script setup lang="ts">
const hubs = [
  {
    title: 'Start',
    href: '/start/getting-started',
    description: 'Concept, company use, quickstart, and adoption contract.'
  },
  {
    title: 'Integrate',
    href: '/integrate/workflow',
    description: 'Wire check/record at every escalation touchpoint.'
  },
  {
    title: 'API',
    href: '/api/check',
    description: 'HTTP surface: check, record, verify, health.'
  },
  {
    title: 'Policies',
    href: '/policies/',
    description: 'Action types, default pack, and policy presets.'
  },
  {
    title: 'Self-host',
    href: '/self-host/',
    description: 'Local, Docker, env, and storage.'
  },
  {
    title: 'Ops',
    href: '/ops/orphan-rate',
    description: 'Orphan rate, security, and troubleshooting.'
  }
]
</script>

<template>
  <div class="ss-hub-grid">
    <a v-for="hub in hubs" :key="hub.href" class="ss-hub-card" :href="hub.href">
      <span class="ss-hub-card__title">{{ hub.title }}</span>
      <span class="ss-hub-card__desc">{{ hub.description }}</span>
    </a>
  </div>
</template>
