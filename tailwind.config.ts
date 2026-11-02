import type { Config } from "tailwindcss";

// Colours and type come from the Kasi Kapital design files (login screen and dashboards).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0B3B24", // primary green: buttons, header, links
          dark: "#0A2A1A", // hover
          deep: "#0E2920", // the dark panel behind the logo on the login screen
          light: "#E6EFE9", // soft green tint for selected items
          cream: "#FDFBF7", // page background
          paper: "#F9F8F3", // the form card on the login screen
          border: "#EAE6DB",
          gold: "#D4AF37", // top trust tier
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        cursive: ['"Dancing Script Variable"', "cursive"],
      },
    },
  },
  plugins: [],
};

export default config;
