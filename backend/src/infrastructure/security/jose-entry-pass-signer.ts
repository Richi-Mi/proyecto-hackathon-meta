import { jwtVerify, SignJWT } from 'jose'
import type { EntryPassClaims, EntryPassSigner } from '../../application/ports/entry-pass-signer'

const TOKEN_TYPE = 'entry'

/** JWT HS256 con un secreto propio (distinto al de las sesiones): `{ sub, typ: 'entry', jti, iat, exp }`. */
export class JoseEntryPassSigner implements EntryPassSigner {
  private readonly key: Uint8Array

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret)
  }

  sign({ userId, jti, expiresAt }: EntryPassClaims): Promise<string> {
    return new SignJWT({ typ: TOKEN_TYPE })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key)
  }

  async verify(token: string): Promise<EntryPassClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] })
      if (payload.typ !== TOKEN_TYPE || !payload.sub || !payload.jti || !payload.exp) return null
      return { userId: payload.sub, jti: payload.jti, expiresAt: new Date(payload.exp * 1000) }
    } catch {
      return null
    }
  }
}
