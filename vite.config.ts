import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // loadEnv rather than process.env so a VITE_PROXY_TARGET in .env is picked
  // up; Vite only exposes .env to the client bundle, not to this file.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    build: {
      // Not the default "assets": the app owns /assets/:assetId, and nginx
      // serves the build output from a prefix with try_files $uri =404. The
      // two collided, and every asset page 404ed on a refresh.
      assetsDir: 'static',
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      // The SPA calls /api on its own origin in every environment. In dev
      // that is this proxy; in the container it is nginx. Nothing in the app
      // has to know which.
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      // Bind-mounted source in a container gets no inotify events on
      // Windows/macOS hosts, so the dev container asks the watcher to poll.
      watch:
        process.env.VITE_USE_POLLING === 'true'
          ? { usePolling: true, interval: 300 }
          : undefined,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
