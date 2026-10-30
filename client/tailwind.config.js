/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#080D14",
        sidebarBg: "#0B111D",
        cardBg: "#0E1626",
        innerBg: "#121D32",
        borderDark: "#1B2A44",
        emeraldMain: "#10B981",
        emeraldText: "#34D399",
      }
    },
  },
  plugins: [],
}
