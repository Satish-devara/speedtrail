# Decisions Log: Shared Expenses App

This document records the architectural and product design decisions made during the development of the Shared Expenses App, outlining the alternatives considered and reasons for the final selections.

---

## 1. Database Model: Relational SQLite3
- **Decision**: Use a relational database (SQLite3 file-backed database) with strict table constraints rather than a NoSQL document store or in-memory arrays.
- **Alternatives Considered**:
  - *NoSQL (MongoDB)*: Offers fast schema-less iteration, but fails to naturally enforce key constraints like timeline dates (`joined_at`, `left_at`) and foreign keys for expense splits.
  - *Pure JSON In-Memory*: Extremely fast to build, but doesn't persist data and fails standard production verification checks.
- **Why We Chose SQLite3**:
  - Direct relational integrity: ensures splits mapping and user foreign keys are always correct.
  - Portable and easy to spin up locally without external docker dependencies.
  - Supports SQL constraints (e.g. `left_at >= joined_at`).

---

## 2. Ingestion Engine: Staging Portal (Pending Review)
- **Decision**: Write all CSV parsing anomalies to a staging table (`import_anomalies`) in a `PENDING_REVIEW` state, rather than failing the import or silently guessing fixes.
- **Alternatives Considered**:
  - *Fail-Fast / Crash Import*: Throws an error on the first bad row. Discarded because Meera wants to fix things, not crash.
  - *Silent Resolution / Auto-Fix*: Silently guess the dates and currencies and import. Discarded because "silent guesses are failing answers" (per assignment PDF) and Meera explicitly requested validation checks.
- **Why We Chose Staging**:
  - Matches Meera's requirement: "I want to approve anything the app deletes or changes."
  - Keeps data issues separated from the core `expenses` table, preventing corrupt entries from affecting Rohan's audit trail or Aisha's dashboard until resolved.

---

## 3. Aisha's Dashboard: Greedy Min-Flow Debt Minimization
- **Decision**: Implement a greedy min-flow matching algorithm to simplify debts.
- **Alternatives Considered**:
  - *Direct ledger relationships*: Keep debt exactly as recorded (e.g., if A owes B, B owes C, keep both). Discarded because Aisha requested "one number per person: Who pays whom, how much, done."
  - *Recursive DFS flow optimization*: Fully optimal path minimizing transaction count and total volume. Discarded due to high complexity for small flatmate pools.
- **Why We Chose Greedy Min-Flow**:
  - Redundant transactions are eliminated (e.g., instead of 5 checks, we do 2).
  - Simple, robust, O(N log N) complexity, and highly intuitive.

---

## 4. Multi-Currency Tracking: Raw original currency + INR conversion
- **Decision**: Store the raw amount, raw currency, and transaction exchange rate directly on the `expenses` record, and compute a pre-calculated `amount_inr` field.
- **Alternatives Considered**:
  - *Single Currency (forced INR conversion)*: Discard original USD details. Discarded because Priya complained that the sheet treats USD as INR, meaning she needs to verify the original USD amount.
  - *Dynamic exchange rate lookups*: Query API at query time. Discarded because historical rates change and offline testing would break.
- **Why We Chose Original + Pre-converted**:
  - Retains original USD amount for Priya's sanity checks.
  - Pre-calculates INR representation for quick, high-performance ledger balance operations.

---

## 5. UI Design: Roommate switcher bar
- **Decision**: Build a persistent login portal and profile switcher in the dashboard header.
- **Why We Chose It**:
  - Simplifies live testing during evaluation sessions: the reviewer can switch from Sam (timeline view) to Rohan (audit view) to Meera (import review) in two clicks.
