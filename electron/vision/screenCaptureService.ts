import screenshot from 'screenshot-desktop'
import { randomUUID } from 'node:crypto'
import type { ScreenCaptureRecord } from '../../shared/interfaces/ipc.js'

function parsePngSize(buffer: Buffer) {
  if (buffer.length < 24) return { width: 0, height: 0 }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

export async function captureScreen(
  source: ScreenCaptureRecord['source'] = 'full_screen',
): Promise<ScreenCaptureRecord> {
  const imageBuffer = await screenshot({ format: 'png' })
  const { width, height } = parsePngSize(imageBuffer)
  return {
    id: randomUUID(),
    imageBase64: imageBuffer.toString('base64'),
    width,
    height,
    createdAt: new Date().toISOString(),
    source,
  }
}
