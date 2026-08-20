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
          500: '#38BDF8', // Cyan/electric blue accent
          600: '#0ea5e9', // Darker cyan for hover
          900: '#0c4a6e', // Deep cyan
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
