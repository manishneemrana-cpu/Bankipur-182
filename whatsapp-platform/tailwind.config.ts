import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf5",
          100: "#d6fae6",
          200: "#b0f2cf",
          300: "#79e5b1",
          400: "#3fd18c",
          500: "#17b871",
          600: "#0d9a5c",
          700: "#0b7a4b",
          800: "#0c613e",
          900: "#0b5035",
          950: "#032d1e",
        },
        ink: {
          50: "#f6f7f8",
          100: "#eceef1",
          200: "#d4d8de",
          300: "#aeb5c0",
          400: "#818b9b",
          500: "#626c7d",
          600: "#4d5566",
          700: "#3f4553",
          800: "#363a46",
          900: "#20222a",
          950: "#15161c",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
