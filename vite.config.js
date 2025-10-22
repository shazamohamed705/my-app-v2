import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Make environment variables available in browser
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.VERCEL': JSON.stringify(process.env.VERCEL || '0'),
    // Ensure Vercel environment variable is available
    'import.meta.env.VERCEL': JSON.stringify(process.env.VERCEL || '0'),
  },
  build: {
    // تحسينات الأداء للبناء
    minify: 'terser',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdf: ['html2pdf.js', 'jspdf', 'html2canvas'],
          router: ['react-router-dom']
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
