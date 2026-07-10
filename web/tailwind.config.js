/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#1B4332", light: "#2D6A4F", dark: "#0F2A1F", 50: "#EAF3EE" },
        gold: { DEFAULT: "#E8A33D", light: "#F2C572", dark: "#C9821F" },
        cream: { DEFAULT: "#FDF8F0", dark: "#F5EDDD" },
        coral: { DEFAULT: "#E86A5C", light: "#F0958A", dark: "#C94C3F" },
      },
      fontFamily: {
        display: ["'Baloo 2'", "cursive"],
        body: ["'Nunito'", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(27, 67, 50, 0.15)",
        card: "0 2px 12px -2px rgba(27, 67, 50, 0.1)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
