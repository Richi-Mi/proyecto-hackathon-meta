# Changelog del contrato (`openapi.yaml`)

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
