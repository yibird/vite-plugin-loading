/// <reference types="vite/client" />
/// <reference types="vite-plugin-loading/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}
