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
        'govt-blue': '#003366',
        'govt-blue-dark': '#002244',
        'govt-navy': '#001a33',
        'govt-saffron': '#FF9933',
        'govt-green': '#138808',
        'govt-light': '#e8eef6',
        'govt-border': '#c5d0de',
        'cg-teal': '#1b3a4b',
        'cg-teal-dark': '#152d3a',
        'cg-teal-light': '#24505f',
        'cg-teal-accent': '#2a6478',
      },
      fontFamily: {
        'govt': ['Space Grotesk', 'Noto Sans', 'sans-serif'],
        'heading': ['Space Grotesk', 'sans-serif'],
      }
    },
  },
  plugins: [],
}