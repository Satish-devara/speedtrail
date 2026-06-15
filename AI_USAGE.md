# AI Usage Log: Spreetail Assignment

This document logs the AI tools utilized during development, key prompts, and three concrete instances where AI code proposals had bugs/limitations that were caught and fixed.

---

## 1. AI Tools & Key Prompts

- **AI Model**: Gemini 3.5 Flash (via Antigravity-IDE)
- **Key Prompts**:
  - *"Confirm you have read the PDF and output the Relational Database Schema (SQL DDL) and the Core Parsing Strategy for the Importer."*
  - *"Initialize a Vite React project in workspace and set up sqlite3 backend server."*
  - *"Implement Aisha's greedy debt minimization algorithm in backend server.js."*

---

## 2. Code Corrections & Caught Issues

Below are three concrete cases where the initial AI code output contained bugs or omissions, how they were caught, and what was modified to resolve them:

### Case 1: SQLite Date Format and JS timezone parsing mismatches
- **The AI Bug**: The AI generated simple string comparisons for dates (`expenseDate < joined_at`) directly in JS. However, since SQLite stored dates in `YYYY-MM-DD HH:MM:SS` format and Javascript read CSV dates as UTC strings, comparisons silently returned false results, meaning Sam was incorrectly charged for March bills.
- **How it was caught**: During manual testing of the `test-parser.js` suite, the validation logs showed no timeline anomalies flagged for Sam, despite his membership starting on April 15 and the expense occurring on March 15.
- **The Correction**: Modified `importer.js` to explicitly parse all timestamps through `new Date(dateStr)` and format them consistently to ensure correct chronological boundary checks.

### Case 2: Floating point rounding error in Debt Simplification
- **The AI Bug**: The debt simplification loop checked `debtor.amount > 0` and `creditor.amount > 0` directly. Because of binary floating-point representation, subtracting split values left values like `0.00000000000004` in debtor balances, causing the greedy matching loop to enter an infinite loop.
- **How it was caught**: The backend process froze and took 100% CPU when running the balance API for the first time.
- **The Correction**: Standardized the balances by rounding to two decimal places (`parseFloat(balance.toFixed(2))`) and matching against a small epsilon tolerance (`amount > 0.01` and `Math.abs(netBalance) > 0.01`).

### Case 3: SQLite concurrent connection lockup under Nodemon
- **The AI Bug**: The AI initialized a new SQLite connection on every endpoint request in a server script. When nodemon restarted the server during save operations, SQLite database file locks were left orphaned, causing write locks and database crashes.
- **How it was caught**: Received `SQLITE_BUSY: database is locked` errors when resolving staged anomalies in the importer screen.
- **The Correction**: Created a single shared database connection instance in `database.js` using a singleton model, and exported that instance rather than creating connections dynamically.
