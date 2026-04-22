/**
 * Tailwind CSS configuration for FOS (Future of Society) frontend.
 *
 * Maps the `brand` color scale to the FOS warm honey-gold palette
 * instead of the old sky-blue. All brand-* utility classes (bg-brand-600,
 * text-brand-500, etc.) now render FOS gold tones.
 *
 * Key exports: Tailwind config with content globs and brand color overrides.
 */
const colors = require("tailwindcss/colors");

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
          50:  '#fdf8ed',
          100: '#fbefd0',
          200: '#f5d89a',
          300: '#ecc060',
          400: '#d4a24e',
          500: '#c4922e',
          600: '#b08930',
          700: '#8e6c22',
          800: '#745520',
          900: '#60481d',
        },
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
