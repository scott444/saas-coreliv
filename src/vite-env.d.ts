/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Same-origin in every environment; the dev server and nginx both proxy it. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
