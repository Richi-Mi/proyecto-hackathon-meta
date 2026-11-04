import { useEffect, useRef, useState } from 'react'

export type CameraState = 'off' | 'starting' | 'on'
export type Facing = 'environment' | 'user'

/**
 * Cámara del navegador (getUserMedia) para la puerta y la caja.
 * Requiere https:// o localhost; en iOS el <video> necesita `playsInline` y `muted`.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<CameraState>('off')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  async function start(facing: Facing = 'environment') {
    stop()
    setError(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('La cámara solo funciona con https:// (la app en Railway) o en localhost')
      return false
    }
    setState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setState('on')
      return true
    } catch (cause) {
      stop()
      const denied = cause instanceof DOMException && cause.name === 'NotAllowedError'
      setError(denied ? 'Permiso de cámara denegado: actívalo en la configuración del navegador' : 'No se pudo abrir la cámara')
      return false
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setState('off')
  }

  function draw(maxWidth: number): HTMLCanvasElement | null {
    const video = videoRef.current
    if (!video || video.readyState < 2 || !video.videoWidth) return null
    const canvas = (canvasRef.current ??= document.createElement('canvas'))
    const scale = Math.min(1, maxWidth / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  /** Foto JPEG como data URL (lo que acepta la API) */
  function capture(maxWidth = 1024, quality = 0.85): string | null {
    return draw(maxWidth)?.toDataURL('image/jpeg', quality) ?? null
  }

  /** Píxeles del cuadro actual (para leer códigos QR) */
  function pixels(maxWidth = 640): ImageData | null {
    const canvas = draw(maxWidth)
    return canvas ? canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height) : null
  }

  return { videoRef, state, error, start, stop, capture, pixels }
}
