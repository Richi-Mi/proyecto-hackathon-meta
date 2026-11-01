import { Elysia } from 'elysia'
import type { AuthUseCases } from '../../../application/auth/auth.use-cases'
import type { User } from '../../../domain/models/user'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentUser } from '../presenters'
import { AuthResponse, LoginRequest, RegisterRequest, UserSchema } from '../schemas/auth.schema'
import { errors } from '../schemas/common.schema'

export const authRoutes = (auth: AuthPlugin, useCases: AuthUseCases, expiresInSeconds: number) =>
  new Elysia({ prefix: '/auth' })
    .use(auth)
    .resolve(({ accessJwt }) => ({
      issueSession: async (user: User) => ({
        accessToken: await accessJwt.sign({ sub: user.id, role: user.role }),
        expiresIn: expiresInSeconds,
        user: presentUser(user),
      }),
    }))
    .post(
      '/register',
      async ({ body, issueSession, status }) => status(201, await issueSession(await useCases.registerCustomer(body))),
      {
        body: RegisterRequest,
        response: { 201: AuthResponse, ...errors(400, 409) },
        detail: { tags: ['Auth'], summary: 'Registro de cliente (rol CUSTOMER)', operationId: 'registerCustomer' },
      },
    )
    .post('/login', async ({ body, issueSession }) => issueSession(await useCases.login(body, 'CUSTOMER')), {
      body: LoginRequest,
      response: { 200: AuthResponse, ...errors(400, 401) },
      detail: { tags: ['Auth'], summary: 'Login de cliente', operationId: 'loginCustomer' },
    })
    .post('/admin/login', async ({ body, issueSession }) => issueSession(await useCases.login(body, 'ADMIN')), {
      body: LoginRequest,
      response: { 200: AuthResponse, ...errors(400, 401, 403) },
      detail: {
        tags: ['Auth'],
        summary: 'Login exclusivo de propietario (rechaza CUSTOMER con 403)',
        operationId: 'loginAdmin',
      },
    })
    .get('/me', async ({ auth }) => presentUser(await useCases.getCurrentUser(auth.userId)), {
      auth: true,
      response: { 200: UserSchema, ...errors(401) },
      detail: { tags: ['Auth'], summary: 'Usuario autenticado', operationId: 'getCurrentUser' },
    })
