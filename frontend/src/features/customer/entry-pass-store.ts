import { create } from 'zustand'
import type { EntryPass } from '@/lib/api/types'

export interface ActiveEntryPass {
  /** JWT firmado que se codifica en el QR */
  token: string
  /** epoch ms */
  issuedAt: number
  expiresAt: number
  refreshAt: number
}

interface EntryPassState {
  pass: ActiveEntryPass | null
  setPass: (pass: EntryPass) => void
  clear: () => void
}

/** Solo en memoria: el pase dura segundos y es de un solo uso, no tiene sentido persistirlo. */
export const useEntryPassStore = create<EntryPassState>()((set) => ({
  pass: null,
  setPass: ({ token, expiresAt, refreshInSeconds }) => {
    const now = Date.now()
    set({ pass: { token, issuedAt: now, expiresAt: Date.parse(expiresAt), refreshAt: now + refreshInSeconds * 1000 } })
  },
  clear: () => set({ pass: null }),
}))
