/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0d0d',
        primary: '#DC2626',
        surface: '#161616',
        border: '#2a2a2a',
        textPri: '#eeeeee',
        textSec: '#888888',
        available: '#10b981',
        occupied: '#f59e0b',
        blocked: '#ef4444'
      }
    },
  },
  plugins: [],
}
