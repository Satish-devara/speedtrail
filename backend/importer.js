import db from './database.js';

// Clean and parse CSV line safely, accounting for quotes and commas
export function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Parses raw CSV text into objects
export function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_]+/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      // Map columns dynamically
      row[header] = values[index] || '';
    });
    rows.push({
      rowIndex: i,
      rawLine: lines[i],
      data: row
    });
  }

  return rows;
}

// Main Ingestion and Validation Engine
export async function processCSVImport(csvContent, groupId) {
  const rows = parseCSV(csvContent);
  let totalProcessed = 0;
  let anomaliesCount = 0;
  let successCount = 0;

  // Clear previous anomalies for a clean import
  await db.run('DELETE FROM import_anomalies');

  for (const rowObj of rows) {
    const { rowIndex, rawLine, data } = rowObj;
    totalProcessed++;

    // Standardize column values
    const dateStr = data.date || '';
    const description = data.description || '';
    const amountStr = data.amount || '';
    const currency = (data.currency || 'INR').toUpperCase();
    const paidByName = data.paidby || data.paidbyuser || '';
    const splitType = (data.splittype || 'EQUAL').toUpperCase();
    const participantsStr = data.participants || '';
    const splitDetailsStr = data.splitdetails || '';

    const anomalies = [];
    const proposedFix = {
      action: 'NONE',
      rowDetails: {
        group_id: groupId,
        description,
        currency,
        exchange_rate_to_inr: 1.0,
        split_type: splitType,
        expense_date: dateStr
      }
    };

    // 1. Validate Date format
    let expenseDate = new Date(dateStr);
    if (!dateStr || isNaN(expenseDate.getTime())) {
      anomalies.push({
        type: 'FORMAT_INCONSISTENCY',
        description: `Invalid date format: "${dateStr}"`
      });
      // Fallback proposed date
      proposedFix.rowDetails.expense_date = new Date().toISOString().split('T')[0];
    }

    // 2. Validate Amount format
    let amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      anomalies.push({
        type: 'FORMAT_INCONSISTENCY',
        description: `Non-numeric amount: "${amountStr}"`
      });
      amount = 0;
      proposedFix.rowDetails.amount = 0;
    } else {
      proposedFix.rowDetails.amount = amount;
    }

    // 3. Handle Negative Amounts (Refund vs Settlement vs Error)
    let isSettlement = false;
    let isRefund = false;
    if (amount < 0) {
      if (description.toLowerCase().includes('settle') || description.toLowerCase().includes('payment')) {
        isSettlement = true;
        anomalies.push({
          type: 'SETTLEMENT_LOGGED_AS_EXPENSE',
          description: `Settlement logged as expense: "${description}" with negative amount ${amount}. Should be record of settlement.`,
          proposedFix: {
            action: 'CONVERT_TO_SETTLEMENT',
            from: participantsStr.split(',')[0]?.trim(), // guess payer from split
            to: paidByName,
            amount: Math.abs(amount)
          }
        });
      } else {
        isRefund = true;
        anomalies.push({
          type: 'NEGATIVE_AMOUNT',
          description: `Negative amount ${amount} detected. Treated as a refund.`,
          proposedFix: {
            action: 'TREAT_AS_REFUND',
            amount: Math.abs(amount)
          }
        });
      }
    }

    // 4. Validate Payer existence in Database
    let paidByUser = null;
    if (!paidByName) {
      anomalies.push({
        type: 'FORMAT_INCONSISTENCY',
        description: `Missing "Paid By" field`
      });
    } else {
      paidByUser = await db.get('SELECT id, name FROM users WHERE LOWER(name) = ?', [paidByName.toLowerCase()]);
      if (!paidByUser) {
        anomalies.push({
          type: 'UNKNOWN_USER',
          description: `Payer user "${paidByName}" is not in the system`
        });
        // Propose fuzzy match/creation
        proposedFix.rowDetails.paid_by_name = paidByName;
      } else {
        proposedFix.rowDetails.paid_by_user_id = paidByUser.id;
      }
    }

    // 5. Currency Check and Priya's Dollar to Rupee conversion check
    let exchangeRate = 1.0;
    if (currency === 'USD') {
      exchangeRate = 83.0; // default rate
      proposedFix.rowDetails.exchange_rate_to_inr = exchangeRate;
      
      // Priya's complaint: "The sheet pretends a dollar is a rupee. That can't be right."
      // If we import USD directly without conversion, splits are wrong. We flag and propose conversion.
      anomalies.push({
        type: 'CURRENCY_MISMATCH',
        description: `USD transaction detected: "${description}". The sheet may treat USD as INR. Proposed: convert USD to INR at rate of ${exchangeRate}.`,
        proposedFix: {
          action: 'CONVERT_CURRENCY',
          exchangeRate: exchangeRate,
          amount_inr: Math.abs(amount) * exchangeRate
        }
      });
    }

    // 6. Validate Participants & Memberships (Timeline violations)
    const participantNames = participantsStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
    const parsedParticipants = [];
    
    if (participantNames.length === 0) {
      anomalies.push({
        type: 'FORMAT_INCONSISTENCY',
        description: `No participants specified for expense`
      });
    } else {
      for (const name of participantNames) {
        const user = await db.get('SELECT id, name FROM users WHERE LOWER(name) = ?', [name.toLowerCase()]);
        if (!user) {
          anomalies.push({
            type: 'UNKNOWN_USER',
            description: `Participant "${name}" is not in the system`
          });
          continue;
        }

        parsedParticipants.push(user);

        // Timeline validation: Is user active in the group on the expense date?
        if (!isNaN(expenseDate.getTime())) {
          const membership = await db.get(
            `SELECT joined_at, left_at FROM group_memberships WHERE group_id = ? AND user_id = ?`,
            [groupId, user.id]
          );

          if (!membership) {
            anomalies.push({
              type: 'TIMELINE_VIOLATION',
              description: `User "${user.name}" is not a member of the group`
            });
          } else {
            const joined = new Date(membership.joined_at);
            const left = membership.left_at ? new Date(membership.left_at) : null;

            if (expenseDate < joined || (left && expenseDate > left)) {
              anomalies.push({
                type: 'TIMELINE_VIOLATION',
                description: `Timeline Violation: "${user.name}" was not in the group on ${dateStr} (Joined: ${membership.joined_at.split(' ')[0]}, Left: ${membership.left_at ? membership.left_at.split(' ')[0] : 'Present'})`
              });
              // Propose excluding user from split or shifting date
              if (!proposedFix.excludeUsers) {
                proposedFix.excludeUsers = [];
              }
              proposedFix.excludeUsers.push(user.id);
            }
          }
        }
      }
    }

    // Check Payer timeline as well
    if (paidByUser && !isNaN(expenseDate.getTime())) {
      const payerMembership = await db.get(
        `SELECT joined_at, left_at FROM group_memberships WHERE group_id = ? AND user_id = ?`,
        [groupId, paidByUser.id]
      );
      if (payerMembership) {
        const joined = new Date(payerMembership.joined_at);
        const left = payerMembership.left_at ? new Date(payerMembership.left_at) : null;
        if (expenseDate < joined || (left && expenseDate > left)) {
          anomalies.push({
            type: 'TIMELINE_VIOLATION',
            description: `Timeline Violation: Payer "${paidByUser.name}" was not in the group on ${dateStr}`
          });
        }
      }
    }

    // 7. Validate Split Math
    const splitValues = splitDetailsStr.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s));
    proposedFix.rowDetails.participants = participantNames;
    proposedFix.rowDetails.split_details = splitValues;

    if (splitType === 'EXACT' || splitType === 'PERCENTAGE' || splitType === 'SHARES') {
      if (splitValues.length !== participantNames.length) {
        anomalies.push({
          type: 'SPLIT_MISMATCH',
          description: `Count mismatch: splits count (${splitValues.length}) does not match participants (${participantNames.length})`
        });
      } else {
        const sumSplits = splitValues.reduce((a, b) => a + b, 0);
        if (splitType === 'EXACT') {
          if (Math.abs(sumSplits - Math.abs(amount)) > 0.05) {
            anomalies.push({
              type: 'SPLIT_MISMATCH',
              description: `Split total mismatch: Sum of splits is ${sumSplits} but expense amount is ${Math.abs(amount)}`
            });
            proposedFix.rowDetails.split_type = 'EQUAL'; // fall back to equal
          }
        } else if (splitType === 'PERCENTAGE') {
          if (Math.abs(sumSplits - 100) > 0.05) {
            anomalies.push({
              type: 'SPLIT_MISMATCH',
              description: `Split percentage mismatch: Sum of splits is ${sumSplits}% (should be 100%)`
            });
            proposedFix.rowDetails.split_type = 'EQUAL';
          }
        }
      }
    }

    // 8. Duplicate Detection (Same description, amount, date and paid_by)
    if (!isNaN(amount) && !isNaN(expenseDate.getTime()) && paidByUser) {
      const dateOnlyStr = dateStr.split(' ')[0] + '%';
      const duplicate = await db.get(
        `SELECT id, description, amount, expense_date FROM expenses 
         WHERE description = ? AND ABS(amount - ?) < 0.05 AND expense_date LIKE ? AND paid_by_user_id = ?`,
        [description, Math.abs(amount), dateOnlyStr, paidByUser.id]
      );
      if (duplicate) {
        anomalies.push({
          type: 'DUPLICATE_ENTRY',
          description: `Duplicate of expense "${duplicate.description}" (ID: ${duplicate.id}, Amount: ${duplicate.amount})`
        });
        proposedFix.action = 'DISCARD_ROW';
      }
    }

    // Check duplicate within the importing CSV file itself (e.g. two identical entries)
    // We handle it gracefully by letting users decide which one wins.

    // 9. Ingest Action based on validation outcomes
    if (anomalies.length > 0) {
      anomaliesCount++;
      // Stage the anomaly
      await db.run(
        `INSERT INTO import_anomalies (raw_row_index, raw_data, error_type, error_description, proposed_fix, status) 
         VALUES (?, ?, ?, ?, ?, 'PENDING_REVIEW')`,
        [
          rowIndex,
          JSON.stringify(data),
          anomalies[0].type,
          anomalies.map(a => a.description).join(' | '),
          JSON.stringify(proposedFix)
        ]
      );
    } else {
      successCount++;
      // Finalize and insert expense directly
      await insertFinalizedExpense(groupId, paidByUser.id, description, amount, currency, exchangeRate, expenseDate, splitType, participantNames, splitValues);
    }
  }

  return {
    totalProcessed,
    anomaliesCount,
    successCount
  };
}

// Writes finalized clean expenses and their splits to the DB
export async function insertFinalizedExpense(groupId, paidByUserId, description, amount, currency, exchangeRate, expenseDate, splitType, participants, splitDetails) {
  const amountInr = amount * exchangeRate;
  
  // 1. Insert into expenses table
  const expenseResult = await db.run(
    `INSERT INTO expenses (group_id, paid_by_user_id, description, amount, currency, exchange_rate_to_inr, amount_inr, expense_date, split_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FINALIZED')`,
    [
      groupId,
      paidByUserId,
      description,
      amount,
      currency,
      exchangeRate,
      amountInr,
      expenseDate.toISOString(),
      splitType
    ]
  );
  
  const expenseId = expenseResult.id;

  // 2. Fetch users representing the participants
  const participantUsers = [];
  for (const name of participants) {
    const user = await db.get('SELECT id FROM users WHERE LOWER(name) = ?', [name.toLowerCase()]);
    if (user) participantUsers.push(user);
  }

  // 3. Compute splits calculated_amount_inr based on split_type
  const splitCalculations = [];
  if (splitType === 'EQUAL') {
    const shareInr = amountInr / participantUsers.length;
    participantUsers.forEach(u => {
      splitCalculations.push({ userId: u.id, value: 0, amountInr: shareInr });
    });
  } else if (splitType === 'EXACT') {
    participantUsers.forEach((u, i) => {
      const val = splitDetails[i] || 0;
      splitCalculations.push({ userId: u.id, value: val, amountInr: val * exchangeRate });
    });
  } else if (splitType === 'PERCENTAGE') {
    participantUsers.forEach((u, i) => {
      const pct = splitDetails[i] || 0;
      const shareInr = (amountInr * pct) / 100;
      splitCalculations.push({ userId: u.id, value: pct, amountInr: shareInr });
    });
  } else if (splitType === 'SHARES') {
    const totalShares = splitDetails.reduce((a, b) => a + b, 0);
    participantUsers.forEach((u, i) => {
      const sh = splitDetails[i] || 0;
      const shareInr = totalShares > 0 ? (amountInr * sh) / totalShares : 0;
      splitCalculations.push({ userId: u.id, value: sh, amountInr: shareInr });
    });
  }

  // 4. Save splits into database
  for (const split of splitCalculations) {
    await db.run(
      `INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr)
       VALUES (?, ?, ?, ?)`,
      [expenseId, split.userId, split.value, split.amountInr]
    );
  }
}
