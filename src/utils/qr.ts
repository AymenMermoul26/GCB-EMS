export function downloadCanvasAsPng(
  canvasId: string,
  filename: string,
): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('QR canvas is not available yet.')
  }

  const pngUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = pngUrl
  link.download = filename
  link.click()
}
