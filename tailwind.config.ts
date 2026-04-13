import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./remotion/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        panel: "#09090d",
        ink: "#f6ecff",
        haze: "#a78bc4",
        neon: "#b026ff",
        neonSoft: "#7b2dff",
        edge: "rgba(255,255,255,0.08)"
      },
      fontFamily: {
        display: ["var(--font-syncopate)"],
        body: ["var(--font-manrope)"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(176,38,255,0.25), 0 0 32px rgba(176,38,255,0.22)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
      },
      keyframes: {
        pulseLine: {
          "0%, 100%": { opacity: "0.35", transform: "scaleX(0.96)" },
          "50%": { opacity: "1", transform: "scaleX(1)" }
        },
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        pulseLine: "pulseLine 2.2s ease-in-out infinite",
        floatIn: "floatIn 0.7s ease forwards"
      }
    }
  },
  plugins: []
};

export default config;
