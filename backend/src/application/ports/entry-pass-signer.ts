export interface EntryPassClaims {
  userId: string
  /** Identificador único del pase: el escáner lo marca como usado (anti-replay) */
  jti: string
  expiresAt: Date
}

export interface EntryPassSigner {
  sign(claims: EntryPassClaims): Promise<string>
  /** null si la firma, el tipo o la expiración no son válidos */
  verify(token: string): Promise<EntryPassClaims | null>
}
