import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f766e", dark: "#115e59", light: "#ccfbf1" },
        accent: "#f59e0b",
      },
    },
  },
  plugins: [],
};

export default config;
