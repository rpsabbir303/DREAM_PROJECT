import type { JarvisDesktopApi } from '@shared/types'

declare global {
  interface Window {
    jarvis?: JarvisDesktopApi
  }
}

export {}
