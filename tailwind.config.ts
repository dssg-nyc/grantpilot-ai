import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DSSG NYC brand tokens (https://www.nyc-dssg.org) — mirrors the
        // blue-*/indigo-* overrides in app/globals.css.
        brand: {
          50: "#eef4fb",
          100: "#dce8f6",
          500: "#2569b8",
          600: "#0056b3",
          700: "#00478f",
          900: "#002d72",
        },
      },
    },
  },
};

export default config;
