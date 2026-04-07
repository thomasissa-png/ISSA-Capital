import type { Config } from 'tailwindcss';

/**
 * Tailwind config — ISSA Capital
 * Tokens 3 tiers : primitive → semantic → component.
 * Source de vérité : docs/design/design-tokens.json
 * Seuls les tokens primitifs sont exposés ici. Les tokens semantic/component
 * sont composés via des classes utilitaires dans les composants.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0A0A0A',
          900: '#1A1A1A',
          800: '#2D2D2D',
          700: '#3D3D3D',
          600: '#525252',
          500: '#6B6B6B',
          400: '#8A8A8A',
          300: '#ADADAD',
          200: '#D1D1D1',
          100: '#E8E8E8',
          50: '#F2F2F2',
        },
        parchment: {
          950: '#3D2E1A',
          800: '#6B4F2A',
          600: '#9C7A50',
          200: '#EDE5D4',
          100: '#F5F0E8',
          50: '#FAF7F2',
        },
        levant: {
          700: '#8B5E2A',
          600: '#A87340',
          500: '#C4935A',
          400: '#D4AC7A',
          300: '#E2C9A0',
          100: '#F5EDDE',
        },
        reserve: {
          700: '#7A1A1A',
          600: '#9B2020',
          500: '#B83232',
          100: '#F5DEDE',
        },
      },
      fontFamily: {
        heading: ['var(--font-cormorant)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        h1: ['clamp(2.25rem, 4.5vw, 3.5rem)', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        h2: ['clamp(1.75rem, 3.2vw, 2.5rem)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h3: ['clamp(1.375rem, 2.4vw, 1.875rem)', { lineHeight: '1.33', letterSpacing: '-0.015em' }],
        h4: ['clamp(1.125rem, 1.8vw, 1.375rem)', { lineHeight: '1.45', letterSpacing: '-0.01em' }],
        lead: ['clamp(1.125rem, 1.6vw, 1.25rem)', { lineHeight: '1.6', letterSpacing: '-0.005em' }],
        base: ['1rem', { lineHeight: '1.75', letterSpacing: '0em' }],
        sm: ['0.875rem', { lineHeight: '1.7', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1.67', letterSpacing: '0.02em' }],
        label: ['0.875rem', { lineHeight: '1.43', letterSpacing: '0.05em' }],
        overline: ['0.75rem', { lineHeight: '1.33', letterSpacing: '0.12em' }],
      },
      spacing: {
        '2xs': '0.125rem',
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
        '4xl': '6rem',
        '5xl': '8rem',
        '6xl': '12rem',
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        md: '4px',
        full: '9999px',
      },
      boxShadow: {
        none: 'none',
        subtle: '0 1px 3px rgba(10,10,10,0.08)',
      },
      transitionDuration: {
        instant: '0ms',
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
        glacial: '1000ms',
      },
      transitionTimingFunction: {
        default: 'cubic-bezier(0.4, 0, 0.2, 1)',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        out: 'cubic-bezier(0, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      maxWidth: {
        content: '1280px',
        editorial: '720px',
        narrow: '560px',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
};

export default config;
