/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          500: 'hsl(220, 38%, 55%)',
          600: 'hsl(220, 38%, 45%)',
        },
      },
    },
  },
  plugins: [],
};
