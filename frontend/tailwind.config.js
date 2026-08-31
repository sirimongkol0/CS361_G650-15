/** @type {import('tailwindcss').Config} */
// Theme ported from legacy/figma-mock/src/index.css — Thammasat University color system
// Primary: Crimson Red #8B1538 · Accent: Gold #C8961E · Base: White + Gray
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // semantic base (mapped to mock tokens)
        ink: '#111827', // --foreground
        mute: '#4B5563', // secondary-foreground-ish
        faint: '#6B7280', // --muted-foreground
        line: '#E5E7EB', // --border
        paper: '#F7F8FA', // --background
        soft: '#F3F4F6', // --muted
        // TU Crimson (primary)
        crimson: {
          DEFAULT: '#8B1538',
          hover: '#6F1030',
          light: '#FDF2F5',
          muted: '#F5D6DE',
        },
        // TU Gold (accent)
        gold: {
          DEFAULT: '#C8961E',
          hover: '#A87A18',
          light: '#FEF6E4',
          muted: '#F5E0A8',
          dark: '#92670A',
        },
      },
      fontFamily: {
        sans: [
          'Sarabun',
          'Plus Jakarta Sans',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Plus Jakarta Sans',
          'Sarabun',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        // --radius: 10px (md = base, lg = +4)
        base: '10px',
        lg: '14px',
        md: '10px',
      },
      boxShadow: {
        // .stat-card / .content-card from the mock
        card: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px #E5E7EB',
        'card-hover': '0 4px 14px rgba(0,0,0,0.09), 0 0 0 1px #E5E7EB',
        lightring: '0 0 0 1px #E5E7EB',
        ring: '0 0 0 1px #E5E7EB, 0 1px 3px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
