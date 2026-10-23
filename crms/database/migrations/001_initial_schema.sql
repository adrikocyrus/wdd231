BEGIN;

CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'TECHNICIAN',
    'CUSTOMER'
);

CREATE TYPE ticket_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'WAITING_FOR_PARTS',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'CANCELLED'
);

CREATE TYPE invoice_status AS ENUM (
    'ISSUED',
    'PAID',
    'VOID'
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_nonempty CHECK (
        email = trim(email) AND length(email) > 0
    ),
    CONSTRAINT users_password_hash_nonempty CHECK (length(password_hash) > 0)
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE customers (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    name_ciphertext BYTEA NOT NULL,
    name_key_version SMALLINT NOT NULL CHECK (name_key_version > 0),
    phone_ciphertext BYTEA NOT NULL,
    phone_key_version SMALLINT NOT NULL CHECK (phone_key_version > 0),
    address_ciphertext BYTEA,
    address_key_version SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customers_name_ciphertext_nonempty CHECK (octet_length(name_ciphertext) > 0),
    CONSTRAINT customers_phone_ciphertext_nonempty CHECK (octet_length(phone_ciphertext) > 0),
    CONSTRAINT customers_address_ciphertext_version_pair CHECK (
        (address_ciphertext IS NULL AND address_key_version IS NULL)
        OR
        (address_ciphertext IS NOT NULL AND octet_length(address_ciphertext) > 0
         AND address_key_version IS NOT NULL AND address_key_version > 0)
    )
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT inventory_sku_nonempty CHECK (length(trim(sku)) > 0),
    CONSTRAINT inventory_name_nonempty CHECK (length(trim(name)) > 0),
    CONSTRAINT inventory_quantity_nonnegative CHECK (quantity_on_hand >= 0),
    CONSTRAINT inventory_unit_price_nonnegative CHECK (unit_price >= 0)
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES users(id) ON DELETE RESTRICT,
    device_type TEXT NOT NULL,
    serial_number_ciphertext BYTEA,
    serial_number_key_version SMALLINT,
    issue_description TEXT NOT NULL,
    status ticket_status NOT NULL DEFAULT 'OPEN',
    estimated_cost NUMERIC(12, 2),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tickets_device_type_nonempty CHECK (length(trim(device_type)) > 0),
    CONSTRAINT tickets_issue_description_nonempty CHECK (
        length(trim(issue_description)) > 0
    ),
    CONSTRAINT tickets_serial_ciphertext_version_pair CHECK (
        (serial_number_ciphertext IS NULL AND serial_number_key_version IS NULL)
        OR
        (serial_number_ciphertext IS NOT NULL
         AND octet_length(serial_number_ciphertext) > 0
         AND serial_number_key_version IS NOT NULL
         AND serial_number_key_version > 0)
    ),
    CONSTRAINT tickets_estimated_cost_nonnegative CHECK (
        estimated_cost IS NULL OR estimated_cost >= 0
    ),
    CONSTRAINT tickets_version_positive CHECK (version > 0)
);

CREATE INDEX tickets_customer_created_idx ON tickets (customer_id, created_at DESC);
CREATE INDEX tickets_status_created_idx ON tickets (status, created_at);
CREATE INDEX tickets_assigned_to_status_idx ON tickets (assigned_to, status);

CREATE TABLE ticket_parts (
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price_at_use NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (ticket_id, inventory_id),
    CONSTRAINT ticket_parts_quantity_positive CHECK (quantity > 0),
    CONSTRAINT ticket_parts_unit_price_nonnegative CHECK (unit_price_at_use >= 0)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE RESTRICT,
    status invoice_status NOT NULL DEFAULT 'ISSUED',
    subtotal NUMERIC(12, 2) NOT NULL,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    issued_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invoices_subtotal_nonnegative CHECK (subtotal >= 0),
    CONSTRAINT invoices_tax_nonnegative CHECK (tax >= 0),
    CONSTRAINT invoices_total_matches_amounts CHECK (total = subtotal + tax),
    CONSTRAINT invoices_currency_iso_code CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE ticket_status_history (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    from_status ticket_status,
    to_status ticket_status NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ticket_status_history_transition CHECK (
        from_status IS NULL OR from_status <> to_status
    )
);

CREATE INDEX ticket_status_history_ticket_changed_idx
    ON ticket_status_history (ticket_id, changed_at DESC);

COMMIT;
