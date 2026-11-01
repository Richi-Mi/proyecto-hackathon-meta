import type { StoreSettings, StoreSettingsChanges } from '../../domain/models/store-settings'

export interface StoreSettingsRepository {
  /** Si la tienda aún no se configuró, devuelve `DEFAULT_STORE_SETTINGS`. */
  get(): Promise<StoreSettings>
  /**
   * Bloquea la configuración, calcula los cambios a partir del valor vigente y los guarda
   * (crea la fila si no existía). Devuelve la configuración resultante.
   */
  update(change: (current: StoreSettings) => StoreSettingsChanges): Promise<StoreSettings>
}
