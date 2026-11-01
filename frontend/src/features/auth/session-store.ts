import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthResponse, User } from '@/lib/api/types'

/**
 * Cada portal guarda su propia sesión, así el propietario (panel) y un cliente (PWA)
 * pueden estar abiertos a la vez en el mismo navegador durante la demo.
 */
export type Portal = 'customer' | 'admin'

export interface Session {
  accessToken: string
  /** epoch ms */
  expiresAt: number
  user: User
}

interface SessionState {
  sessions: Partial<Record<Portal, Session>>
  signIn: (portal: Portal, auth: AuthResponse) => void
  signOut: (portal: Portal) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessions: {},
      signIn: (portal, { accessToken, expiresIn, user }) =>
        set((state) => ({
          sessions: { ...state.sessions, [portal]: { accessToken, user, expiresAt: Date.now() + expiresIn * 1000 } },
        })),
      signOut: (portal) =>
        set((state) => {
          const { [portal]: _removed, ...remaining } = state.sessions
          return { sessions: remaining }
        }),
    }),
    { name: 'smart-abarrotes:sessions', partialize: (state) => ({ sessions: state.sessions }) },
  ),
)

const activeOnly = (session: Session | undefined) => (session && session.expiresAt > Date.now() ? session : undefined)

/** Sesión vigente del portal; undefined si no existe o ya expiró. */
export const useSession = (portal: Portal) => activeOnly(useSessionStore((state) => state.sessions[portal]))

export const getSession = (portal: Portal) => activeOnly(useSessionStore.getState().sessions[portal])
