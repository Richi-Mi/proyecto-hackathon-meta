import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { GuestOnly, RequireSession } from '@/features/auth/components/route-guards'
import { AuthLayout } from '@/layouts/AuthLayout'
import { FullPageLoader, NotFoundPage, RouteError } from './system-pages'

/** Carga diferida por ruta: la PWA del cliente no descarga el código del panel (sidebar, gráficas, POS). */
const lazyPage =
  <M,>(load: () => Promise<M>, pick: (module: M) => ComponentType) =>
  async () => ({ Component: pick(await load()) })

export const router = createBrowserRouter([
  {
    path: '/',
    HydrateFallback: FullPageLoader,
    errorElement: <RouteError />,
    children: [
      // Landing pública de ShelfSight (carga sus propias fuentes); la PWA instalada abre directo en /app (start_url del manifest)
      { index: true, lazy: lazyPage(() => import('@/features/shelfsight/ShelfSightPage'), (m) => m.ShelfSightPage) },
      // Dirección anterior de la landing (enlaces ya compartidos)
      { path: 'shelfsight', element: <Navigate to="/" replace /> },

      // ── Portal del cliente (PWA, mobile-first) ─────────────────────────────
      {
        path: 'app',
        children: [
          {
            element: <GuestOnly portal="customer" />,
            children: [
              {
                element: <AuthLayout variant="customer" />,
                children: [
                  {
                    path: 'login',
                    lazy: lazyPage(() => import('@/features/auth/pages/CustomerLoginPage'), (m) => m.CustomerLoginPage),
                  },
                  {
                    path: 'register',
                    lazy: lazyPage(
                      () => import('@/features/auth/pages/CustomerRegisterPage'),
                      (m) => m.CustomerRegisterPage,
                    ),
                  },
                ],
              },
            ],
          },
          {
            element: <RequireSession portal="customer" />,
            children: [
              {
                lazy: lazyPage(() => import('@/layouts/CustomerLayout'), (m) => m.CustomerLayout),
                children: [
                  {
                    index: true,
                    lazy: lazyPage(() => import('@/features/customer/pages/EntryPassPage'), (m) => m.EntryPassPage),
                  },
                  {
                    path: 'purchases',
                    lazy: lazyPage(() => import('@/features/customer/pages/PurchasesPage'), (m) => m.PurchasesPage),
                  },
                ],
              },
            ],
          },
        ],
      },

      // ── Panel del propietario (desktop/tablet) ─────────────────────────────
      {
        path: 'admin',
        children: [
          {
            element: <GuestOnly portal="admin" />,
            children: [
              {
                element: <AuthLayout variant="admin" />,
                children: [
                  {
                    path: 'login',
                    lazy: lazyPage(() => import('@/features/auth/pages/AdminLoginPage'), (m) => m.AdminLoginPage),
                  },
                ],
              },
            ],
          },
          {
            element: <RequireSession portal="admin" />,
            children: [
              {
                lazy: lazyPage(() => import('@/layouts/AdminLayout'), (m) => m.AdminLayout),
                children: [
                  {
                    index: true,
                    lazy: lazyPage(() => import('@/features/admin/pages/DashboardPage'), (m) => m.DashboardPage),
                  },
                  { path: 'pos', lazy: lazyPage(() => import('@/features/admin/pages/PosPage'), (m) => m.PosPage) },
                  {
                    path: 'inventory',
                    lazy: lazyPage(() => import('@/features/admin/pages/InventoryPage'), (m) => m.InventoryPage),
                  },
                  { path: 'sales', lazy: lazyPage(() => import('@/features/admin/pages/SalesPage'), (m) => m.SalesPage) },
                  {
                    path: 'shelf',
                    lazy: lazyPage(() => import('@/features/admin/pages/ShelfEventsPage'), (m) => m.ShelfEventsPage),
                  },
                  { path: 'camera', lazy: lazyPage(() => import('@/features/admin/pages/CameraPage'), (m) => m.CameraPage) },
                  { path: 'settings', lazy: lazyPage(() => import('@/features/admin/pages/SettingsPage'), (m) => m.SettingsPage) },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
