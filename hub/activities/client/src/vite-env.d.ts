/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACTIVITY_CLIENT_ID?: string;
  readonly VITE_DISCORD_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
