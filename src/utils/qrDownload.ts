import { downloadCanvasAsPng } from '@/utils/qr'

export function downloadQrPng(canvasId: string, filename: string): void {
  downloadCanvasAsPng(canvasId, filename)
}
