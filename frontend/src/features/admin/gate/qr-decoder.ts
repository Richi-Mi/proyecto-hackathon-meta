import jsQR from 'jsqr'

/** Lado mayor del cuadro que se analiza: suficiente para un QR mostrado en otro teléfono, ligero para el CPU */
const MAX_SIDE = 720

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
interface BarcodeDetectorClass {
  new (options: { formats: string[] }): NativeBarcodeDetector
  getSupportedFormats(): Promise<string[]>
}

/** `BarcodeDetector` nativo (Chrome en Android) si sabe leer QR; si no (Safari, Firefox), `null` y se usa jsQR. */
async function nativeDetector(): Promise<NativeBarcodeDetector | null> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector
  if (!Detector) return null
  try {
    return (await Detector.getSupportedFormats()).includes('qr_code') ? new Detector({ formats: ['qr_code'] }) : null
  } catch {
    return null
  }
}

/** Lee el QR que haya en el cuadro actual del `<video>`; `null` si no hay ninguno legible. */
export async function createQrDecoder() {
  const native = await nativeDetector()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })!

  return async function decode(video: HTMLVideoElement): Promise<string | null> {
    if (video.readyState < 2 || !video.videoWidth) return null
    if (native) {
      try {
        const [code] = await native.detect(video)
        return code?.rawValue || null
      } catch {
        // Algunos navegadores fallan con ciertos cuadros: se intenta con jsQR
      }
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
    // La pantalla de un teléfono muestra el QR oscuro sobre claro: no hace falta probar la versión invertida
    return jsQR(data, width, height, { inversionAttempts: 'dontInvert' })?.data || null
  }
}
