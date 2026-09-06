import { defineConfig } from 'vite'

// Static single-page site. Vercel auto-detects this Vite config and serves dist/.
export default defineConfig({
  server: { port: 5174, strictPort: true },
  build: { outDir: 'dist' }
})
