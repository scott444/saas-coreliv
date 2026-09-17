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
      // Two projects, because they need different worlds: the SPA runs in
      // jsdom against fake services, the API runs in node against a real
      // Postgres. `npm test` runs both; the API project skips itself when
      // no database is reachable.
      projects: [
        {
          extends: true,
          test: {
            name: 'web',
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test/setup.ts'],
            include: ['src/**/*.test.{ts,tsx}'],
            css: false,
          },
        },
        {
          test: {
            name: 'api',
            environment: 'node',
            globals: true,
            include: ['server/src/**/*.test.ts'],
            setupFiles: ['./server/src/test/setup.ts'],
            globalSetup: ['./server/src/test/globalSetup.ts'],
            // One database, shared, so the files must not run concurrently -
            // two of them truncating and re-seeding at once fails on a
            // duplicate key that looks nothing like the real cause.
            //
            // singleFork rather than `fileParallelism: false`: that option is
            // only honoured at the root of the config, so inside a project it
            // is silently ignored.
            pool: 'forks',
            poolOptions: { forks: { singleFork: true } },
            hookTimeout: 60_000,
            testTimeout: 30_000,
          },
        },
      ],
    },
  }
})
