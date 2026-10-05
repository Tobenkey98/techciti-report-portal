import type { Config } from "tailwindcss";

/**
 * The TechCiti brand system lives in `app/globals.css` as CSS variables.
 * Components MUST consume these tokens (e.g. `bg-primary`, `text-muted-foreground`)
 * and never hard-code hex values.
 *
 * Each colour is declared twice in globals.css:
 *   --primary: #FF5733        <- documented source of truth
 *   --primary-rgb: 255 87 51  <- channel triplet so Tailwind can apply alpha (/10, /20…)
 */
const withAlpha = (variable: string) => `rgb(var(${variable}-rgb) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: withAlpha("--background"),
        surface: withAlpha("--surface"),
        foreground: withAlpha("--foreground"),
        border: withAlpha("--border"),
        input: withAlpha("--border"),
        ring: withAlpha("--primary"),

        primary: {
          DEFAULT: withAlpha("--primary"),
          hover: withAlpha("--primary-hover"),
          soft: withAlpha("--primary-soft"),
          foreground: withAlpha("--primary-foreground"),
        },

        muted: {
          DEFAULT: withAlpha("--background"),
          foreground: withAlpha("--muted-foreground"),
        },

        success: withAlpha("--success"),
        warning: withAlpha("--warning"),
        danger: withAlpha("--danger"),

        "success-soft": withAlpha("--success-soft"),
        "warning-soft": withAlpha("--warning-soft"),
        "danger-soft": withAlpha("--danger-soft"),
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        button: "10px",
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        "card-hover":
          "0 4px 6px -1px rgb(16 24 40 / 0.07), 0 10px 20px -6px rgb(16 24 40 / 0.10)",
        popover: "0 12px 32px -8px rgb(16 24 40 / 0.16), 0 4px 10px -4px rgb(16 24 40 / 0.08)",
        header: "0 4px 18px -6px rgb(31 41 55 / 0.10)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.18s ease-out",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;