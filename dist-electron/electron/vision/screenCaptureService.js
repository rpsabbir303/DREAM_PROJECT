import screenshot from 'screenshot-desktop';
import { randomUUID } from 'node:crypto';
function parsePngSize(buffer) {
    if (buffer.length < 24)
        return { width: 0, height: 0 };
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
}
export async function captureScreen(source = 'full_screen') {
    const imageBuffer = await screenshot({ format: 'png' });
    const { width, height } = parsePngSize(imageBuffer);
    return {
        id: randomUUID(),
        imageBase64: imageBuffer.toString('base64'),
        width,
        height,
        createdAt: new Date().toISOString(),
        source,
    };
}
