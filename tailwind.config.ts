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
          'red-light': '#F2DCDB',
          'red-hover': '#A00000',
          'red-dark': '#8B0000',
        },
        gray: {
          dark: '#404040',
          light: '#F2F2F2',
          border: '#E5E5E5',
          text: '#666666',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      width: {
        sidebar: '240px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'card-lg': '0 4px 12px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
export default config;
