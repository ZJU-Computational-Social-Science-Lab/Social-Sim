/*
 * Tailwind CSS configuration for SocialSim4 frontend.
 * Key exports: content glob patterns and theme extensions for brand utilities.
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
        brand: colors.sky,
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
