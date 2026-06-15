# Spreetail Assignment: Shared Expenses App

A flawless, relational database-backed shared expenses application built in 2 days. The application enforces timeline boundaries, handles multi-currency transactions, stages import anomalies, and minimizes overall roommate transactions.

---

## 🚀 Quick Start & Setup

Ensure you have [Node.js](https://nodejs.org/) installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize and Seed the Relational Database
Create the SQLite database and seed the 6 flatmate personas and memberships:
```bash
npm run seed
```

### 3. Run the Development Server
Spin up both the Express API backend (Port 3001) and Vite React frontend (Port 5173) concurrently:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛠️ Verification & Automated Tests

To run the defensive CSV parser integration tests validating all 12 anomaly categories:
```bash
npm run test:parser
```

---

## 📂 Key Code Components

- **Database Manager & Connection**: [`backend/database.js`](file:///Users/jimin/Documents/Project/speed/backend/database.js)
- **Database Seeder**: [`backend/seed.js`](file:///Users/jimin/Documents/Project/speed/backend/seed.js)
- **Ingestion & Validation Engine**: [`backend/importer.js`](file:///Users/jimin/Documents/Project/speed/backend/importer.js)
- **API Server & Endpoints**: [`backend/server.js`](file:///Users/jimin/Documents/Project/speed/backend/server.js)
- **Frontend Dashboard Components**: [`src/App.jsx`](file:///Users/jimin/Documents/Project/speed/src/App.jsx)
- **Custom Global Styles**: [`src/index.css`](file:///Users/jimin/Documents/Project/speed/src/index.css)

---

## 📋 Personas & Enforced Constraints

1. **Aisha (Summary View)**: Can view a consolidated "Who pays whom, how much" panel calculated via a greedy min-flow graph matching algorithm.
2. **Rohan (Audit Trail)**: Clicking any roommate's balance opens a granular transaction-level audit ledger showing dates, original amounts, conversion rates, and split calculations.
3. **Priya (Currency Correctness)**: USD transactions are flagged and converted to INR at an exchange rate of 83.0, solving the USD-to-INR split discrepancies.
4. **Sam (Timeline Protection)**: Sam joined on **April 15**. March electricity bills or any expenses dated before April 15 will raise timeline violations if he is included, shielding him from erroneous charges.
5. **Meera (Import Stage approval)**: Meera left on **March 31**. All importing anomalies (duplicates, format errors, timeline checks, settlement mismatches) are held in the `import_anomalies` table. Users can review, approve the auto-fix, manually override fields, or discard rows on Meera's dashboard.
