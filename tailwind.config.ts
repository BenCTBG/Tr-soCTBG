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
        ctbg: {
          red: '#C00000',
          'red-light': '#FEF2F2',
          'red-hover': '#A00000',
          'red-dark': '#1a1a2e',
          accent: '#f6301b', // logo red
        },
        sidebar: '#FAFBFC',
        gray: {
          dark: '#1a1a2e',
          medium: '#404040',
          light: '#F5F6FA',
          border: '#E2E8F0',
          text: '#64748B',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      width: {
        sidebar: '260px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)',
        'card-lg': '0 4px 20px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
export default config;
