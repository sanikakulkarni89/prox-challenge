import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vulcan: {
          orange: "#f97316",
          bg: "#0a0a0a",
          surface: "#141414",
          card: "#1a1a1a",
          border: "#2a2a2a",
          text: "#e5e5e5",
          muted: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;
