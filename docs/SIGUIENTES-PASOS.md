# Smart Abarrotes — estado del proyecto y siguientes pasos

Documento de traspaso entre sesiones de trabajo. Léelo completo antes de continuar.
Última actualización: 2026-11-01 (al preparar el **despliegue en Railway**, contrato v1.0.7). **El contrato está implementado completo.**

---

## 1. Qué es y cómo se trabaja

Sistema de administración y punto de venta para una tienda de abarrotes **híbrida**:

- **Flujo automático (Smart Store):** el cliente entra mostrando un QR desde la PWA, las cámaras detectan lo que toma y, al salir, un webhook genera la venta, cobra solo y descuenta inventario.
- **Flujo manual (POS):** el propietario cobra en mostrador con lector de código de barras.

**Forma de trabajo acordada con el usuario:**

- **Spec-Driven Design.** La fuente de verdad es `docs/specs/openapi.yaml`, que va en v1.0.7 y tiene su historial en `docs/specs/CHANGELOG.md`, y `docs/specs/erd.md`. Si la implementación descubre algo, primero se ajusta el contrato (sube versión y CHANGELOG) y después el código.
- **Paso por paso:** se termina un bloque y **se detiene para que el usuario revise** antes del siguiente.
- **Comunicación en español.** **No hacer commits** salvo que el usuario lo pida. El último commit del usuario es `e5c2eca Bloque 3 terminado`; los pasos 1–5 están sin commitear.
- **Nunca escribir contraseñas en el chat.** Están en `backend/.env`.

## 2. Stack y estructura

```
backend/   Bun + ElysiaJS + TypeORM 1.x (PostgreSQL 18) · Clean Architecture
  src/domain/          modelos, enums, errores de negocio, money.ts, sales/pricing.ts (puro, sin dependencias)
  src/application/     casos de uso (*.use-cases.ts) + ports/ (interfaces de repositorios/servicios)
  src/infrastructure/  TypeORM (entities, migrations, repositories), seguridad (argon2id, jose), OTel, seed, env
  src/interfaces/http/ Elysia: app.ts, routes/, schemas/ (TypeBox, espejo del contrato), presenters.ts, plugins/
  src/container.ts     raíz de composición (conecta repos ↔ casos de uso)
  tests/api.test.ts    pruebas de integración HTTP (64) contra una BD *_test que se recrea en cada corrida
  scripts/check-contract.ts  compara rutas implementadas vs contrato
  scripts/simulate-store.ts  visita completa por HTTP (QR → escáner → webhook firmado): bun run simulate:store
frontend/  React 19 + Vite 8 + TS 7 + Tailwind v4 + Shadcn (radix-nova) + React Router 8 + Zustand + Axios
  src/features/{auth,customer,admin,shelfsight}/   pantallas por portal (shelfsight = landing pública)
  src/lib/api/schema.d.ts   tipos GENERADOS del contrato (bun run gen:api) — no editar a mano
  src/components/ticket/TicketView.tsx  ticket compartido (POS, reimpresión, cliente)
Dockerfile, railway.json, .dockerignore   despliegue en Railway (1 servicio: API + frontend) → docs/DEPLOY-RAILWAY.md
docker-compose.yml  postgres:18 + otel-collector + jaeger (UI en :16686)
docs/specs/         openapi.yaml, erd.md, architecture.md, CHANGELOG.md
```

## 3. Cómo correr y verificar

```bash
docker compose up -d                      # Postgres en :5432 (+ OTel/Jaeger)
cd backend && bun run db:migrate && bun run db:seed && bun run dev    # API :3000, Swagger en /swagger
cd backend && bun run simulate:store      # demo del flujo automático (opciones: --items N, --empty, --api URL)
cd frontend && bun run dev                # http://localhost:5173 (proxy /api → :3000)
```

**Cuentas creadas por el seed** (las contraseñas están en `backend/.env`):

| Rol | Email | Variable con la contraseña |
|---|---|---|
| Propietario | `owner@smart-abarrotes.mx` | `SEED_OWNER_PASSWORD` |
| Cliente demo | `cliente@smart-abarrotes.mx` | `SEED_CUSTOMER_PASSWORD` |

**Verificación obligatoria al cerrar cada paso:**

```bash
cd backend  && bun run typecheck && bun test && bun run check:contract
cd frontend && bun run gen:api && bun run build && bun run lint
bunx --bun @redocly/cli@1 lint docs/specs/openapi.yaml     # desde la raíz
```

- **Si Docker está apagado**, no lo arranques sin preguntar. Usa un Postgres temporal (Homebrew `postgresql@18` está instalado):

  ```bash
  initdb -D <scratchpad>/pgdata -U smart --auth=trust
  pg_ctl -D <scratchpad>/pgdata -o "-p 54329 -c listen_addresses=localhost -c unix_socket_directories=''" -w start
  DATABASE_URL=postgres://smart@localhost:54329/smart_abarrotes_test bun test
  ```

  El socket Unix se desactiva porque la ruta del scratchpad excede 103 bytes. Los valores de la línea de comando tienen prioridad sobre `.env` y `.env.test`.
- **El usuario suele tener sus propios servidores** en :3000 (`bun run --watch`) y :5173. Para pruebas propias usa :3001 y :5174 (`VITE_API_PROXY_TARGET=http://localhost:3001`). No detengas procesos que no lanzaste.
- **No hay navegador disponible para revisar la interfaz:** la extensión de Chrome no conecta y no hay Chrome instalado. La revisión visual la hace el usuario. La verificación de punta a punta se hace con scripts de Bun contra la API, reutilizando funciones del frontend cuando aplica (por ejemplo `product-form.ts` y `dashboard/periods.ts`).

## 4. Qué está hecho

| Etapa | Contenido |
|---|---|
| Especificación | OpenAPI + ERD + arquitectura; documentado en Notion (página "Hackathon Meta", **actualizada al 2026-11-01 con el contrato v1.0.6**: estado, decisiones de implementación, ERD, CHANGELOG, YAML completo y `openapi.yaml` adjunto) |
| Bloques 1–2 | Entidades/migraciones, auth (argon2id + JWT), categorías, productos, inventario (ajustes, kardex, resumen), errores uniformes, OTel, Swagger, seed |
| Bloque 3 | Frontend base: PWA, router por portal (sesión separada cliente/admin), layouts, login/registro |
| Landing | `/` = landing de ShelfSight (PR #1, Motion), con los colores del sistema (tokens `--sf-*` derivados de `index.css`); `/shelfsight` redirige a `/`. La landing anterior (Anime.js) se eliminó |
| Bloque 4 | `GET /me/entry-pass` (QR con JWT de 60 s), `POST /sales` (idempotente), pantallas: QR, dashboard, inventario, POS |
| Paso 1 | Alta/edición de productos, entradas de mercancía, mermas, kardex, baja lógica (solo frontend) |
| Paso 2 | `/reports/summary`, `/reports/sales-trend`, `/reports/top-products` + dashboard con datos reales (hora local de la tienda) |
| Paso 3 | `/me/purchases(/{id})`, `GET /sales`, `/sales/{id}/receipt`, `POST /sales/{id}/cancel` + pantallas Mis compras e Historial de ventas |
| Paso 4 | Flujo automático: `POST /store/entry`, `POST /webhooks/checkout`, pasarela simulada, reembolso al cancelar, `POST /dev/simulate-visit`, `simulate:store`, botón "Simular visita" en el dashboard, Mis compras se refresca al volver a la app |
| Paso 5 | `GET/PATCH /settings` (contrato v1.0.6) + pantalla Configuración: perfil del negocio, IVA por defecto, pie del ticket, periféricos, vista previa del ticket y prueba de impresora (ESC/POS por WebUSB / Web Bluetooth, o diálogo del navegador) |
| Despliegue | Railway con 1 servicio + Postgres (contrato v1.0.7, solo documentación): `Dockerfile` en la raíz (compila el frontend; el backend lo sirve con `FRONTEND_DIST`), `railway.json` (pre-deploy `bun run db:prepare` = migraciones + seed idempotente; healthcheck `/api/v1/health`), `ENABLE_STORE_SIMULATOR=true` monta `/dev` en producción y muestra el botón. Guía: `docs/DEPLOY-RAILWAY.md` |

`bun run check:contract` reporta: **34 operaciones sin diferencias, 0 pendientes**.

### Cómo quedó el flujo automático (paso 4)

- **Decisiones del usuario:** al volver a entrar con una visita ACTIVE, la anterior pasa a **ABANDONED**; el **registro asigna una referencia simulada** de pago (`users.payment_customer_ref = mock_cus_…`) y el seed se la asigna al cliente demo si no la tenía; el simulador es **script + botón en el dashboard** (endpoint `/dev/*` que solo se monta si `NODE_ENV ≠ production`; el botón aparece en `vite dev` o con `VITE_STORE_SIMULATOR=true`).
- **Migración nueva** `1793300000000-StoreVisitExitEvent`: `store_visits.exit_event_id` (único; idempotencia también para salidas sin venta) e índice único parcial "una visita ACTIVE por cliente". **En la base del usuario hay que correr `bun run db:migrate` y luego `bun run db:seed`** (este último vincula la pasarela al cliente demo existente).
- **Variables nuevas** (ya agregadas al final de `backend/.env` con valores aleatorios): `STORE_DEVICE_KEYS`, `WEBHOOK_SECRET`, `MOCK_PAYMENT_FAILURE_RATE`. `SEED_CUSTOMER_EMAIL` también la lee el servidor (cliente del simulador).
- **Piezas:** `application/store/store.use-cases.ts` (entrada, checkout, simulador), puertos `payment-gateway.ts`, `store-visit-repository.ts`, `store-device-auth.ts`; adaptadores `infrastructure/payments/mock-payment-gateway.ts`, `infrastructure/security/store-device-auth.ts` (llaves y HMAC con `timingSafeEqual`), `typeorm-store-visit.repository.ts` (`closeVisit` se reutiliza dentro de `recordSale`).
- **Orden en el webhook:** venta (PENDING) + descuento de stock + cierre de visita en una transacción → cobro fuera de la transacción → `setPaymentResult` (PAID/FAILED). El reembolso al cancelar sí va **dentro** de la transacción de cancelación: si la pasarela falla, 422 `REFUND_FAILED` y no se cancela.
- **Pruebas:** el contenedor acepta `createContainer(ds, { paymentGateway })`; las pruebas usan una pasarela espía (`SpyPaymentGateway`) para verificar y forzar reembolsos.

---

### Cómo quedó Configuración (paso 5)

- **Backend:** `domain/models/store-settings.ts` (modelo, `DEFAULT_STORE_SETTINGS`, `toBusinessProfile`), puerto `store-settings-repository.ts` y `TypeOrmStoreSettingsRepository` (reemplazan a `BusinessProfileRepository`). `update(change)` crea la fila si falta (`INSERT … ON CONFLICT DO NOTHING`), la bloquea con `FOR UPDATE` y aplica los cambios calculados sobre el valor vigente. `application/settings/settings.use-cases.ts` normaliza (trim, vacío → `null`, RFC en mayúsculas, `roundRate`).
- **Semántica del PATCH:** parcial y sin defaults; en `peripherals` se **reemplaza cada dispositivo enviado** y los omitidos se conservan (no hay forma de borrar un dispositivo: se usa `connection: NONE`).
- **IVA por defecto:** `ProductCreate.taxRate` ya no tiene `default: 0.16`; `ProductUseCases.create` usa `defaultTaxRate` de `/settings`. El formulario de alta de producto lo propone.
- **Frontend:** `features/admin/settings/` → `settings-store.ts` (Zustand; lo carga `AdminLayout` y fija `--ticket-width` para `window.print()`), `settings-form.ts` (valores, validación, PATCH con solo lo modificado y mapeo de errores anidados `/peripherals/...`), `PrinterTestPanel.tsx`, `printer/escpos.ts` (texto transliterado a ASCII, 32/48 columnas), `printer/test-ticket.ts`, `printer/transports.ts` (WebUSB y Web Bluetooth con tipos mínimos propios). Se borraron `placeholders.tsx` y `PagePlaceholder.tsx`.
- **Limitaciones de la impresión directa:** solo Chrome/Edge en https o localhost; Bluetooth solo BLE (no SPP clásico); impresoras de red no (el navegador no abre sockets): para esas, "Imprimir con el navegador". En macOS/Windows, si la impresora USB tiene driver instalado, el sistema la tiene tomada y `claimInterface` falla (se muestra un mensaje que lo explica).

---

## 5. SIGUIENTE: a elegir por el usuario

El contrato quedó implementado completo. Opciones (sección 6): desplegar en Railway siguiendo `docs/DEPLOY-RAILWAY.md`, revisión visual de los pasos 4 y 5 y de la landing, commits por etapa o las mejoras menores.

## 6. Otros pendientes

1. **Revisión visual de los pasos 4 y 5 y de la landing** por el usuario: botón "Simular visita" del dashboard (toast + recarga de KPIs), Mis compras en la PWA, la pantalla Configuración (vista previa del ticket a 58/80 mm, prueba de impresora con hardware real) y la landing de ShelfSight con los colores del sistema.
2. **Mantener Notion al día** (está en v1.0.6; falta subir la v1.0.7 del despliegue): si el contrato cambia, actualizar la página "Hackathon Meta" (estado, CHANGELOG, bloques YAML y el adjunto `openapi.yaml`). El YAML va en dos bloques (antes y desde `components:`) y, por tamaño, se sube en llamadas separadas.
3. **Commits por etapa**, cuando el usuario lo pida.
4. **Mejoras menores:**
   - el bundle principal del frontend pesa ~174 KB gzip y se puede dividir en chunks;
   - un `README` raíz con las instrucciones de la sección 3;
   - imágenes de productos.

## 7. Decisiones y trampas ya resueltas (no repetirlas)

- **Elysia + headers:** un esquema `headers` descarta los headers no declarados, **incluido `Authorization`**. Siempre usar `{ additionalProperties: true }` (ver `IdempotencyHeaders` en `schemas/sale.schema.ts`).
- **Elysia + `default` en PATCH:** los `default` del esquema se aplican también en un PATCH y **sobrescriben** valores guardados. Los defaults solo van en los esquemas de creación (ver `product.schema.ts` y `category.schema.ts`).
- **Dinero:** `numeric(12,2)`, redondeo `roundMoney` (half away from zero, sin errores de punto flotante). Precios con IVA incluido y tasa por producto (0, 8 o 16 %). La partida guarda un snapshot de nombre, precio, costo y tasa. Ganancia = base sin IVA − costo snapshot.
- **Concurrencia:** ventas, ajustes y cancelaciones bloquean filas con `FOR UPDATE`, ordenadas por id. `FOR UPDATE` no admite `LEFT JOIN`: primero se bloquea y luego se cargan las relaciones.
- **Zona horaria:** los reportes y el historial agrupan por día con `STORE_TIMEZONE` (America/Mexico_City). Los rangos son `[from, to)`.
- **TypeScript 7** (frontend): `openapi-typescript` no funciona con TS 7. `gen:api` lo ejecuta con `npx -p typescript@5.9`.
- **Shadcn CLI:** si pide sobrescribir componentes, responder que no (`yes n | bunx shadcn@4 add …`).
- **Pruebas:** la BD de pruebas debe llamarse `*_test` (`tests/setup.ts` la borra y la recrea). Para datos aislados se usan fechas fijas en el pasado o SKUs propios del bloque de pruebas.
- **Webhook firmado en Elysia:** la ruta usa `parse: 'text'` para tener el cuerpo crudo; la firma se verifica antes de `JSON.parse` y el esquema se valida a mano con `Value.Check` (los formatos `uuid`/`date-time` ya los registra Elysia). Los tipos de `detail.requestBody` son de OpenAPI 3.0: el esquema TypeBox se pasa con `as never`.
- **Rutas solo de desarrollo:** `config.devTools` monta `/dev/*`; `check-contract.ts` y las pruebas lo activan para comparar contra el contrato.
- **Frontend servido por el backend** (`plugins/static-frontend.ts`): un comodín `/*` que pierde contra las rutas del API y Swagger; `/api/*` inexistente sigue dando el 404 JSON, un archivo inexistente con extensión da 404 y lo demás recibe `index.html`. `/assets/*` con caché inmutable; `index.html`, `sw.js` y el manifest con `no-cache`.
- **Errores del API:** `{ error: { code, message, details?, traceId? } }`. El frontend asigna `code` y `details[].path` a los campos del formulario (`features/admin/inventory/form-errors.ts`).
