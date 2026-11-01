/** Autentica al escáner de entrada (`X-Device-Key`). */
export interface DeviceKeyVerifier {
  isValid(deviceKey: string | undefined): boolean
}

/** Verifica la firma del webhook del sistema de cámaras sobre el cuerpo crudo (`X-Signature`). */
export interface WebhookSignatureVerifier {
  isValid(rawBody: string, signature: string | undefined): boolean
}
