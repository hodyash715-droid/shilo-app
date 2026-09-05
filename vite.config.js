import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset paths relative so the build works on GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
  // בונים אל docs/ כדי לשרת דרך GitHub Pages (Source: main /docs) בלי CI
  build: { outDir: 'docs', emptyOutDir: true },
})
