import { createHmac, timingSafeEqual } from 'node:crypto'
import type { DeviceKeyVerifier, WebhookSignatureVerifier } from '../../application/ports/store-device-auth'

/** Comparación en tiempo constante (sin filtrar por tiempos cuánto coincide). */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Llaves estáticas configuradas en `STORE_DEVICE_KEYS`. */
export class StaticDeviceKeyVerifier implements DeviceKeyVerifier {
  constructor(private readonly keys: string[]) {}

  isValid(deviceKey: string | undefined): boolean {
    if (!deviceKey) return false
    // Se comparan todas para no revelar por tiempos cuál coincidió
    return this.keys.reduce((found, key) => safeEqual(key, deviceKey) || found, false)
  }
}

/** `X-Signature: sha256=<hex(HMAC_SHA256(secret, rawBody))>` */
export class HmacWebhookSignatureVerifier implements WebhookSignatureVerifier {
  constructor(private readonly secret: string) {}

  sign(rawBody: string): string {
    return `sha256=${createHmac('sha256', this.secret).update(rawBody).digest('hex')}`
  }

  isValid(rawBody: string, signature: string | undefined): boolean {
    return !!signature && safeEqual(this.sign(rawBody), signature.trim().toLowerCase())
  }
}
