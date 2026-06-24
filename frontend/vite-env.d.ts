/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_SIGNUPS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
