import { ChevronsUpDown, LogOut } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
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
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useSession, useSessionStore } from '@/features/auth/session-store'
import { getInitials } from '@/lib/format'
import { ADMIN_NAVIGATION, findActiveNavItem, isNavItemActive } from './admin-navigation'

/** Panel del propietario (desktop/tablet): sidebar colapsable a íconos + encabezado con el título de la sección. */
export function AdminLayout() {
  const { pathname } = useLocation()
  const title = findActiveNavItem(pathname)?.label ?? 'Panel'

  useEffect(() => {
    document.title = `${title} · Smart Abarrotes`
  }, [title])

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 justify-center border-b">
          <BrandLogo className="px-1 group-data-[collapsible=icon]:px-0 [&>div]:group-data-[collapsible=icon]:hidden" />
        </SidebarHeader>

        <SidebarContent>
          {ADMIN_NAVIGATION.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isNavItemActive(item, pathname)} tooltip={item.label}>
                        <NavLink to={item.to} end={item.end}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <OwnerMenu />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
          <h1 className="font-heading text-base font-semibold">{title}</h1>
        </header>
        <AnimatedOutlet className="flex-1 p-4 md:p-6" />
      </SidebarInset>
    </SidebarProvider>
  )
}

function OwnerMenu() {
  const user = useSession('admin')?.user
  const signOut = useSessionStore((state) => state.signOut)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  {getInitials(user?.name ?? '')}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Propietario</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => signOut('admin')}>
              <LogOut /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
