import { create } from 'zustand'
import type { StoreSettings, StoreSettingsUpdate } from '@/lib/api/types'
import { fetchSettings, updateSettings } from '../api'

/** IVA para altas de producto mientras la configuración no ha cargado (mismo valor que el servidor sin configurar). */
export const FALLBACK_TAX_RATE = 0.16

interface SettingsState {
  settings?: StoreSettings
  error?: unknown
  /** Carga (o recarga) la configuración; los errores quedan en `error`. */
  load: () => Promise<void>
  save: (changes: StoreSettingsUpdate) => Promise<StoreSettings>
}

/** Configuración del negocio compartida por el panel: pantalla de Configuración, alta de productos y ancho del ticket. */
export const useSettingsStore = create<SettingsState>()((set) => ({
  load: async () => {
    try {
      const settings = await fetchSettings()
      set({ settings, error: undefined })
      applyTicketWidth(settings)
    } catch (error) {
      set({ error })
    }
  },
  save: async (changes) => {
    const settings = await updateSettings(changes)
    set({ settings, error: undefined })
    applyTicketWidth(settings)
    return settings
  },
}))

/** El ticket impreso con window.print() usa el ancho de papel configurado (ver @media print en index.css). */
function applyTicketWidth(settings: StoreSettings) {
  document.documentElement.style.setProperty('--ticket-width', `${settings.peripherals.printer?.paperWidthMm ?? 80}mm`)
}
