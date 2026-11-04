# Despliegue en Railway

Un solo servicio sirve todo desde el mismo dominio:

| Ruta | Qué es |
|---|---|
| `/` | Landing, portal del propietario (`/admin`) y PWA del cliente (`/app`) |
| `/api/v1/*` | API |
| `/swagger` | Documentación interactiva |

Más una base **PostgreSQL** de Railway. No hay CORS ni URLs cruzadas que configurar.

## Qué hay en el repo

| Archivo | Para qué |
|---|---|
| `Dockerfile` (raíz) | Compila el frontend con Vite, instala las dependencias de producción del backend y arranca `bun src/index.ts` con `NODE_ENV=production` y `FRONTEND_DIST=/app/frontend/dist` |
| `railway.json` (raíz) | Railway usa el Dockerfile. Antes de cada deploy corre `bun run db:prepare` (migraciones + seed idempotente) y considera sano el servicio cuando `/api/v1/health` responde |
| `.dockerignore` | Deja fuera `node_modules`, `dist`, `.env` y `docs` |

## Pasos (una sola vez)

1. **Sube el repo a GitHub** (con `Dockerfile`, `railway.json` y `.dockerignore` en la raíz).
2. En Railway: **New Project → Deploy from GitHub repo** y elige el repo. No cambies el *Root Directory*: debe ser la raíz.
3. En el mismo proyecto: **+ New → Database → PostgreSQL**.
4. Abre el servicio de la app → **Variables → Raw Editor** y pega el bloque de abajo, ya con tus valores.
5. Servicio de la app → **Settings → Networking → Generate Domain**. El puerto del dominio debe ser el mismo en el que escucha la app: **3000** (o el valor de `PORT` si lo cambias). Si no coinciden, todas las rutas responden 502 `Application failed to respond` aunque el log diga que el servidor arrancó.
6. Railway redespliega solo al cambiar variables. Revisa los logs del deploy: el *pre-deploy* debe mostrar las migraciones y el seed (`✔ Propietario creado…`). Después abre `https://<tu-dominio>/`.

Desde ahí, cada `git push` a la rama conectada vuelve a desplegar. Las migraciones nuevas se aplican solas y el seed no duplica nada.

## Variables

Genera cada secreto con `openssl rand -base64 48` (para `STORE_DEVICE_KEYS`, `openssl rand -hex 24`). Usa un valor distinto en cada uno y no reutilices los de `backend/.env`.

```env
# Referencia a la base de Railway (escríbelo literal: Railway lo resuelve)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Secretos (mínimo 32 caracteres; la llave del escáner, mínimo 16)
JWT_SECRET=
ENTRY_PASS_SECRET=
WEBHOOK_SECRET=
STORE_DEVICE_KEYS=

# Cuentas que crea el seed en el primer deploy
SEED_OWNER_EMAIL=owner@smart-abarrotes.mx
SEED_OWNER_PASSWORD=
SEED_CUSTOMER_EMAIL=cliente@smart-abarrotes.mx
SEED_CUSTOMER_PASSWORD=

# Demo del hackathon: botón "Simular visita" + POST /dev/simulate-visit (solo OWNER)
ENABLE_STORE_SIMULATOR=true

STORE_TIMEZONE=America/Mexico_City

# ShelfSight · cámara de repisa (sin llave, los eventos quedan en revisión manual)
VISION_API_URL=https://api.meta.ai/v1
VISION_API_KEY=
VISION_MODEL=muse-spark-1.3
```

### Opcionales

| Variable | Default | Nota |
|---|---|---|
| `SEED_DEMO_CATALOG` | `true` | `false` para no crear categorías ni productos de ejemplo |
| `SEED_DEMO_SALES` | `true` | ~40 ventas de los últimos 14 días; solo se crean si la base no tiene ventas |
| `SEED_OWNER_NAME` / `SEED_CUSTOMER_NAME` | `Propietario` / `Cliente Demo` | |
| `MOCK_PAYMENT_FAILURE_RATE` | `0` | Probabilidad de que la pasarela simulada rechace un cobro |
| `JWT_EXPIRES_IN_SECONDS` | `28800` | 8 h |
| `VISION_JSON_MODE` | `true` | `false` si el proveedor de visión rechaza `response_format` con imágenes |
| `VISION_TIMEOUT_MS` | `30000` | Tiempo máximo de la llamada al modelo de visión |
| `SHELF_AUTO_APPLY_CONFIDENCE` | `0.75` | Confianza mínima para aplicar un evento de repisa sin revisión |
| `SHELF_MAX_AUTO_QUANTITY` | `6` | Más piezas en un solo evento → revisión |
| `OTEL_ENABLED` | `false` | Si lo activas, apunta `OTEL_EXPORTER_OTLP_ENDPOINT` a un colector OTLP/HTTP |

`NODE_ENV`, `FRONTEND_DIST` y `PORT` ya los fija el Dockerfile; Railway sobrescribe `PORT` con el suyo. `CORS_ORIGINS` no hace falta porque el frontend y la API comparten dominio.

## Cosas a saber

- **`ENABLE_STORE_SIMULATOR` se lee al compilar** (para mostrar el botón en el frontend) **y al arrancar** (para montar `/dev`). Si la cambias, Railway reconstruye la imagen.
- **`STORE_DEVICE_KEYS` se separa por comas** y **cada** llave necesita 16 caracteres o más. Una coma de más (`llave-larga,abc`) hace que el servidor no arranque. Lo más seguro es una sola llave de `openssl rand -hex 24`, sin comillas ni espacios.
- **No copies `backend/.env` tal cual.** Las variables de desarrollo no sirven en Railway: `OTEL_ENABLED=true` manda las trazas a `localhost:4318`, donde no hay colector, y `FRONTEND_DIST` vacía hace que el servidor solo exponga la API. En el log de arranque deben salir las tres líneas: API, Frontend (🛒) y Swagger.
- **La app aplica las migraciones pendientes al arrancar** (con `NODE_ENV=production`), aunque el pre-deploy no haya corrido; el log lo dice (`🗄️ Migraciones aplicadas…` o `Esquema al día`). El seed **solo** corre en el pre-deploy: si la app funciona pero no existe el propietario ni el catálogo demo, el pre-deploy no se ejecutó. Revisa *Settings → Deploy* del servicio y vuelve a desplegar, o siémbralo desde tu máquina con la URL pública de la base: `cd backend && DATABASE_URL="<DATABASE_PUBLIC_URL>" bun run db:seed` (con las variables `SEED_*` definidas).
- **El seed nunca sobrescribe.** Cambiar `SEED_OWNER_PASSWORD` después del primer deploy no cambia la contraseña de una cuenta que ya existe.
- **Si el pre-deploy falla**, el deploy no se publica y la versión anterior sigue activa. Las causas típicas son una variable que falta o es corta (el mensaje dice cuál: `Variables de entorno inválidas: /JWT_SECRET…`) o que `DATABASE_URL` no apunta a la base.
- **Postgres de Railway:** las migraciones habilitan `pgcrypto`, `citext` y `pg_trgm`, que vienen incluidas en la imagen de Railway.
- **PWA:** Railway sirve con HTTPS, así que el service worker y la instalación en el celular funcionan. Tras un deploy, la app se actualiza sola (`registerType: autoUpdate`).
- **Dispositivos de la tienda:** el escáner de entrada usa `X-Device-Key` con una de las llaves de `STORE_DEVICE_KEYS`, y las cámaras firman el webhook con `WEBHOOK_SECRET`. Para la demo basta el botón "Simular visita".

## Probarlo en local como en producción

Sin Docker, con la base de desarrollo:

```bash
cd frontend && bun run build
cd ../backend && NODE_ENV=production PORT=3001 FRONTEND_DIST="$(cd ../frontend/dist && pwd)" ENABLE_STORE_SIMULATOR=true bun src/index.ts
# http://localhost:3001  (frontend + API en el mismo origen)
```

Con Docker, igual que en Railway:

```bash
docker build -t smart-abarrotes --build-arg ENABLE_STORE_SIMULATOR=true .
# backend/.env trae NODE_ENV=development y OTEL a localhost: se sobrescriben
docker run --rm -p 3001:3000 --env-file backend/.env \
  -e NODE_ENV=production -e OTEL_ENABLED=false -e ENABLE_STORE_SIMULATOR=true \
  -e DATABASE_URL=postgres://smart:smart@host.docker.internal:5432/smart_abarrotes \
  smart-abarrotes
```
