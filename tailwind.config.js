/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Fond de l'app : violet-950 assombri (défaut Tailwind : #2e1065)
        violet: { 950: "#220c4c" },
      },
    },
  },
  plugins: [],
};
