/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#FF6B00', // Vibrant Orange
          600: '#E65D00',
        },
        corporate: {
          900: '#1A1C23', // Deep blue-gray for hero/backgrounds
          800: '#252830',
        }
      },
    },
  },
  plugins: [],
};