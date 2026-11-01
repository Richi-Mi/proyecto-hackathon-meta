import type { Peripherals } from '../peripherals'
import type { BusinessProfile } from './business-profile'

/** Configuración general del negocio (tabla de una sola fila `store_settings`). */
export interface StoreSettings {
  businessName: string
  legalName: string | null
  rfc: string | null
  address: string
  phone: string | null
  logoUrl: string | null
  currency: string
  /** IVA que reciben los productos dados de alta sin tasa */
  defaultTaxRate: number
  ticketFooter: string | null
  peripherals: Peripherals
  /** `null` si la tienda aún no se configuró */
  updatedAt: Date | null
}

export type StoreSettingsChanges = Partial<Omit<StoreSettings, 'currency' | 'updatedAt'>>

/** Valores mientras no exista la fila de configuración (el seed la crea con estos mismos datos). */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  businessName: 'Smart Abarrotes',
  legalName: null,
  rfc: null,
  address: 'Dirección por configurar',
  phone: null,
  logoUrl: null,
  currency: 'MXN',
  defaultTaxRate: 0.16,
  ticketFooter: null,
  peripherals: {},
  updatedAt: null,
}

/** Datos que se imprimen en el ticket. */
export const toBusinessProfile = (settings: StoreSettings): BusinessProfile => ({
  name: settings.businessName,
  legalName: settings.legalName,
  rfc: settings.rfc,
  address: settings.address,
  phone: settings.phone,
  logoUrl: settings.logoUrl,
  footer: settings.ticketFooter,
})
