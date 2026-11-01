import type { PasswordHasher } from '../../application/ports/password-hasher'

export class BunPasswordHasher implements PasswordHasher {
  private dummyHash?: Promise<string>

  hash(plain: string): Promise<string> {
    return Bun.password.hash(plain, { algorithm: 'argon2id' })
  }

  async verify(plain: string, hash: string | null): Promise<boolean> {
    if (hash === null) {
      this.dummyHash ??= this.hash('timing-equalizer')
      await Bun.password.verify(plain, await this.dummyHash)
      return false
    }
    return Bun.password.verify(plain, hash)
  }
}
