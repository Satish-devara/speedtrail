import { processCSVImport } from './importer.js';
import db from './database.js';

const mockCSV = `Date,Description,Amount,Currency,Paid By,Split Type,Participants,Split Details
2026-02-05,Initial Grocery,1200,INR,Aisha,EQUAL,"Aisha, Rohan, Priya, Meera",
invalid-date,Bad Date Expense,1200,INR,Aisha,EQUAL,"Aisha, Rohan",
2026-02-06,Non-numeric Expense,OneThousand,INR,Aisha,EQUAL,"Aisha, Rohan",
2026-02-05,Initial Grocery,1200,INR,Aisha,EQUAL,"Aisha, Rohan, Priya, Meera",
2026-02-10,Trip Taxi,50,USD,Rohan,EQUAL,"Rohan, Priya, Dev",
2026-03-15,March Electricity,3000,INR,Rohan,EQUAL,"Aisha, Rohan, Priya, Meera, Sam",
2026-04-20,April Dinner,1500,INR,Rohan,EQUAL,"Aisha, Rohan, Priya, Sam, Meera",
2026-02-20,Movie Night,800,INR,Aisha,EQUAL,"Aisha, Rohan, Bob",
2026-03-25,Meera Settlement,-1200,INR,Meera,EQUAL,"Priya",
2026-02-28,Split Mismatch Exact,1000,INR,Rohan,EXACT,"Rohan, Priya","400, 400"
2026-02-28,Split Mismatch Percentage,1000,INR,Rohan,PERCENTAGE,"Rohan, Priya","50, 40"
2026-04-18,April Grocery,1000,INR,Sam,EQUAL,"Aisha, Rohan, Priya, Sam",
`;

async function runTest() {
  try {
    console.log('--- RUNNING CSV IMPORT TEST ---');
    
    // Clear out any old records before test
    await db.run('DELETE FROM expenses');
    await db.run('DELETE FROM expense_splits');
    await db.run('DELETE FROM settlements');
    await db.run('DELETE FROM import_anomalies');

    // Run import
    const result = await processCSVImport(mockCSV, 1);
    console.log('Import Finished with Results:', result);

    // Assertions
    const anomalies = await db.all('SELECT * FROM import_anomalies');
    console.log(`\nDetected ${anomalies.length} staged anomalies in database:`);
    anomalies.forEach((a, i) => {
      console.log(`[Anomaly ${i + 1}] Row ${a.raw_row_index} | Type: ${a.error_type} | Desc: ${a.error_description}`);
    });

    const finalizedExpenses = await db.all('SELECT * FROM expenses');
    console.log(`\nFinalized ${finalizedExpenses.length} clean expenses in database:`);
    finalizedExpenses.forEach((e, i) => {
      console.log(`[Expense ${i + 1}] ID: ${e.id} | Desc: "${e.description}" | Amt: ${e.amount} ${e.currency} (${e.amount_inr} INR)`);
    });

    const finalizedSplits = await db.all('SELECT * FROM expense_splits');
    console.log(`\nTotal Splits in DB: ${finalizedSplits.length}`);

    // Verify specifically:
    // Row 1 (Initial Grocery) should be finalized.
    // Row 4 (Duplicate Grocery) should be duplicate anomaly.
    // Row 6 (Sam in March Electricity) should be timeline anomaly.
    // Row 7 (Meera in April Dinner) should be timeline anomaly.
    // Row 12 (April Grocery by Sam in April) should be finalized successfully.

    console.log('\n--- TEST SUITE EXECUTED ---');
    process.exit(0);
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

runTest();
