export interface Peripherals {
  printer?: {
    connection: 'BLUETOOTH' | 'NETWORK' | 'USB' | 'NONE'
    /** MAC, IP:puerto o vendorId:productId */
    address: string | null
    paperWidthMm: 58 | 80
  }
  barcodeScanner?: {
    mode: 'KEYBOARD_WEDGE' | 'BLUETOOTH' | 'CAMERA'
  }
  cardTerminal?: {
    provider: string | null
    terminalId: string | null
  }
}
