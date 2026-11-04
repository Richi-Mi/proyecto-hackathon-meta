# Changelog del contrato (`openapi.yaml`)

## 1.0.8 — 2026-11-04

ShelfSight: cámara de repisa. Rutas nuevas (tag **Shelf**, solo OWNER); sin cambios incompatibles.

- **`POST /shelf-events`**: el teléfono envía la foto de antes y la de después de una interacción. Un modelo de visión (API compatible con OpenAI; por defecto Muse Spark en Meta Model API) dice qué producto cambió y cuántas piezas. Se aplica solo con producto del catálogo, confianza ≥ `SHELF_AUTO_APPLY_CONFIDENCE`, cantidad ≤ `SHELF_MAX_AUTO_QUANTITY` y stock suficiente; si no, `PENDING_REVIEW`. Salida = `ADJUSTMENT` negativo, entrada = `RESTOCK`, con nota `ShelfSight · …` en el kardex.
- **`GET /shelf-events`**, **`GET /shelf-events/{id}`** (con fotos como data URL), **`POST /shelf-events/{id}/confirm`** y **`/reject`**: bitácora y cola de revisión. Códigos `INVALID_IMAGE`, `SHELF_EVENT_NOT_FOUND`, `SHELF_EVENT_RESOLVED`.
- **`GET /shelf/vision`**: si hay modelo configurado y las reglas de aplicación automática.
- ERD: tabla `shelf_events` (fotos en `bytea`).

## 1.0.7 — 2026-11-01

Despliegue en producción (Railway). Solo documentación; sin cambios en rutas ni esquemas.

- **`POST /dev/simulate-visit`** (tag Dev) también existe en producción si el servidor arranca con `ENABLE_STORE_SIMULATOR=true`, para la demostración del flujo automático. Sigue requiriendo un token de OWNER.

## 1.0.6 — 2026-11-01

Implementación de `GET /settings` y `PATCH /settings`. Con esto el contrato queda implementado completo. Sin cambios incompatibles para el frontend.

- **`PATCH /settings`** es parcial (sin defaults). En `peripherals` se reemplaza cada dispositivo enviado y los omitidos se conservan. Los textos se recortan, los vacíos de `legalName`, `phone` y `ticketFooter` se guardan como `null` y el RFC en mayúsculas.
- **`StoreSettingsUpdate`** fija límites alineados con el ERD: `businessName` 1–150, `legalName` ≤ 200, `address` 1–500, `phone` ≤ 20, `logoUrl` ≤ 500, `ticketFooter` ≤ 500 y el formato del RFC (12 o 13 caracteres). El 400 documenta `VALIDATION_ERROR`.
- **`Peripherals`**: cada dispositivo enviado debe venir completo (`printer`: `connection`, `address`, `paperWidthMm`; `barcodeScanner`: `mode`; `cardTerminal`: `provider`, `terminalId`). Límites: `address` ≤ 100, `provider` y `terminalId` ≤ 50.
- **`StoreSettings`** marca como requeridos los campos nullable (el servidor los envía con `null`). `updatedAt` se omite si la tienda aún no se configuró.
- **`ProductCreate.taxRate`** ya no tiene `default: 0.16`: si se omite, se usa `defaultTaxRate` de `/settings`.

## 1.0.5 — 2026-11-01

Implementación del flujo automático (Smart Store): `POST /store/entry` y `POST /webhooks/checkout`, más el reembolso por pasarela al cancelar. Sin cambios incompatibles para el frontend.

- **`/store/entry`**: si el cliente ya tenía una visita ACTIVE, se marca ABANDONED y se abre una nueva. Códigos `INVALID_DEVICE_KEY`, `INVALID_ENTRY_TOKEN` (401), `ACCOUNT_DISABLED` (nuevo 403) y `ENTRY_TOKEN_REUSED` (409). `StoreEntryRequest` y `StoreEntryResponse.user` fijan longitudes y campos requeridos.
- **`/webhooks/checkout`**: se documentan la firma sobre el cuerpo crudo, la idempotencia por `eventId` (también cuando `items` está vacío), que la venta no se rechaza por stock ni por producto INACTIVE, y los códigos `ITEM_CODE_REQUIRED`, `INVALID_EXITED_AT`, `INVALID_SIGNATURE`, `VISIT_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `VISIT_CLOSED` y `EVENT_ID_CONFLICT`. Límites: `eventId` ≤ 100, ≤ 100 partidas, cantidad ≤ 999.
- **`CheckoutWebhookResponse`**: todos los campos son requeridos; sin venta, `folio` y `paymentStatus` son `null` y `totalAmount` es 0.
- **`POST /sales/{id}/cancel`**: un pago `CARD_ON_FILE` PAID se reembolsa en la pasarela dentro de la transacción; nuevo 422 `REFUND_FAILED`.
- **Nuevo `POST /dev/simulate-visit`** (tag Dev, solo si `NODE_ENV ≠ production`): visita completa del cliente demo para la demostración. Esquema `SimulatedVisit`.
- ERD: `store_visits.exit_event_id` (único) para la idempotencia de las salidas sin venta, y como máximo una visita ACTIVE por cliente.

## 1.0.4 — 2026-11-01

Implementación de `GET /me/purchases`, `GET /me/purchases/{saleId}`, `GET /sales`, `GET /sales/{id}/receipt` y `POST /sales/{id}/cancel`. Sin cambios incompatibles.

- Historial del cliente: paginación por compra, agrupación por día en la zona horaria de la tienda; el total del día excluye canceladas.
- `GET /me/purchases/{saleId}` responde 404 `PURCHASE_NOT_FOUND` también para compras ajenas.
- Cancelación: repone stock con movimientos `CANCELLATION`, `PAID → REFUNDED`; códigos `SALE_ALREADY_CANCELLED` (409) e `INVALID_REASON` (400).
- `Receipt` marca como requeridos `taxBreakdown` y todos los campos de `business` (el servidor siempre los envía, con `null` cuando no aplica).

## 1.0.3 — 2026-11-01

Implementación de `/reports/summary`, `/reports/sales-trend` y `/reports/top-products`. Sin cambios incompatibles.

- Se documenta la semántica: rango semiabierto `[from, to)`, solo ventas COMPLETED, periodos en la zona horaria de la tienda (`STORE_TIMEZONE`) y periodos vacíos en cero.
- Nuevos códigos 400: `INVALID_RANGE` y `RANGE_TOO_LARGE` (más de 400 días o más de 1000 puntos en la serie).
- `ReportSummary` marca como requeridos `taxCollected`, `byType` (con `AUTOMATED`/`MANUAL` y sus campos) y `pendingPayments`; el servidor siempre los envía.

## 1.0.2 — 2026-10-31

Ajustes al implementar `GET /me/entry-pass`, `POST /sales` y `GET /sales/{id}` (Bloque 4). Sin cambios incompatibles.

- **`SaleSummary.itemCount`** se define como piezas totales del ticket.
- **`POST /sales`** documenta su comportamiento: fusión de partidas repetidas, snapshot de precio/costo/tasa, `cashReceived` ignorado fuera de efectivo, idempotencia, y los códigos `CASH_RECEIVED_REQUIRED`, `CUSTOMER_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `INSUFFICIENT_STOCK`, `PRODUCT_INACTIVE` y `CASH_INSUFFICIENT`.

## 1.0.1 — 2026-10-31

Ajustes detectados al implementar el Bloque 2 (Auth, Categorías, Productos, Inventario). Sin cambios incompatibles para clientes.

- **`Money`**: se quita `multipleOf: 0.01`. Con números de punto flotante (p. ej. `18.55 % 0.01 ≠ 0`) los validadores JSON Schema rechazan montos válidos; el servidor redondea a 2 decimales.
- **`Product.category`** ya no es nullable y es requerida, alineado con el ERD (`products.category_id NOT NULL`). También se marcan como requeridos `createdAt` y `updatedAt`.
- **`PATCH /categories/{id}`** usa el nuevo esquema parcial `CategoryUpdate` (antes exigía `name` y `color`). Agrega 400 y 409 (`CATEGORY_NAME_TAKEN`).
- **`PATCH` (productos y categorías)**: los campos omitidos conservan su valor; no se aplican defaults.
- **`DELETE /categories/{id}`** agrega 404.
- **`POST /products/{id}/stock-adjustments`** agrega 400 (`INVALID_QUANTITY`, `INVALID_UNIT_COST`) y 409 (`INSUFFICIENT_STOCK`).
- **`POST /products`** documenta los códigos `CATEGORY_NOT_FOUND` (400), `PRODUCT_ALREADY_EXISTS` y `BARCODE_ALREADY_EXISTS` (409).
- Todas las operaciones con `bearerAuth` documentan 401; las restringidas por rol, 403. Las que reciben body o query documentan 400.
