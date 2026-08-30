/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#171717',
        mute: '#4d4d4d',
        faint: '#666666',
        line: '#ebebeb',
        paper: '#fafafa',
      },
      fontFamily: {
        sans: [
          'Geist',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'Geist Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        ring: 'rgba(0,0,0,0.08) 0px 0px 0px 1px',
        lightring: 'rgb(235,235,235) 0px 0px 0px 1px',
        card:
          'rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, rgba(0,0,0,0.04) 0px 8px 8px -8px, #fafafa 0px 0px 0px 1px',
        'card-hover':
          'rgba(0,0,0,0.12) 0px 0px 0px 1px, rgba(0,0,0,0.05) 0px 4px 4px, rgba(0,0,0,0.06) 0px 12px 16px -8px, #fafafa 0px 0px 0px 1px',
      },
    },
  },
  plugins: [],
}
