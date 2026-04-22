/**
 * Tailwind CSS configuration for FOS (Future of Society) frontend.
 *
 * Maps the `brand` color scale to CSS custom properties from tokens.css
 * so all brand-* utility classes respond to light/dark theme switching:
 *   - Light theme: warm honey-gold (#d4a24e family)
 *   - Dark theme: teal (#2fe6a6 family)
 *
 * Key exports: Tailwind config with content globs and brand color overrides.
 */

module.exports = {
  darkMode: ['selector', '.theme-dark'],
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'var(--ss-brand-soft)',
          100: 'var(--ss-brand-soft)',
          200: 'var(--ss-brand-soft)',
          300: 'var(--ss-brand-soft)',
          400: 'var(--ss-brand-primary)',
          500: 'var(--ss-brand-primary)',
          600: 'var(--ss-brand-primary)',
          700: 'var(--ss-brand-hover)',
          800: 'var(--ss-brand-hover)',
          900: 'var(--ss-brand-on)',
        },
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
