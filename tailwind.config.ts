import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ref: {
          black: "#08090C",       // Deepest Black background
          dark: "#0C0E14",        // Pitch Dark Grey (sidebars, headers)
          surface: "#11141D",     // Surface Dark Grey
          card: "#151924",        // Card Dark Grey
          cardHover: "#1C2130",   // Elevated Card Grey on hover
          border: "#212638",      // Subtle Dark Grey Border
          borderLight: "#2C3349", // Elevated Border Grey
          muted: "#64748B",       // Slate Muted
          subtext: "#94A3B8",     // Slate Subtext
          
          // Giallo Fluo / Neon Yellow Palette
          neon: "#CCFF00",        // Primary Fluo Yellow (Electric Lime / Volt)
          neonHover: "#D9FF33",   // Hover Fluo Yellow
          neonDark: "#A8D400",    // Deep Fluo Yellow
          neonGlow: "rgba(204, 255, 0, 0.25)",
          
          // Football semantic accents
          yellow: "#CCFF00",      // Fluo Yellow Card
          red: "#FF334B",         // Neon Red Card
          blue: "#38BDF8",        // Bright Sky Blue
          purple: "#A855F7",      // Purple
        },
      },
      boxShadow: {
        'neon': '0 0 20px rgba(204, 255, 0, 0.35)',
        'neon-sm': '0 0 10px rgba(204, 255, 0, 0.25)',
        'neon-lg': '0 0 35px rgba(204, 255, 0, 0.45)',
        'card-dark': '0 10px 30px -10px rgba(0, 0, 0, 0.7)',
      },
    },
  },
  plugins: [],
};
export default config;
