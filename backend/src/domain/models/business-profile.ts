/** Datos del negocio que se imprimen en el ticket (tabla store_settings). */
export interface BusinessProfile {
  name: string
  legalName: string | null
  rfc: string | null
  address: string
  phone: string | null
  logoUrl: string | null
  footer: string | null
}
