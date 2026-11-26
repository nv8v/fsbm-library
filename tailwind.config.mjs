/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#17151d', muted: '#777381', accent: '#7656c9', line: '#e9e6ef', paper: '#fbfaff' },
      fontFamily: { sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'], heading: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 8px 30px rgba(30, 20, 55, 0.045)' }
    }
  },
  plugins: []
};
