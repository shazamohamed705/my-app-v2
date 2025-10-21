import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // تحسينات الأداء للبناء
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdf: ['html2pdf.js', 'jspdf', 'html2canvas']
        }
      }
    }
  },
  server: {
    proxy: {
      // Proxy external storage domain during dev to bypass CORS in html2canvas
      '/__mbus__': {
        target: 'https://my-bus.storage-te.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__mbus__/, ''),
      },
    },
  },
})
