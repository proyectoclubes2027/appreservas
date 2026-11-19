/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC', // Fondo blanco limpio / gris muy claro
        primary: '#DC2626',    // Rojo oficial CARP
        surface: '#FFFFFF',    // Tarjetas y modales blancos
        border: '#E2E8F0',     // Bordes claros y elegantes
        textPri: '#0F172A',    // Texto principal oscuro legible
        textSec: '#64748B',    // Texto secundario gris slate
        available: '#10b981',
        occupied: '#f59e0b',
        blocked: '#ef4444'
      }
    },
  },
  plugins: [],
}
