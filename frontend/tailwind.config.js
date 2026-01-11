/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#ee6c2b",
        "background-light": "#fdfbf7",
        "background-dark": "#221610",
        "surface-light": "#ffffff",
        "surface-dark": "#2C221C",
        "text-primary-light": "#181311",
        "text-primary-dark": "#f4f2f0",
        "text-secondary-light": "#896f61",
        "text-secondary-dark": "#b0a095",
        // Цвета для винного меню (из макета wine-item.html)
        "cream": "#F7F4EB",
        "wine-red": "#4A0404",
        "wine-red-light": "#800000",
        "text-dark": "#1A1A1A",
        "footer-bg": "#2E2E2E",
        "card-border": "#D4C5A5",
        "custom-burgundy": "#5e2129",
      },
      fontFamily: {
        "display": ["Be Vietnam Pro", "sans-serif"],
        "serif": ["Playfair Display", "serif"],
        "sans": ["Lato", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "2xl": "2rem",
        "full": "9999px"
      },
    },
  },
  plugins: [],
}

