/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#d41193",
                "background-light": "#f8f6f7",
                "background-dark": "#22101c",
                "surface-dark": "#33192b",
                "border-dark": "#673255",
                "chip-bg": "#48233c",
            },
            fontFamily: {
                "display": ["Plus Jakarta Sans", "sans-serif"]
            },
            borderRadius: {
                "lg": "1rem",
                "xl": "1.5rem",
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
}
