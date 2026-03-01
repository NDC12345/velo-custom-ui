/** @type {import('tailwindcss').Config} */
export default {
  // tw- prefix avoids collision with Vuetify utility classes
  prefix: 'tw-',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  // Activated by <html data-theme="light"> via useThemeStore
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      // ── CSS-variable–backed color palette ───────────────────────────────
      colors: {
        /* App backgrounds */
        'bg-app':      'var(--bg-app)',
        'bg-paper':    'var(--bg-paper)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-hover':    'var(--bg-hover)',
        /* Brand accent */
        accent:        'var(--accent)',
        'accent-sub':  'var(--accent-subtle)',
        /* Security severity scale */
        critical: 'var(--sev-critical)',
        high:     'var(--sev-high)',
        medium:   'var(--sev-medium)',
        low:      'var(--sev-low)',
        info:     'var(--sev-info)',
        unknown:  'var(--sev-unknown)',
        /* Chart palette */
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
        'chart-6': 'var(--chart-6)',
        /* Status states */
        online:      'var(--state-online)',
        offline:     'var(--state-offline)',
        compromised: 'var(--state-compromised)',
        scanning:    'var(--state-scanning)',
        /* XDR raw brand (constant across themes) */
        xdr: {
          bg:      '#020d1a',
          surface: '#071a2e',
          border:  '#0d2a45',
          accent:  '#00c8ff',
          green:   '#00ff9d',
          amber:   '#f59e0b',
          red:     '#ef4444',
          muted:   '#4a7fa5',
        },
      },

      // ── Font families ────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },

      // ── Font sizes mapped to design scale ───────────────────────────────
      fontSize: {
        '2xs': ['9px',  { lineHeight: '1.2' }],
        xs:    ['10px', { lineHeight: '1.3' }],
        sm:    ['11px', { lineHeight: '1.4' }],
        base:  ['13px', { lineHeight: '1.55' }],
        md:    ['14px', { lineHeight: '1.5' }],
        lg:    ['16px', { lineHeight: '1.45' }],
        xl:    ['20px', { lineHeight: '1.35' }],
        '2xl': ['24px', { lineHeight: '1.25' }],
        '3xl': ['32px', { lineHeight: '1.15' }],
        '4xl': ['42px', { lineHeight: '1' }],
      },

      // ── Border radii ─────────────────────────────────────────────────────
      borderRadius: {
        xs:   'var(--radius-xs)',
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        '2xl':'var(--radius-2xl)',
        xdr:  '6px',
      },

      // ── Box shadows / glows ──────────────────────────────────────────────
      boxShadow: {
        xs:     'var(--shadow-xs)',
        sm:     'var(--shadow-sm)',
        md:     'var(--shadow-md)',
        lg:     'var(--shadow-lg)',
        xl:     'var(--shadow-xl)',
        accent: 'var(--shadow-accent)',
        inset:  'var(--shadow-inset)',
        focus:  'var(--focus-ring)',
        /* Severity glows */
        'glow-critical': 'var(--glow-critical)',
        'glow-high':     'var(--glow-high)',
        'glow-medium':   'var(--glow-medium)',
        'glow-low':      'var(--glow-low)',
        'glow-info':     'var(--glow-info)',
        'glow-accent':   'var(--glow-accent)',
        /* Legacy XDR glows */
        xdr:          '0 0 20px rgba(0, 200, 255, 0.08)',
        glow:         '0 0 12px rgba(0, 200, 255, 0.30)',
        'glow-green': '0 0 12px rgba(0, 255, 157, 0.30)',
        'glow-red':   '0 0 12px rgba(239, 68, 68, 0.30)',
      },

      // ── Spacing ──────────────────────────────────────────────────────────
      spacing: {
        dash:    'var(--content-pad)',
        sidebar: 'var(--sidebar-width)',
        topbar:  'var(--topbar-height)',
      },

      // ── Transitions ──────────────────────────────────────────────────────
      transitionTimingFunction: {
        spring:    'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-expo':'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        fast:   '120ms',
        normal: '200ms',
        slow:   '360ms',
        spring: '460ms',
      },

      // ── Animations ───────────────────────────────────────────────────────
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow':   'ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'shimmer':     'skeleton-shimmer 1.6s ease-in-out infinite',
        'subtle-glow': 'subtle-glow 2s ease-in-out infinite',
        'slide-up':    'slide-up-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },

      // ── Backdrop blur ────────────────────────────────────────────────────
      backdropBlur: {
        xs: '4px',
        sm: '6px',
        md: '12px',
        lg: '20px',
        xl: '32px',
      },

      // ── Z-index scale ────────────────────────────────────────────────────
      zIndex: {
        base:    '0',
        surface: '1',
        raised:  '2',
        overlay: '10',
        sticky:  '20',
        modal:   '100',
        toast:   '200',
      },

      // ── Grid helpers ─────────────────────────────────────────────────────
      gridTemplateColumns: {
        kpi:      'repeat(4, 1fr)',
        ins:      'repeat(3, 1fr)',
        ch:       '1fr 1fr 240px',
        'auto-sm':'repeat(auto-fit, minmax(200px, 1fr))',
        'auto-md':'repeat(auto-fit, minmax(280px, 1fr))',
      },
    },
  },
  plugins: [],
}
