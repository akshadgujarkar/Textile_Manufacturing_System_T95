-- ============================================================================
-- Migration 0003: Orders, Purchasing, Gate Entry & Supplier Bills
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

-- ===================== Customer Orders =====================
CREATE TABLE IF NOT EXISTS customer_order (
  order_id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_no               text   NOT NULL UNIQUE DEFAULT make_code('ORD', 'seq_order_no'),
  buyer_id               bigint NOT NULL REFERENCES buyer (buyer_id),
  order_date             date   NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  promised_delivery_date date,
  status                 text   NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'confirmed', 'cancelled', 'closed')),
  confirmed_at           timestamptz,
  cancelled_at           timestamptz,
  cancelled_by           bigint REFERENCES app_user (user_id),
  cancel_reason          text,
  version                int    NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_order_promised_after_order CHECK (promised_delivery_date IS NULL OR promised_delivery_date >= order_date),
  CONSTRAINT ck_order_confirmed_has_date   CHECK (status = 'draft' OR status = 'cancelled' OR promised_delivery_date IS NOT NULL),   -- FR-4.3
  CONSTRAINT ck_order_cancel_reason        CHECK (status <> 'cancelled' OR (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL)),
  CONSTRAINT uq_order_buyer UNIQUE (order_id, buyer_id)       -- Target of composite FK from dispatch
);

CREATE TABLE IF NOT EXISTS order_item (
  order_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      bigint   NOT NULL REFERENCES customer_order (order_id),
  line_no       smallint NOT NULL CHECK (line_no > 0),
  product_id    bigint   NOT NULL,
  colour_id     bigint   NOT NULL REFERENCES colour (colour_id),
  ordered_qty   qty_t    NOT NULL CHECK (ordered_qty > 0),
  unit_id       bigint   NOT NULL,
  agreed_rate   rate_t   NOT NULL CHECK (agreed_rate >= 0),     -- Price snapshot
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_order_item_line UNIQUE (order_id, line_no),
  CONSTRAINT fk_order_item_product_unit FOREIGN KEY (product_id, unit_id)
      REFERENCES fabric_product (product_id, unit_id)            -- Item unit must equal the product unit
);

CREATE TABLE IF NOT EXISTS order_status_history (
  history_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    bigint NOT NULL REFERENCES customer_order (order_id),
  from_status text,
  to_status   text   NOT NULL,
  reason      text,
  changed_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_material_requirement (
  requirement_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_item_id  bigint NOT NULL REFERENCES order_item (order_item_id),
  yarn_item_id   bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  required_qty   qty_t  NOT NULL CHECK (required_qty > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_requirement UNIQUE (order_item_id, yarn_item_id)
);

-- ===================== Purchase Orders =====================
CREATE TABLE IF NOT EXISTS purchase_order (
  po_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_no       text   NOT NULL UNIQUE DEFAULT make_code('PO', 'seq_po_no'),
  supplier_id bigint NOT NULL REFERENCES supplier (supplier_id),
  order_date  date   NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  status      text   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'closed', 'cancelled')),
  version     int    NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_po_supplier UNIQUE (po_id, supplier_id)         -- Target of composite FK from goods_receipt
);

CREATE TABLE IF NOT EXISTS purchase_order_item (
  po_item_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id        bigint NOT NULL REFERENCES purchase_order (po_id),
  yarn_item_id bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  quantity     qty_t  NOT NULL CHECK (quantity > 0),
  agreed_rate  rate_t NOT NULL CHECK (agreed_rate >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_po_item UNIQUE (po_id, yarn_item_id)
);

-- ===================== Gate Entry (Goods Receipt) =====================
CREATE TABLE IF NOT EXISTS goods_receipt (
  receipt_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_no          text   NOT NULL UNIQUE DEFAULT make_code('GRN', 'seq_receipt_no'),
  supplier_id         bigint NOT NULL REFERENCES supplier (supplier_id),
  po_id               bigint,
  supplier_challan_no text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  client_request_id   uuid   NOT NULL UNIQUE,              -- Duplicate-submit guard
  status              text   NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'cancelled')),
  cancelled_at        timestamptz,
  cancelled_by        bigint REFERENCES app_user (user_id),
  cancel_reason       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT fk_receipt_po_supplier FOREIGN KEY (po_id, supplier_id)
      REFERENCES purchase_order (po_id, supplier_id),       -- Receipt must come from the PO's own supplier
  CONSTRAINT ck_receipt_cancel CHECK (status <> 'cancelled' OR (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_challan ON goods_receipt (supplier_id, supplier_challan_no)
  WHERE supplier_challan_no IS NOT NULL AND status = 'received';

CREATE TABLE IF NOT EXISTS goods_receipt_item (                           -- One row = one yarn lot
  receipt_item_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id         bigint NOT NULL REFERENCES goods_receipt (receipt_id),
  lot_code           text   NOT NULL UNIQUE DEFAULT make_code('LOT', 'seq_lot_code'),
  yarn_item_id       bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  quantity_received  qty_t  NOT NULL CHECK (quantity_received > 0),
  challan_quantity   qty_t  CHECK (challan_quantity IS NULL OR challan_quantity > 0),     -- Paperwork quantity
  unit_rate          rate_t CHECK (unit_rate IS NULL OR unit_rate >= 0),                  -- Provisional rate feeding avg cost
  earmarked_order_id bigint REFERENCES customer_order (order_id),                         -- Optional order link (Q3)
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

-- ===================== Supplier Bills =====================
CREATE TABLE IF NOT EXISTS supplier_bill (
  bill_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id      bigint  NOT NULL REFERENCES supplier (supplier_id),
  supplier_bill_no text    NOT NULL,
  bill_date        date    NOT NULL,
  total_amount     money_t NOT NULL DEFAULT 0,               -- Maintained by trigger from lines
  status           text    NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'void')),
  voided_at        timestamptz,
  voided_by        bigint REFERENCES app_user (user_id),
  void_reason      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_bill_void CHECK (status <> 'void' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_bill_no ON supplier_bill (supplier_id, supplier_bill_no) WHERE status = 'recorded';

CREATE TABLE IF NOT EXISTS supplier_bill_line (
  bill_line_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bill_id         bigint  NOT NULL REFERENCES supplier_bill (bill_id),
  receipt_item_id bigint  NOT NULL REFERENCES goods_receipt_item (receipt_item_id),
  quantity        qty_t   NOT NULL CHECK (quantity > 0),
  rate            rate_t  NOT NULL CHECK (rate >= 0),
  amount          money_t NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_bill_line_amount CHECK (amount = round(quantity * rate, 2)),
  CONSTRAINT uq_bill_line UNIQUE (bill_id, receipt_item_id)
);
