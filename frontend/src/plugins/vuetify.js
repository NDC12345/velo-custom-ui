import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const veloTI = {
  dark: true,
  colors: {
    primary:    '#3b82f6',
    secondary:  '#94a3b8',
    accent:     '#22d3ee',
    error:      '#ef4444',
    warning:    '#f59e0b',
    info:       '#3b82f6',
    success:    '#22c55e',
    background: '#080b12',
    surface:    '#111623',
    'surface-variant': '#171d2e',
  },
}

const veloTILight = {
  dark: false,
  colors: {
    primary:    '#2563eb',
    secondary:  '#64748b',
    accent:     '#0ea5e9',
    error:      '#dc2626',
    warning:    '#d97706',
    info:       '#2563eb',
    success:    '#16a34a',
    background: '#edf1f8',
    surface:    '#ffffff',
    'surface-variant': '#f1f5fc',
  },
}

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'veloTI',
    themes: { veloTI, veloTILight },
  },
  defaults: {
    VCard:      { rounded: 'lg', elevation: 0 },
    VBtn:       { rounded: 'md' },
    VTextField: { variant: 'outlined', density: 'compact' },
    VSelect:    { variant: 'outlined', density: 'compact' },
    VTextarea:  { variant: 'outlined', density: 'compact' },
    VDataTable: { density: 'compact', hover: true },
    VChip:      { rounded: 'md', size: 'small' },
  },
  icons: { defaultSet: 'mdi' },
})
