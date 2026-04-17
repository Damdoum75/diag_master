/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY?: string
  readonly VITE_BASE44_TOKEN?: string
  readonly VITE_J2534_BRIDGE_PORT?: string
  readonly VITE_USE_SIMULATOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "react-resizable-panels"
