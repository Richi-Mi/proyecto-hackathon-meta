import { LogOut, QrCode, ReceiptText } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router'
import { AnimatedOutlet } from '@/components/AnimatedOutlet'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession, useSessionStore } from '@/features/auth/session-store'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app', label: 'Mi pase', icon: QrCode, end: true },
  { to: '/app/purchases', label: 'Compras', icon: ReceiptText, end: false },
]

/** PWA del cliente: mobile-first, con barra inferior al alcance del pulgar. En desktop se centra como un teléfono. */
export function CustomerLayout() {
  const user = useSession('customer')?.user
  const signOut = useSessionStore((state) => state.signOut)

  return (
    <div className="min-h-dvh bg-muted/50">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background sm:border-x">
        <header className="sticky top-0 z-20 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4">
            <BrandLogo />
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">{getInitials(user?.name ?? '')}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="grid">
                  <span className="truncate">{user?.name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => signOut('customer')}>
                  <LogOut /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <AnimatedOutlet className="flex-1 px-4 py-5" />

        <nav
          aria-label="Navegación principal"
          className="sticky bottom-0 z-20 grid grid-cols-2 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        >
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="customer-tab-indicator"
                      className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-primary"
                    />
                  )}
                  <Icon className="size-5" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
