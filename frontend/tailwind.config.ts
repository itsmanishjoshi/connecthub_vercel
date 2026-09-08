import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "sm": "640px",
        "md": "768px",
        "lg": "1024px",
        "xl": "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        xs: "400px",
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Shadcn/UI compatibility
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          dark: "hsl(var(--primary-dark))",
          light: "hsl(var(--primary-light))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        // Enterprise Design System - Brand Colors
        'brand-navy': 'hsl(var(--brand-navy))',
        'brand-blue': 'hsl(var(--brand-blue))',
        'brand-blue-hover': 'hsl(var(--brand-blue-hover))',
        'brand-soft': 'hsl(var(--brand-soft))',
        'brand-light': 'hsl(var(--brand-light))',
        'brand-pale': 'hsl(var(--brand-pale))',
        
        // Enterprise Design System - Neutrals
        'gray': {
          50: 'hsl(var(--gray-50))',
          100: 'hsl(var(--gray-100))',
          200: 'hsl(var(--gray-200))',
          300: 'hsl(var(--gray-300))',
          400: 'hsl(var(--gray-400))',
          500: 'hsl(var(--gray-500))',
          600: 'hsl(var(--gray-600))',
          700: 'hsl(var(--gray-700))',
          800: 'hsl(var(--gray-800))',
          900: 'hsl(var(--gray-900))',
        },
        
        // Enterprise Design System - Accents
        'teal': 'hsl(var(--teal))',
        'teal-light': 'hsl(var(--teal-light))',
        'purple': 'hsl(var(--purple))',
        'purple-light': 'hsl(var(--purple-light))',
        'amber': 'hsl(var(--amber))',
        
        // Enterprise Design System - Semantic
        'success': 'hsl(var(--success))',
        'success-light': 'hsl(var(--success-light))',
        'error': 'hsl(var(--error))',
        'error-light': 'hsl(var(--error-light))',
        'warning': 'hsl(var(--warning))',
        'warning-light': 'hsl(var(--warning-light))',
        'info': 'hsl(var(--info))',
        'info-light': 'hsl(var(--info-light))',
        
        // Legacy status colors (for backward compatibility)
        status: {
          red: "hsl(var(--status-red))",
          yellow: "hsl(var(--status-yellow))",
          green: "hsl(var(--status-green))",
          blue: "hsl(var(--status-blue))",
          grey: "hsl(var(--status-grey))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "office-in": {
          from: { opacity: "0", transform: "translateY(18px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "scene-drift": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "window-glow": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.85" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "office-in": "office-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scene-drift": "scene-drift 4.5s ease-in-out infinite",
        "window-glow": "window-glow 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
