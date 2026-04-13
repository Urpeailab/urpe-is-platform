/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        // Navy Premium Palette
                        navy: {
                                DEFAULT: '#0F172A',
                                primary: '#0F172A',
                                secondary: '#1E293B',
                                light: '#334155',
                        },
                        slate: {
                                DEFAULT: '#475569',
                                light: '#64748B',
                                dark: '#334155',
                        },
                        gold: {
                                DEFAULT: '#E6D5B7',
                                primary: '#E6D5B7',
                                dark: '#C9A96A',
                                subtle: '#F1E8D8',
                                muted: '#D4C4A8',
                        },
                        // Functional colors
                        success: {
                                DEFAULT: '#16A34A',
                                light: '#22C55E',
                                dark: '#15803D',
                        },
                        warning: {
                                DEFAULT: '#D97706',
                                light: '#F59E0B',
                                dark: '#B45309',
                        },
                        error: {
                                DEFAULT: '#B91C1C',
                                light: '#DC2626',
                                dark: '#991B1B',
                        },
                        // Shadcn UI compatibility
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        }
                },
                fontFamily: {
                        'display': ['Fraunces', 'Georgia', 'serif'],
                        'sans': ['Inter', 'system-ui', 'sans-serif'],
                },
                keyframes: {
                        'accordion-down': {
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        },
                        'fade-in': {
                                '0%': { opacity: '0', transform: 'translateY(10px)' },
                                '100%': { opacity: '1', transform: 'translateY(0)' }
                        },
                        'slide-up': {
                                '0%': { transform: 'translateY(20px)', opacity: '0' },
                                '100%': { transform: 'translateY(0)', opacity: '1' }
                        },
                        'shimmer': {
                                '0%': { backgroundPosition: '-200% 0' },
                                '100%': { backgroundPosition: '200% 0' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'fade-in': 'fade-in 0.5s ease-out forwards',
                        'slide-up': 'slide-up 0.5s ease-out',
                        'shimmer': 'shimmer 2s infinite linear'
                },
                boxShadow: {
                        'premium': '0 4px 20px rgba(15, 23, 42, 0.25)',
                        'premium-lg': '0 10px 40px rgba(15, 23, 42, 0.3)',
                        'gold': '0 4px 20px rgba(201, 169, 106, 0.15)',
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
