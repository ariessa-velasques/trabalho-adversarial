import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// O build é servido por `views/app.py` (entrypoint `uv run trabalho-2`).
// `base: './'` mantém os assets relativos, então o app funciona em qualquer porta ou subpasta.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
