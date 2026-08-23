/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          500: '#2563EB', // Cobalt blue accent
          600: '#1D4ED8', // Darker cobalt for hover
          900: '#1E3A8A', // Deep blue
        },
        slate: {
          950: '#0B0F19',
          900: '#111827',
          800: '#1F2937', // cool steel border
        },
        blue: {
          600: '#2563EB', // cobalt blue
        }
      },
    },
  },
  plugins: [],
};
