import type { JarvisDesktopApi } from '@shared/types'

declare global {
  interface Window {
    /** Primary preload bridge — prefer this over `electron` to avoid global name clashes. */
    jarvis?: JarvisDesktopApi
    /** Same API as `jarvis` (legacy alias). */
    electron?: JarvisDesktopApi
  }
}

export {}
