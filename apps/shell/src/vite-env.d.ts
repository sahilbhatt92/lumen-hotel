/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SEARCH_URL?: string;
  readonly VITE_ACTIONS_URL?: string;
  readonly VITE_DOCS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
