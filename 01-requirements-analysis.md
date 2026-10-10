# 01 — Requirements Analysis

**Project:** Textile Manufacturing System — Everest Textile Mills
**Scope of this document set:** Phases 1–3 only (requirements, technology selection, data model design). No code, no SQL.
**Source material:** (1) the problem statement (PS) describing six factory situations, (2) the database-architect role brief.

**Tagging convention used throughout**
- **[D]** = Documented in the PS (stated directly).
- **[A]** = Assumption (not stated; needed to make the design complete). Every [A] is listed again in Section 10.
- **[Q]** = Open question (answer would materially change the design). Listed in Section 11.

---

## 1. Core problem

Everest Textile Mills runs its entire operation on notebooks, paper slips and registers. As a result:

1. Nobody knows real raw-material stock without walking to the store. [D]
2. Nobody knows which machines are running or idle, or what each produced, without walking the floor. [D]
3. Quality defects are on paper, so a defect cannot be traced to a machine or worker. [D]
4. Buyer status queries require staff to physically ask around and call back. [D]
5. Dispatch has no reliable record, so an order can be dispatched twice, an item can be missed, and invoices do not match. [D]
6. The owner cannot compute per-roll or per-order cost, or profit/loss, without manually reconciling several registers. [D]

**The system's job:** be the single source of truth that links *yarn → order → machine → fabric roll → quality result → dispatch → invoice → payment → cost*. The database must therefore be built around **traceability** (every roll links back to its order, machine, worker and yarn) and **reconciliation** (stock, dispatch and money must always add up).

---

## 2. Actors and permissions

| Actor | Documented? | What they do in the system | Access level (proposed) |
|---|---|---|---|
| Gate / store staff | [D] ("staff … gate") | Record yarn arrivals; maintain finished-goods shelf | Create receipts; view stock |
| Production manager | [D] ("manager") | Assign orders to machines; monitor floor | Manage jobs/machines; view all production |
| Machine operator / worker | [D] ("worker") | Their output and attendance are recorded against machines | Possibly record output [Q1] |
| Quality checker | [D] | Inspects each roll: pass / rework / reject; records defects | Create inspections only |
| Customer-facing staff | [D] ("any staff member") | Look up order status when buyer calls | Read-only on order status |
| Dispatch / loading staff | [D] (store + loading) | Scan/match rolls onto truck | Create dispatch records |
| Owner | [D] | Views cost, output, profit/loss | Read all financial views |
| Accounts staff | [A] | Enter bills, payments, wages | Finance write access [Q2] |
| System admin | [A] | Manage users, roles, master data | Admin |
| Buyer (external) | [D] only as the *caller* | Phones the mill; no login documented | No system access [A] |
| Supplier (external) | [D] only as the *sender* | Delivers yarn; no login documented | No system access [A] |

---

## 3. Business workflows and extracted requirements

Each requirement has an ID (FR-x.y) used for traceability in `03-entity-relationship-design.md`.

### W1 — Yarn arrives at the gate (Raw Material Management)

**Trigger:** supplier truck arrives. **Actors:** gate/store staff.

| ID | Requirement | Tag |
|---|---|---|
| FR-1.1 | Record at the gate: supplier, quantity, yarn type, colour, and the order it is for | [D] |
| FR-1.2 | Show real-time raw-material stock without a physical check | [D] |
| FR-1.3 | Automatically warn when stock is low | [D] |
| FR-1.4 | When a new order arrives, tell whether available yarn is enough or more must be bought | [D] |
| FR-1.5 | Raw material bills must be available for cost calculation (see W6) | [D] |

**Business rules / edge cases:**
- A delivery may contain several yarn types/colours → one gate visit, many line items. [A]
- Yarn may be received "for an order" or into general stock. [D says "kis order ke liye hai"; whether it can be unassigned is [Q3]]
- Stock must never go negative.
- Quantity discrepancy between challan (supplier paperwork) and what was actually received. [A, Q4]
- Low-stock threshold is per yarn type/colour combination. [A]

### W2 — Production floor, mid-shift (Machine & Order Tracking)

**Actors:** production manager, operators.

| ID | Requirement | Tag |
|---|---|---|
| FR-2.1 | Digital dashboard: which order runs on which machine and how complete it is | [D] |
| FR-2.2 | Show which machines are idle | [D] |
| FR-2.3 | Show how much fabric each machine produced (live) | [D] |
| FR-2.4 | Production traceable across shift changes (who/which shift produced what) | [D] |
| FR-2.5 | Machine breakdowns must be trackable | [D] ("machines kharab hone par") |

**Business rules / edge cases:**
- Process stages named: **spinning, weaving, dyeing**. [D]
- One order may need several stages and several machines; a machine can only run one job at a time. [A]
- A machine can break down mid-job; the job must be reassignable without losing already-produced quantity. [A]
- "How complete" needs a target quantity per order and a produced quantity — completion % is derived. [A]

### W3 — Quality control before the fabric leaves the line

**Actors:** quality checker.

| ID | Requirement | Tag |
|---|---|---|
| FR-3.1 | Each fabric roll gets a digital ID/tag linked to its order and machine | [D] |
| FR-3.2 | Quality checker records result: **passed**, **rework**, or **rejected** | [D] |
| FR-3.3 | Defects (holes, colour mismatch, bad weaving) are recorded | [D] |
| FR-3.4 | A defect must be traceable to the machine (and worker) that caused it | [D] |

**Business rules / edge cases:**
- A roll sent for rework is re-inspected; history of every inspection must be kept. [A]
- Rejected rolls must never become sellable stock.
- One roll may have several defects. [A]
- Only quality-checker role may change quality status.

### W4 — Buyer calls asking about their order

**Actors:** any staff member.

| ID | Requirement | Tag |
|---|---|---|
| FR-4.1 | Centralised order-tracking status | [D] |
| FR-4.2 | Staff can see, without visiting the floor, whether the order is in weaving, in quality check, or ready for dispatch | [D] |
| FR-4.3 | Promised/expected delivery date is available (buyer asks "kab tak deliver hoga") | [D] |

**Business rules:** order-level status is a summary of underlying production/quality/dispatch facts; it must never disagree with them (see derived data, doc 03).

### W5 — Loading the truck (Inventory & Dispatch)

**Actors:** store staff, dispatch/loading staff.

| ID | Requirement | Tag |
|---|---|---|
| FR-5.1 | Digital record of finished fabric on shelf | [D] |
| FR-5.2 | Record of what has been dispatched | [D] |
| FR-5.3 | Rolls loaded on the truck are scanned/matched through the system | [D] |
| FR-5.4 | Prevent the same order being dispatched twice and prevent missed items | [D] |
| FR-5.5 | Correct buyer, correct quantity, and a matching invoice for each dispatch | [D] |

**Business rules / edge cases:**
- A roll can be on at most one active dispatch. [A, but directly required by FR-5.4]
- Only quality-passed rolls can be dispatched.
- Partial dispatch (an order sent across several trucks) is likely. [A, Q5]
- Dispatch cancelled/abandoned mid-loading must release the rolls.

### W6 — Owner closing the books (Financial & Cost Management)

**Actors:** owner, accounts.

| ID | Requirement | Tag |
|---|---|---|
| FR-6.1 | Record raw-material expenses (from supplier bills) | [D] |
| FR-6.2 | Record worker wages, derived from digital attendance | [D] |
| FR-6.3 | Record buyer payments | [D] |
| FR-6.4 | Show cost incurred per order | [D] |
| FR-6.5 | Show output per machine | [D] |
| FR-6.6 | Show whether the factory is in profit or loss for the month | [D] |
| FR-6.7 | Show cost to produce one roll | [D] ("ek roll ko banane mein kitna kharcha") |

**Business rules / edge cases:**
- Costs must be linkable to an order (and ideally a roll). Material cost needs a valuation approach [Q6]; wages need an allocation approach [Q7].
- Payments from a buyer may cover several invoices, and one invoice may be paid in instalments. [A]
- Finance records are never silently edited; corrections are made through reversing entries.

---

## 4. Data that must be stored, retrieved, modified, deleted

| Data | Created by | Retrieved for | Modified? | Deleted? |
|---|---|---|---|---|
| Suppliers, buyers, yarn types, colours, machines, employees | Admin | Dropdowns, reports | Yes (rarely) | **No** — deactivate only |
| Yarn gate receipts + lines | Gate staff | Stock, cost, audit | Corrections only via adjustment | No |
| Stock movements | System (on receipt/issue/adjust) | Stock view, valuation | Never (append-only) | No |
| Customer orders + lines | Sales/admin [A] | Status, dispatch, cost | Quantity/date changes; status transitions | Cancel, not delete |
| Production jobs + output logs | Manager/operators | Dashboard, costing | Status; logs are append-only | No |
| Machine status events | Operators/manager | Idle view, downtime | Close an open event | No |
| Fabric rolls | System at production | Traceability, stock, dispatch | Status transitions only | No (scrap status instead) |
| QC inspections + defects | Quality checker | Traceability, rework | Never (append-only) | No |
| Dispatches + lines | Dispatch staff | Customer status, invoice match | While in draft/loading only | Cancel draft only |
| Invoices | Accounts [A] | Receivables | Draft only | Void, not delete |
| Buyer payments + allocations | Accounts | Receivables, P&L | Reversal only | No |
| Supplier bills | Accounts | Cost | Reversal only | No |
| Attendance, wage records | Supervisor/accounts | Wages, cost | Corrections with audit | No |
| Audit log | System | Investigations | Never | Only by retention policy |

**Principle:** in a manufacturing/financial system, almost nothing is physically deleted. Master data is deactivated, transactional data is cancelled/voided, and ledgers are corrected by reversing entries.

---

## 5. Expected read/write patterns

| Workflow | Write pattern | Read pattern | Frequency (assumed) |
|---|---|---|---|
| Gate entry | Few inserts/day, multi-line | Stock view | Low writes, frequent reads |
| Production logging | Periodic output entries per machine per shift | **Live dashboard** (all machines, current state) | Moderate writes, **very frequent reads** |
| Roll creation + QC | One roll + one inspection per roll | Roll lookup by ID/scan | High-ish writes (hundreds–thousands rolls/day [A]) |
| Order status lookup | none | Lookup by order no./buyer — real time, during phone calls | Frequent, must be fast |
| Dispatch loading | Scan-by-scan inserts | Roll availability check | Bursty, concurrency-sensitive |
| Finance | Daily entries | **Monthly aggregation** across orders/machines | Heavy reads but infrequent |

The key tension: **dashboards and monthly reports read across many tables, while scanning and stock updates demand fast, safe writes.** The model must serve both without a second database.

---

## 6. Business rules register

| ID | Rule | Tag |
|---|---|---|
| BR-1 | Raw-material stock cannot go negative | [A] derived from FR-1.2 |
| BR-2 | Every yarn receipt identifies supplier, yarn type, colour, quantity | [D] |
| BR-3 | Each machine runs at most one active job at a time | [A] |
| BR-4 | Every fabric roll must reference an order and the producing machine | [D] |
| BR-5 | Roll quality status is limited to: pending, passed, rework, rejected | [D] (pass/rework/reject) |
| BR-6 | Only passed rolls may be dispatched | [A] |
| BR-7 | A roll may belong to only one active dispatch (no double dispatch) | [D] via FR-5.4 |
| BR-8 | A dispatch must match one buyer and be reconcilable to an invoice | [D] |
| BR-9 | Every cost must be attributable to an order (or flagged as overhead) | [A] via FR-6.4 |
| BR-10 | Financial and stock ledgers are append-only; corrections use reversals | [A] |
| BR-11 | Order status must be consistent with production/QC/dispatch facts | [D] via FR-4.1 |

---

## 7. Sensitive data, audit, and access restrictions

| Item | Why sensitive | Requirement |
|---|---|---|
| Worker wages, attendance | Personal + financial | Restricted to accounts/owner; audited |
| Profit/loss, per-order cost | Business-confidential | Owner/accounts only |
| Buyer and supplier contact + payment data | Commercial/personal | Role-restricted |
| User credentials | Security | Hashed only; never plaintext |
| QC results and defect attribution | Can affect a worker's standing | Append-only history; who/when recorded |
| Stock adjustments, cancellations, voids | Fraud/loss risk | Mandatory reason + user + timestamp |

Not documented: bank details, tax IDs (GST/PAN) — these will appear on invoices in practice. [A, Q8]

---

## 8. Consistency and concurrency risks

| Risk | Where | Design implication (resolved in later phases) |
|---|---|---|
| Two gate staff or two orders consume the same yarn simultaneously | Stock / reservation | Atomic stock updates; ledger as source of truth |
| Same roll scanned onto two trucks | Dispatch | Database-level uniqueness on active dispatch lines |
| Roll dispatched while still in QC | Dispatch vs QC | Status checked inside the same transaction |
| Order status disagrees with reality | Customer queries | Derive status from facts, don't hand-edit |
| Duplicate submission (double-click, network retry) of gate entry or payment | All writes | Idempotency keys / unique business references |
| Cost reports mismatch stock/dispatch totals | Finance | Costs generated from the same transactions, not re-keyed |
| Shift-change overlap on a machine | Production | Output logs tied to shift + machine + job |
| Machine break down mid-job | Production | Job reassignment keeps produced history |

---

## 9. Missing information that materially affects design

See Section 11. The design proceeds with explicit assumptions so nothing blocks implementation, but the "Blocking" questions should be answered before schema finalisation (Phase 4).

---

## 10. Assumptions register

| ID | Assumption | Impact if wrong |
|---|---|---|
| A1 | Single factory (one plant, one legal entity) — not multi-tenant | Would add a tenant/plant key everywhere |
| A2 | Internal staff only use the system; buyers/suppliers have no login | Would add external user types and row-level isolation |
| A3 | Spinning, weaving, dyeing are *job stages* an order passes through on different machines | Stage routing may be fixed or flexible [Q9] |
| A4 | Fabric is tracked **per roll** (roll = unit of QC, stock, dispatch) | If tracked by lot/batch, roll table changes shape |
| A5 | Fabric quantity is measured in metres (and weight kg); yarn in kg | Units table makes this configurable |
| A6 | Rework = same roll re-inspected, not a new roll | Affects roll identity and traceability |
| A7 | Partial dispatch of an order is allowed | Affects order-dispatch relationship |
| A8 | A purchase order to the supplier may exist (PS says "supplier ko naya order dena padega") | Optional entity; can be dropped if ordering is verbal |
| A9 | Invoices are generated by this system (or at least recorded in it) | If external accounting software issues invoices, this becomes an import/match |
| A10 | Wages are computed from attendance; payroll scope is simple (daily/monthly/piece rate) | Complex statutory payroll would be a separate module |
| A11 | Volume: one plant, tens–low hundreds of machines, hundreds–few thousand rolls/day, tens of staff | Informs technology choice (doc 02) |
| A12 | Timestamps stored in UTC, displayed in IST | Convention only |

---

## 11. Open questions

### Blocking (answer before Phase 4 schema is finalised)
| # | Question | Why it matters |
|---|---|---|
| Q3 | Can yarn be received without an order (general stock) and later assigned? | Decides whether order link on receipt is optional + whether reservations are needed |
| Q6 | Material cost valuation: FIFO, weighted average, or per-lot actual cost? | Decides how yarn lots and cost entries link |
| Q7 | How are wages allocated to orders/rolls (by hours on a machine job, by shift, or only at plant level)? | Decides whether per-roll cost is exact or estimated |
| Q9 | Is the stage sequence (spinning → weaving → dyeing) fixed for every order, or order-specific? Does spinning *consume* the raw yarn, given the PS lists "yarn" as raw material? | Decides routing, bill-of-materials, and what each stage produces |
| Q1 | Who actually enters output: operators on tablets, supervisors, or automatic machine sensors? | Decides write volume and the identity recorded against production |

### Non-blocking (design works with stated assumption)
| # | Question |
|---|---|
| Q2 | Is there a separate accounts role, or does the owner do finance entry? |
| Q4 | Must received quantity be reconciled to supplier challan/PO? |
| Q5 | Are partial dispatches and multiple invoices per order allowed? |
| Q8 | Do invoices need GST/tax breakdown? |
| Q10 | Are supplier payments (outflow) tracked, or only supplier bills (cost)? |
| Q11 | Are shifts fixed (e.g. 3 × 8h) or flexible? |
| Q12 | Is there a defined defect catalogue and severity grading? |
| Q13 | Is barcode/QR scanning hardware available for roll tags? |
| Q14 | What is the retention period required for financial and quality records? |
| Q15 | Are customer calls to be logged, or is status lookup the only need? |
