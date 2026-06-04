/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wh: {
          navy: "#0f2742",
          blue: "#1d4ed8",
        },
      },
    },
  },
  plugins: [],
};
