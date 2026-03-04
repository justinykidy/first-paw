/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        boardLight: '#e6d3b1',
        boardDark: '#8c5d3d',
      },
    },
  },
  plugins: [],
};
