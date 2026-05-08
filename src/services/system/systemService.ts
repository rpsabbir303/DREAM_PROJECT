import { desktopClient } from '@/services/desktop/desktopClient'

export const systemService = {
  getSnapshot: () => desktopClient.getSystemSnapshot(),
}
