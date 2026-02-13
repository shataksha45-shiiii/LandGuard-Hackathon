/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'land-dark': '#0a0a0c',
        'land-panel': '#16161a',
        'land-accent': '#00f2ff',
      }
    },
  },
  plugins: [],
}