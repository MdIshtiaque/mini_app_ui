import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      // Dev + tunnels (e.g. ngrok): Host header must be allowed or Vite returns "Blocked request"
      allowedHosts: true,
      // Mini App on phone/ngrok must not call 127.0.0.1 — proxy keeps fetch same-origin → Vite → FastAPI
      proxy: {
        '/api/webapp': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
