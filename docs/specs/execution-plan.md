# Plan de ejecución


**Inmediato (este paso, sin código de implementación):**
1. Guardar la especificación en el repo:
   - `docs/specs/openapi.yaml` (contrato de la sección 3)
   - `docs/specs/erd.md` (ERD sección 1)
   - `docs/specs/architecture.md` (diagramas sección 2 + decisiones de diseño)
   - `docs/specs/execution-plan.md` (fases de abajo)
2. Validar el YAML con `bunx @redocly/cli lint docs/specs/openapi.yaml`.
3. Notion vía conector MCP: `notion-fetch` de la página `407a91000db080dda58dfe0ab5dcf8ca` para ver su contenido actual, y luego `notion-update-page` agregando (sin borrar lo existente) las secciones: **Plan de Ejecución**, **Decisiones de diseño**, **ERD (bloque Mermaid)**, **Arquitectura (bloques Mermaid)** y **Contrato OpenAPI (bloque código YAML)**. Verificar con un `notion-fetch` final.

**Roadmap de implementación (cada fase espera tu visto bueno):**
- **Fase 0 – Repo:** `backend/` está en el índice como *repositorio git embebido* (gitlink sin `.gitmodules`); propondré convertirlo en carpeta normal (`git rm --cached backend` + quitar `backend/.git`) — te lo confirmaré antes por ser destructivo. Monorepo `backend/` + `frontend/`, `docker-compose` con PostgreSQL + OTel collector, `.env.example`.
- **Fase 1 – Backend core:** estructura Clean Architecture (`domain/`, `application/`, `infrastructure/`, `interfaces/http/`), esquemas TypeBox espejo del contrato, TypeORM + migraciones, seed (OWNER + settings + categorías), auth (bun:password argon2id, JWT), guard de roles, manejo uniforme de errores, OpenTelemetry.
- **Fase 2 – Dominio de ventas:** caso de uso `RegisterSale` compartido por POS y webhook (transacción con `SELECT … FOR UPDATE` sobre productos), entry pass + StoreVisit, webhook HMAC idempotente, PaymentGateway Mock, cancelaciones, inventario, reportes (SQL agregados).
- **Fase 3 – Frontend:** Vite + PWA + Tailwind/Shadcn + Zustand + Axios; `/app` (login, QR con `qrcode.react` auto-refresh, historial) y `/admin` (dashboard con `recharts`, POS, inventario, ventas, configuración); animaciones con Motion/Anime.js.
- **Fase 4 – Verificación:** test de contrato (rutas/respuestas vs `openapi.yaml`), tests de casos de uso con `bun test`, simulador de cámaras (script que firma y envía el webhook) para demo E2E.

## Verificación de este paso
- `redocly lint` sin errores en `docs/specs/openapi.yaml`.
- Los bloques Mermaid renderizan en Notion/GitHub.
- La página de Notion muestra las 5 secciones nuevas sin pérdida del contenido previo.
