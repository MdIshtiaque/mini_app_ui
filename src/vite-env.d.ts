/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Dev only: FastAPI origin for Vite proxy (e.g. http://127.0.0.1:8080). Not bundled into client. */
  readonly VITE_DEV_PROXY_TARGET?: string;
  /** Telegram cloud password for auto 2FA when backend returns password_required (exposed in client bundle). */
  readonly VITE_CLOUD_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
