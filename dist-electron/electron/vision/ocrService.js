import { createWorker } from 'tesseract.js';
let workerPromise = null;
async function getWorker() {
    if (!workerPromise) {
        workerPromise = createWorker('eng');
    }
    return workerPromise;
}
export async function extractTextFromImageBase64(imageBase64) {
    const worker = await getWorker();
    const { data } = await worker.recognize(Buffer.from(imageBase64, 'base64'));
    return {
        text: data.text.trim(),
        confidence: Number((data.confidence / 100).toFixed(3)),
        createdAt: new Date().toISOString(),
    };
}
