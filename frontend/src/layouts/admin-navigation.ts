import { LayoutDashboard, Package, ReceiptText, ScanBarcode, Settings, type LucideIcon } from 'lucide-react'
import { matchPath } from 'react-router'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Coincidencia exacta (para la raíz /admin) */
  end?: boolean
}

export const ADMIN_NAVIGATION: { label: string; items: AdminNavItem[] }[] = [
  {
    label: 'Operación',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/pos', label: 'Caja (POS)', icon: ScanBarcode },
      { to: '/admin/sales', label: 'Historial de ventas', icon: ReceiptText },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/admin/inventory', label: 'Inventario', icon: Package },
      { to: '/admin/settings', label: 'Configuración', icon: Settings },
    ],
  },
]

export const isNavItemActive = (item: AdminNavItem, pathname: string) =>
  matchPath({ path: item.to, end: item.end ?? false }, pathname) !== null

export const findActiveNavItem = (pathname: string) =>
  ADMIN_NAVIGATION.flatMap((group) => group.items).find((item) => isNavItemActive(item, pathname))
