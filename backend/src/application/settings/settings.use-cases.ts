import { roundRate } from '../../domain/money'
import type { Peripherals } from '../../domain/peripherals'
import type { StoreSettings, StoreSettingsChanges } from '../../domain/models/store-settings'
import { assertHasChanges } from '../common/assert-has-changes'
import { emptyToNull } from '../common/text'
import type { StoreSettingsRepository } from '../ports/store-settings-repository'

export class SettingsUseCases {
  constructor(private readonly settings: StoreSettingsRepository) {}

  get(): Promise<StoreSettings> {
    return this.settings.get()
  }

  /** PATCH parcial. En `peripherals` se reemplaza cada dispositivo enviado; los omitidos se conservan. */
  update(changes: StoreSettingsChanges): Promise<StoreSettings> {
    assertHasChanges(changes)
    return this.settings.update((current) => ({
      ...(changes.businessName !== undefined && { businessName: changes.businessName.trim() }),
      ...(changes.legalName !== undefined && { legalName: emptyToNull(changes.legalName) }),
      ...(changes.rfc !== undefined && { rfc: emptyToNull(changes.rfc)?.toUpperCase() ?? null }),
      ...(changes.address !== undefined && { address: changes.address.trim() }),
      ...(changes.phone !== undefined && { phone: emptyToNull(changes.phone) }),
      ...(changes.logoUrl !== undefined && { logoUrl: emptyToNull(changes.logoUrl) }),
      ...(changes.defaultTaxRate !== undefined && { defaultTaxRate: roundRate(changes.defaultTaxRate) }),
      ...(changes.ticketFooter !== undefined && { ticketFooter: emptyToNull(changes.ticketFooter) }),
      ...(changes.peripherals !== undefined && {
        peripherals: { ...current.peripherals, ...normalizePeripherals(changes.peripherals) },
      }),
    }))
  }
}

function normalizePeripherals({ printer, barcodeScanner, cardTerminal }: Peripherals): Peripherals {
  return {
    ...(printer && {
      printer: { connection: printer.connection, address: emptyToNull(printer.address), paperWidthMm: printer.paperWidthMm },
    }),
    ...(barcodeScanner && { barcodeScanner: { mode: barcodeScanner.mode } }),
    ...(cardTerminal && {
      cardTerminal: { provider: emptyToNull(cardTerminal.provider), terminalId: emptyToNull(cardTerminal.terminalId) },
    }),
  }
}
