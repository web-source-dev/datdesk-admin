/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          500: '#0b6bcb',
          600: '#0a5fb4',
          700: '#084f96',
          900: '#0a2f57'
        }
      }
    }
  },
  plugins: []
};
