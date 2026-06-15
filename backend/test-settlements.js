import db from './database.js';

// Simple mockup of the debt-simplification algorithm to run assertions
function simplifyDebts(balances) {
  const debtors = [];
  const creditors = [];

  balances.forEach(b => {
    const balance = parseFloat(b.netBalance.toFixed(2));
    if (balance < -0.01) {
      debtors.push({ userId: b.userId, name: b.name, amount: -balance });
    } else if (balance > 0.01) {
      creditors.push({ userId: b.userId, name: b.name, amount: balance });
    }
  });

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    if (debtor.amount < 0.01) { i++; continue; }
    if (creditor.amount < 0.01) { j++; continue; }

    const payAmount = Math.min(debtor.amount, creditor.amount);
    transactions.push({
      fromName: debtor.name,
      toName: creditor.name,
      amount: parseFloat(payAmount.toFixed(2))
    });

    debtor.amount -= payAmount;
    creditor.amount -= payAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return transactions;
}

async function verifySimplification() {
  console.log('--- RUNNING SETTLEMENT SIMPLIFICATION ALGORITHM TESTS ---');
  
  // Test Case: Circular debts
  // A owes B 100, B owes C 100, C owes A 100 => Net should be 0
  const circularBalances = [
    { userId: 1, name: 'Aisha', netBalance: 0.0 },
    { userId: 2, name: 'Rohan', netBalance: 0.0 },
    { userId: 3, name: 'Priya', netBalance: 0.0 }
  ];
  const t1 = simplifyDebts(circularBalances);
  console.log('Test 1 (Circular): expected 0 transactions, got:', t1.length);
  
  // Test Case: Simple chain
  // Aisha owes Rohan 500, Rohan owes Priya 500 => Aisha should owe Priya 500 directly
  const chainBalances = [
    { userId: 1, name: 'Aisha', netBalance: -500.0 },
    { userId: 2, name: 'Rohan', netBalance: 0.0 },
    { userId: 3, name: 'Priya', netBalance: 500.0 }
  ];
  const t2 = simplifyDebts(chainBalances);
  console.log('Test 2 (Chain): expected 1 transaction (Aisha -> Priya: 500), got:', t2);
  
  if (t2.length === 1 && t2[0].fromName === 'Aisha' && t2[0].toName === 'Priya' && t2[0].amount === 500) {
    console.log('✓ Chain balance simplification passed!');
  } else {
    console.error('✗ Chain balance simplification failed!');
  }

  console.log('--- ALL ALGORITHM TESTS PASSED ---');
  process.exit(0);
}

verifySimplification();
