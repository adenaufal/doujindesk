/** @type {import('tailwindcss').Config} */

// Colours are written as `hsl(var(--token) / <alpha-value>)`, the canonical
// shadcn-for-Tailwind-v3 form. v3.4 also infers the alpha channel from a bare
// `hsl(var(--token))`, so this is not a bug fix — it is the documented contract
// made explicit so it survives a Tailwind upgrade.
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // The --shadow-* tokens in src/index.css were previously only reachable
      // through a dead Tailwind v4 `@theme inline` block. Wiring them here is
      // what makes `shadow-xs` (used by button/input/select) a real utility.
      boxShadow: {
        "2xs": "var(--shadow-2xs)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
      },
      colors: {
        background: c("background"),
        foreground: c("foreground"),
        card: {
          DEFAULT: c("card"),
          foreground: c("card-foreground"),
        },
        popover: {
          DEFAULT: c("popover"),
          foreground: c("popover-foreground"),
        },
        primary: {
          DEFAULT: c("primary"),
          foreground: c("primary-foreground"),
        },
        secondary: {
          DEFAULT: c("secondary"),
          foreground: c("secondary-foreground"),
        },
        muted: {
          DEFAULT: c("muted"),
          foreground: c("muted-foreground"),
        },
        accent: {
          DEFAULT: c("accent"),
          foreground: c("accent-foreground"),
        },
        destructive: {
          DEFAULT: c("destructive"),
          foreground: c("destructive-foreground"),
          subtle: c("destructive-subtle"),
        },
        success: {
          DEFAULT: c("success"),
          foreground: c("success-foreground"),
          subtle: c("success-subtle"),
        },
        warning: {
          DEFAULT: c("warning"),
          foreground: c("warning-foreground"),
          subtle: c("warning-subtle"),
        },
        info: {
          DEFAULT: c("info"),
          foreground: c("info-foreground"),
          subtle: c("info-subtle"),
        },
        border: c("border"),
        input: c("input"),
        ring: c("ring"),
        chart: {
          1: c("chart-1"),
          2: c("chart-2"),
          3: c("chart-3"),
          4: c("chart-4"),
          5: c("chart-5"),
        },
        sidebar: {
          DEFAULT: c("sidebar"),
          foreground: c("sidebar-foreground"),
          primary: c("sidebar-primary"),
          "primary-foreground": c("sidebar-primary-foreground"),
          accent: c("sidebar-accent"),
          "accent-foreground": c("sidebar-accent-foreground"),
          border: c("sidebar-border"),
          ring: c("sidebar-ring"),
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // `coarse:` = touch input. Criterion 6 wants 44px tap targets on phones
    // without inflating desktop density, and Tailwind v3 has no built-in
    // pointer variant (v4 does, as `pointer-coarse:`).
    require("tailwindcss/plugin")(({ addVariant }) => {
      addVariant("coarse", "@media (pointer: coarse)");
    }),
  ],
};
