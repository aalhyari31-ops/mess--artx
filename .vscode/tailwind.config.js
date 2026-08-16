/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/templates/**/*.html",
    "./src/assets/js/**/*.js",
    "./scripts/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { 
        background: '#0a0a0a', 
        foreground: '#f5f5f5', 
        primary: '#c8a45d', 
        secondary: '#1f1f1f' 
      },
      fontFamily: { 
        sans: ['Montserrat', 'sans-serif'], 
        heading: ['Playfair Display', 'serif'], 
        arabic: ['Cairo', 'sans-serif'] 
      }
    },
  },
  plugins: [],
}