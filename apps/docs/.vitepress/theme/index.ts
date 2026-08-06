import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import HubCards from './components/HubCards.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HubCards', HubCards)
  }
} satisfies Theme
