/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primaryRed: '#A12828',
        primaryRedHover: '#C82D2D',
        softBackground: '#F9EDED',
        beigePanel: '#FFF3E1',
        cardBg: '#FFFFFF',
        primaryText: '#2D2D2D',
        secondaryText: '#6A6A6A',
        successGreen: '#25D366',
        borderGray: '#E5E5E5',
      },
      fontFamily: {
        sans: ['"Poppins"', '"Inter"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 20px 45px rgba(161, 40, 40, 0.12)',
      },
    },
  },
  plugins: [],
};


