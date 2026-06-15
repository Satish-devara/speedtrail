# Scope & Anomaly Log: Spreetail Assignment

This file outlines the database schema design and details the 12 deliberate CSV data problems identified in the `expenses_export.csv` file, along with their detection logic and chosen resolution policies.

---

## 1. Database Schema

The database architecture is designed as a relational schema (implemented in SQLite3) containing strict timeline triggers, multi-currency conversion support, and a staging mechanism for reviewing anomalies.

### Schema DDL Structure

- **`users`**: Represents the roommates and trip participants.
  - `id` (INTEGER, Primary Key)
  - `name` (VARCHAR, Unique)
  - `email` (VARCHAR, Unique)
  - `created_at` (TIMESTAMP)

- **`groups`**: Supports multiple rooms or trips.
  - `id` (INTEGER, Primary Key)
  - `name` (VARCHAR)
  - `description` (TEXT)
  - `created_at` (TIMESTAMP)

- **`group_memberships`**: Handles rooming timelines. Contains strict join/leave dates to handle member transitions.
  - `id` (INTEGER, Primary Key)
  - `group_id` (INTEGER, Foreign Key)
  - `user_id` (INTEGER, Foreign Key)
  - `joined_at` (TIMESTAMP, Not Null)
  - `left_at` (TIMESTAMP, Nullable)
  - *Constraints*: Enforces `left_at >= joined_at` to prevent chronological corruption.

- **`expenses`**: Holds clean, finalized split expenses.
  - `id` (INTEGER, Primary Key)
  - `group_id` (INTEGER, Foreign Key)
  - `paid_by_user_id` (INTEGER, Foreign Key)
  - `description` (VARCHAR)
  - `amount` (DECIMAL, original transaction amount)
  - `currency` (VARCHAR, original currency: USD or INR)
  - `exchange_rate_to_inr` (DECIMAL, default 1.0)
  - `amount_inr` (DECIMAL, pre-converted total in INR for quick ledger querying)
  - `expense_date` (TIMESTAMP)
  - `split_type` (VARCHAR: EQUAL, EXACT, PERCENTAGE, SHARES)
  - `status` (VARCHAR: PENDING_REVIEW, FINALIZED)

- **`expense_splits`**: Connects individual users to their proportional share of a finalized expense.
  - `id` (INTEGER, Primary Key)
  - `expense_id` (INTEGER, Foreign Key)
  - `user_id` (INTEGER, Foreign Key)
  - `split_value` (DECIMAL, share weight, percentage, or exact amount depending on parent split type)
  - `calculated_amount_inr` (DECIMAL, calculated share in INR)

- **`settlements`**: Tracks debt payments between roommates separate from raw expense shares.
  - `id` (INTEGER, Primary Key)
  - `group_id` (INTEGER, Foreign Key)
  - `from_user_id` (INTEGER, Foreign Key)
  - `to_user_id` (INTEGER, Foreign Key)
  - `amount` (DECIMAL)
  - `currency` (VARCHAR)
  - `exchange_rate_to_inr` (DECIMAL)
  - `amount_inr` (DECIMAL)
  - `settled_date` (TIMESTAMP)

- **`import_anomalies`**: Staging table for holding flagged rows pending user approval or override.
  - `id` (INTEGER, Primary Key)
  - `raw_row_index` (INTEGER)
  - `raw_data` (TEXT, raw JSON row payload)
  - `error_type` (VARCHAR)
  - `error_description` (TEXT)
  - `proposed_fix` (TEXT, JSON blueprint of resolution)
  - `status` (VARCHAR: PENDING_REVIEW, APPROVED, IGNORED, RESOLVED)
  - `resolved_at` (TIMESTAMP)
  - `resolved_by_user_id` (INTEGER)

---

## 2. CSV Anomaly Log

Below are the 12 categories of deliberate data discrepancies identified in `expenses_export.csv` and how the application handles them:

| # | Anomaly Type | CSV Example / Symptom | Detection Logic | Resolution Policy / Fix |
|---|---|---|---|---|
| **1** | **Duplicate Expense (Exact)** | Same grocery receipt imported twice | Check database for existing finalized expense matching date, description, amount, and payer. | Stage row in anomalies. Propose discarding duplicate row (`DISCARD_ROW`). |
| **2** | **Duplicate Expense (Varying Amounts)** | Dinner logged by two people with slightly different amounts | Check for overlapping dates and description keywords (e.g. "Dinner"). | Stage row. Require manual override to choose which amount wins. |
| **3** | **Timeline Violation (Sam in March)** | March Electricity split charges Sam | Compare expense date (`2026-03-15`) to Sam's group membership `joined_at` (`2026-04-15`). | Flag timeline error. Propose excluding Sam from the split and redistributing share among active members. |
| **4** | **Timeline Violation (Meera in April)** | April Snacks split charges Meera | Compare expense date (`2026-04-20`) to Meera's membership `left_at` (`2026-03-31`). | Flag timeline error. Propose excluding Meera and resplitting among active members. |
| **5** | **Timeline Violation (Dev outside Trip)** | Trip Taxi in February charges Dev (membership starts Feb 15) | Compare expense date to Dev's active membership window (`2026-02-15` to `2026-03-15`). | Flag timeline error. Propose excluding Dev. |
| **6** | **Currency Mismatch (Treating USD as INR)** | Dev's trip taxi in USD split directly into INR | Check if currency is `USD` but splits sum to original USD value without conversion rate. | Flag currency bug. Propose applying conversion rate (e.g. 1 USD = 83 INR) and converting amount to INR. |
| **7** | **Negative Values (Settlements as Expenses)** | Row contains "-1200 INR" with description "Meera settled with Priya" | Check if amount is negative and description contains words like "settle" or "payment". | Flag settlement log. Propose shifting row into the `settlements` table rather than the `expenses` table. |
| **8** | **Negative Values (Refunds)** | Row contains "-400 INR" for returned item | Amount < 0 without settlement description. | Flag negative expense. Propose treating it as a refund (applying negative splits to reduce balances). |
| **9** | **Incorrect split math (Exact)** | Total expense 1000, splits are 400 and 400 | For `EXACT` split type, sum of splits != total expense amount. | Flag split mismatch. Propose equalizing split pro-rata. |
| **10** | **Incorrect split math (Percentage)** | Splits sum to 90% instead of 100% | For `PERCENTAGE` split type, sum of percentages != 100. | Flag percentage mismatch. Propose reverting split model to `EQUAL`. |
| **11** | **Format Inconsistency (Date)** | Date column contains "invalid-date" or text | Attempt to instantiate a JS Date. Flag if `isNaN(date.getTime())`. | Stage row. Propose using current import date as fallback, or require manual override. |
| **12** | **Format Inconsistency (Amount)** | Amount column contains text "OneThousand" | Parse amount. Flag if `isNaN(parseFloat(amount))`. | Stage row. Require manual override to specify numeric amount. |
| **13** | **Unknown User Reference** | Participant list contains "Bob" | Check if participant name is missing from the `users` table. | Flag unknown user. Require manual mapping to a valid user or creation of a new user. |
