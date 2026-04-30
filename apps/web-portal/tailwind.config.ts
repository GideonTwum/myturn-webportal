import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          green: "#16a34a",
          "green-dark": "#15803d",
          "green-soft": "#dcfce7",
          gold: "#d4af37",
          "gold-dark": "#b8941f",
          "gold-soft": "#fef9e7",
        },
        /** Flat keys so `bg-surface` / `bg-surface-muted` resolve in `@apply` + JIT */
        surface: "#ffffff",
        "surface-muted": "#f9fafb",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-md":
          "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;
