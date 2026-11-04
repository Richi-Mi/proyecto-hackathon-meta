# Diagrama Entidad-Relación


```mermaid
erDiagram
    USERS ||--o{ SALES : "compra (customer)"
    USERS ||--o{ SALES : "cobra (cashier)"
    USERS ||--o{ STORE_VISITS : "visita"
    STORE_VISITS |o--o| SALES : "genera"
    SALES ||--|{ SALE_ITEMS : "contiene"
    PRODUCTS ||--o{ SALE_ITEMS : "vendido en"
    CATEGORIES ||--o{ PRODUCTS : "agrupa"
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : "registra"
    SALES |o--o{ INVENTORY_MOVEMENTS : "origina"
    USERS |o--o{ INVENTORY_MOVEMENTS : "realiza"
    PRODUCTS |o--o{ SHELF_EVENTS : "detectado en"
    SHELF_EVENTS |o--o| INVENTORY_MOVEMENTS : "aplica"
    USERS |o--o{ SHELF_EVENTS : "revisa"
    STORE_VISITS |o--o{ SHELF_EVENTS : "carrito"

    SHELF_EVENTS {
        uuid id PK
        varchar camera_id
        enum status "APPLIED | PENDING_REVIEW | NO_CHANGE | REJECTED"
        enum action "REMOVED | ADDED | MOVED | NONE"
        varchar product_id FK "nullable"
        int quantity ">= 0"
        numeric confidence "nullable, 0-1"
        varchar review_reason "nullable"
        text note "nullable, explicación del modelo"
        varchar model "nullable"
        numeric change_ratio "nullable"
        uuid movement_id FK "nullable"
        uuid visit_id FK "nullable, carrito de la visita"
        varchar image_mime_type
        bytea before_image
        bytea after_image
        timestamptz captured_at
        timestamptz created_at
        timestamptz resolved_at "nullable"
        uuid resolved_by FK "nullable"
    }
    USERS {
        uuid id PK
        varchar name
        citext email UK
        text password_hash "bun:password (argon2id)"
        enum role "OWNER | CUSTOMER"
        varchar payment_customer_ref "nullable, token de pasarela"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    CATEGORIES {
        uuid id PK
        varchar name UK
        varchar color "hex #RRGGBB"
        varchar icon "nullable"
        int sort_order
    }
    PRODUCTS {
        varchar id PK "SKU"
        varchar barcode UK "nullable, EAN/UPC"
        varchar name
        text description "nullable"
        uuid category_id FK
        numeric price "12,2 IVA incluido"
        numeric purchase_cost "12,2 sin IVA"
        numeric tax_rate "5,4 ej. 0.1600"
        int stock "puede ser < 0 solo por venta AUTOMATED"
        int min_stock_alert
        enum status "ACTIVE | INACTIVE | DISCONTINUED"
        varchar image_url "nullable"
        boolean is_quick_access "grid del POS"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at "soft delete"
    }
    STORE_VISITS {
        uuid id PK
        uuid user_id FK
        uuid entry_token_jti UK "anti-replay"
        varchar gate_id
        enum status "ACTIVE | COMPLETED | ABANDONED"
        timestamptz entered_at
        timestamptz exited_at "nullable"
        varchar exit_event_id UK "nullable, eventId del webhook de salida"
    }
    SALES {
        uuid id PK
        serial folio UK "numero de ticket"
        timestamptz date_time
        uuid user_id FK "nullable (cliente casual)"
        uuid cashier_id FK "nullable (solo MANUAL)"
        uuid visit_id FK "nullable, UK (solo AUTOMATED)"
        varchar external_event_id UK "nullable, idempotencia webhook"
        enum sale_type "AUTOMATED | MANUAL"
        enum payment_method "CASH | CARD | TRANSFER | CARD_ON_FILE"
        enum payment_status "PAID | PENDING | FAILED | REFUNDED"
        varchar payment_reference "nullable"
        enum status "COMPLETED | CANCELLED"
        numeric subtotal "base sin IVA"
        numeric tax_amount
        numeric total_amount
        numeric cash_received "nullable"
        numeric change_given "nullable"
        timestamptz cancelled_at "nullable"
        uuid cancelled_by FK "nullable"
        text cancel_reason "nullable"
    }
    SALE_ITEMS {
        uuid id PK
        uuid sale_id FK
        varchar product_id FK
        varchar product_name "snapshot"
        int quantity "> 0"
        numeric unit_price "snapshot IVA incl."
        numeric unit_cost "snapshot"
        numeric tax_rate "snapshot"
        numeric subtotal "unit_price x quantity"
    }
    INVENTORY_MOVEMENTS {
        uuid id PK
        varchar product_id FK
        enum type "SALE | CANCELLATION | RESTOCK | ADJUSTMENT"
        int quantity_delta "+/-"
        int stock_after
        uuid sale_id FK "nullable"
        uuid user_id FK "nullable"
        text note "nullable"
        timestamptz created_at
    }
    STORE_SETTINGS {
        int id PK "singleton = 1"
        varchar business_name
        varchar legal_name "nullable"
        varchar rfc "nullable"
        text address
        varchar phone "nullable"
        varchar logo_url "nullable"
        char currency "MXN"
        numeric default_tax_rate "0.1600"
        text ticket_footer "nullable"
        jsonb peripherals "printer, scanner, card_terminal"
        timestamptz updated_at
    }
```

Índices clave: `sales(date_time)`, `sales(user_id, date_time)`, `sale_items(product_id)`, `products(name)` (trigram para búsqueda), `products(category_id)`, `inventory_movements(product_id, created_at)`, `store_visits(user_id) WHERE status = 'ACTIVE'` (único: como máximo una visita activa por cliente), `shelf_events(status, created_at)`. Checks: `quantity > 0`, `price >= 0`, `purchase_cost >= 0`, `tax_rate BETWEEN 0 AND 1`.

