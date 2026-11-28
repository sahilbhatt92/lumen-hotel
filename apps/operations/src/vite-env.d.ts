/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACTIONS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
