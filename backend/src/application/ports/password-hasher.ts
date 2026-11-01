export interface PasswordHasher {
  hash(plain: string): Promise<string>
  /**
   * Con `hash = null` (usuario inexistente) debe gastar el mismo tiempo que una verificación real
   * y devolver false, para que el tiempo de respuesta no revele qué emails están registrados.
   */
  verify(plain: string, hash: string | null): Promise<boolean>
}
