import { Elysia } from 'elysia'
import type { SettingsUseCases } from '../../../application/settings/settings.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentSettings } from '../presenters'
import { errors } from '../schemas/common.schema'
import { StoreSettingsSchema, StoreSettingsUpdate } from '../schemas/settings.schema'

export const settingsRoutes = (auth: AuthPlugin, useCases: SettingsUseCases) =>
  new Elysia({ prefix: '/settings' })
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Settings'] } }, (app) =>
      app
        .get('', async () => presentSettings(await useCases.get()), {
          response: { 200: StoreSettingsSchema, ...errors(401, 403) },
          detail: { summary: 'Configuración general del negocio', operationId: 'getSettings' },
        })
        .patch('', async ({ body }) => presentSettings(await useCases.update(body)), {
          body: StoreSettingsUpdate,
          response: { 200: StoreSettingsSchema, ...errors(400, 401, 403) },
          detail: { summary: 'Actualiza configuración general', operationId: 'updateSettings' },
        }),
    )
