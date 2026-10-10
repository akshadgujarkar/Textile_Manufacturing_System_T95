# 02 — Database Technology Selection

**Project:** Textile Manufacturing System — Everest Textile Mills
**Depends on:** `01-requirements-analysis.md` (requirement IDs FR-x.y, business rules BR-x, assumptions A-x)

---

## 1. Decision

> **Use a single PostgreSQL database (one schema, one primary instance).**
> No second database, cache, search engine or analytics store is introduced.

---

## 2. What the requirements demand from the database

| # | Demand (from doc 01) | Source | What it means technically |
|---|---|---|---|
| 1 | Stock, dispatch and money must always reconcile | FR-1.2, FR-5.4, FR-6.x, BR-1, BR-7, BR-10 | Multi-row ACID transactions; strong consistency |
| 2 | A roll can be on at most one active dispatch; a machine runs one job at a time | BR-3, BR-7 | Database-enforced uniqueness, including *conditional* uniqueness ("only among active rows") |
| 3 | Rolls trace back to order, machine, worker, yarn | FR-3.1, FR-3.4 | Many foreign-key relationships; multi-table joins |
| 4 | Order status, stock, and cost computed across many entities | FR-1.4, FR-4.1, FR-6.4–6.7 | Joins, aggregation, views; reporting on live transactional data |
| 5 | Exact money and quantity arithmetic | FR-6.x | Exact decimal types, no floating point |
| 6 | Statuses restricted to valid values | BR-5 | Check constraints / enumerated types |
| 7 | Concurrent scanning, gate entry, and dashboard reading | Section 8 of doc 01 | Row-level locking, MVCC (readers don't block writers) |
| 8 | Full history of who changed what | Section 7 of doc 01 | Trigger-capable audit trail, append-only ledgers |
| 9 | Live dashboard | FR-2.1–2.3 | Fast reads over current state; later, optional change notification |
| 10 | Monthly profit/loss per order/machine | FR-6.4–6.6 | Window/aggregate queries; summary views |

**Pattern:** this is a classic **highly relational, transaction-heavy, integrity-critical** system with moderate scale. Almost every requirement is a relationship or a consistency guarantee, not a flexible-document problem.

---

## 3. Options evaluated

### 3.1 Comparison

| Criterion | **PostgreSQL** | MySQL (InnoDB) | MongoDB |
|---|---|---|---|
| Multi-row ACID transactions | Full, mature | Full | Supported, but not the native design centre; multi-document transactions cost more |
| Referential integrity (foreign keys) | Yes, strict | Yes | **No native foreign keys** — must be enforced in application code |
| Conditional uniqueness ("unique only among active rows") | **Yes** (partial unique indexes) | Limited / workarounds | Partial indexes exist, but without relational guarantees around them |
| "No two overlapping time ranges on one machine" at DB level | **Yes** (exclusion constraints) | No | No |
| Check constraints on values | Yes, rich | Yes (modern versions) | Schema validation, weaker |
| Exact decimal arithmetic | Yes | Yes | Yes (Decimal128) |
| Complex joins + aggregation for reports | **Excellent** | Good | Weaker (aggregation pipeline, `$lookup` is costly) |
| Handling genuinely flexible attributes (e.g. defect details) | JSONB column where needed | JSON column | Native |
| Auditing, triggers, views, materialised views | Strong | Adequate | Limited |
| Concurrency model | MVCC; readers don't block writers | MVCC | Document-level locking |
| Operational simplicity (one engine) | Yes | Yes | Yes |
| Typical hosting availability (managed) | Very wide | Very wide | Wide |

### 3.2 Why not MongoDB
- The central domain is **graph-like but strictly relational**: order ↔ order line ↔ job ↔ machine ↔ roll ↔ inspection ↔ dispatch ↔ invoice ↔ payment. Embedding would duplicate data (e.g. roll data inside both order and dispatch); referencing would recreate joins without foreign-key protection.
- The strictest requirements — "no double dispatch", "stock never negative", "money reconciles" — are exactly what relational constraints exist for. In MongoDB these become application-level discipline, which the role brief explicitly warns against ("do not rely exclusively on frontend or backend validation").
- Reporting (profit by order/machine/month) is join-and-aggregate work, which is relational's strength.

### 3.3 Why not MySQL
MySQL would also work and is not a poor choice. PostgreSQL is preferred because it can enforce, **inside the database**, three rules that are central to this PS:
1. a roll appears on only one *active* dispatch line (conditional uniqueness),
2. a machine has only one *running* job at a time,
3. time-range overlap prevention for machine jobs/downtime.
With MySQL these require workarounds (generated columns, triggers, or application checks), which weakens the integrity guarantee. *If the mill's team or hosting is already committed to MySQL, the model in doc 03 still works; those three rules would then move to triggers/transactional checks (decision to revisit in Phase 4).*

### 3.4 Why a single database
No requirement justifies more than one:
- **No cache (e.g. Redis):** the "live" dashboard covers tens to low hundreds of machines. A properly indexed relational query over current state is fast enough. Caching adds invalidation risk to a system whose core promise is accuracy.
- **No search engine:** lookups are by order number, roll ID, buyer name — all indexable keys.
- **No separate analytics store/warehouse:** monthly P/L over one plant's data is well within a single PostgreSQL instance, using views or summary tables.
- **No time-series database:** machine events and output logs at this volume are ordinary tables. Partitioning can be introduced later *only if* measured volume demands it.
- **No message queue as a data store:** none required by the PS.

---

## 4. Scale assessment (assumption A11 — please confirm)

| Dimension | Assumed magnitude | Implication |
|---|---|---|
| Plants | 1 | No sharding / multi-tenancy |
| Machines | tens to low hundreds | Dashboard queries tiny |
| Fabric rolls | hundreds to a few thousand per day → ~0.3–1.5 million/year | Comfortable for one PostgreSQL instance for many years |
| Output-log / machine-event rows | tens of thousands per day at most | Fine; revisit partitioning/archival only after several years of data |
| Concurrent users | tens | Connection pooling is sufficient |
| Availability need | Business hours, with tolerance for brief maintenance | Single primary + backups (details in Phase 6/8 docs, out of scope now) |

Conclusion: **vertical scaling of a single instance is sufficient for the foreseeable future.** Read replicas, partitioning, or archival are deferred, with triggers defined in Section 7.

---

## 5. How PostgreSQL features map to specific needs

| Need | PostgreSQL capability to use | Requirement |
|---|---|---|
| Atomic multi-step operations (receive yarn + update stock + write audit; finalise dispatch + mark rolls) | Transactions | FR-1.1, FR-5.3 |
| No double dispatch | Partial unique index on active dispatch lines | FR-5.4, BR-7 |
| One running job per machine | Partial unique index on machine for "running" jobs | BR-3 |
| No overlapping machine downtime/job periods (optional hardening) | Exclusion constraint on time ranges | FR-2.5 |
| Valid statuses | Enumerated types or check constraints | BR-5 |
| Stock can't go negative | Check constraint on stock balance + atomic updates | BR-1 |
| Exact money/quantity | Numeric (decimal) types | FR-6.x |
| Order status/completion % always consistent | Views (or materialised views) over source facts | BR-11 |
| Audit trail | Trigger-populated audit table, append-only ledgers | Section 7 of doc 01 |
| Flexible/rare attributes (e.g. defect measurement details) | JSONB — **sparingly**, never for core relationships | FR-3.3 |
| Live dashboard refresh | Plain polling queries first; change-notification (LISTEN/NOTIFY) only if polling proves insufficient | FR-2.1–2.3 |
| Future reporting growth | Materialised views / summary tables | FR-6.4–6.6 |

---

## 6. Conventions adopted for the whole design

| Topic | Convention |
|---|---|
| Naming | Lower-case `snake_case`; singular entity names in docs, plural table names in schema (Phase 4) |
| Time | All timestamps stored in UTC with timezone awareness; displayed in IST (A12). Business dates (e.g. attendance date, invoice date) are plain dates in plant-local calendar |
| Money | Exact decimal; single currency (INR) assumed [A]; amounts stored with explicit precision |
| Quantity | Exact decimal with an explicit unit on every quantity-bearing entity |
| Identifiers | Surrogate integer primary keys internally; separate human-readable business codes (order no., roll code, invoice no.) with unique constraints. Details in doc 03 and Phase 4 |
| Deletion | Deactivate masters, cancel/void transactions, reverse ledger entries; physical deletion avoided (see doc 03 lifecycle) |
| Single source of truth | Derived values are computed from facts (views) or cached with a documented refresh rule |

---

## 7. Risks of this choice and mitigations

| Risk | Likelihood | Mitigation | Revisit trigger |
|---|---|---|---|
| Dashboard queries slow as history grows | Low | Index on current-state columns; keep "current status" cached on machine/job rows with documented consistency rule (doc 03) | Dashboard response consistently slow despite indexes |
| Reporting queries compete with transactional load at month-end | Low–medium | Run reports off pre-aggregated summaries; if needed, a read replica | Month-end report visibly affecting scanning/gate speed |
| Table growth (output logs, machine events, audit log) | Low for years | Plan archival/partitioning by date in Phase 8 | Largest table passes tens of millions of rows |
| Team unfamiliar with PostgreSQL | Unknown [Q] | Managed hosting; standard SQL features only except the three integrity rules above | — |
| Over-use of JSONB erodes integrity | Medium (design discipline) | JSONB allowed only for non-relational, non-reportable extras; none for IDs/relationships | Any reporting need on a JSONB field → promote to a column |
| Application stack unknown | Unknown | Technology is accessible from every mainstream language; no stack dependency introduced | Stack decision made → confirm driver/ORM support for partial indexes and numeric types |

---

## 8. Compatibility with the application stack

The PS and brief do not name a backend, frontend, ORM, or hosting provider. **No stack-specific feature is assumed.** The only requirement placed on the application layer is that it:
1. performs each multi-step business operation in a single database transaction,
2. surfaces database constraint violations as user-friendly errors,
3. uses decimal-safe types for quantities and money.

**Open item:** if a stack/hosting decision already exists (e.g. a platform that provides only MySQL or a document store), tell me and I will re-evaluate section 3.3 before Phase 4.

---

## 9. Final recommendation

**PostgreSQL, single instance, single schema**, with:
- database-level enforcement of critical rules (no double dispatch, no double-booked machine, no negative stock, valid statuses),
- append-only ledgers for stock and money,
- views for derived status/cost,
- no additional data stores until measured need appears.

This is the simplest architecture that satisfies every requirement in doc 01 without relying on application code to protect data integrity.
