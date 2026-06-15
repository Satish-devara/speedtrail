import express from 'express';
import cors from 'cors';
import multer from 'multer';
import db from './database.js';
import { processCSVImport, insertFinalizedExpense } from './importer.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Set up file uploads for CSV import
const upload = multer({ storage: multer.memoryStorage() });

// --- UTILITIES ---

// Debt Simplification Algorithm
function simplifyDebts(balances) {
  // balances: array of { userId, name, netBalance }
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

  // Greedy matching
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    if (debtor.amount < 0.01) {
      i++;
      continue;
    }
    if (creditor.amount < 0.01) {
      j++;
      continue;
    }

    const payAmount = Math.min(debtor.amount, creditor.amount);
    transactions.push({
      fromId: debtor.userId,
      fromName: debtor.name,
      toId: creditor.userId,
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

// --- API ENDPOINTS ---

// 1. Get users
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.all('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get groups
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await db.all('SELECT * FROM groups');
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Group Balance Summary (with Net Balance & Simplified Debts for Aisha)
app.get('/api/groups/:groupId/summary', async (req, res) => {
  const { groupId } = req.params;
  try {
    // A. Fetch all members of the group
    const members = await db.all(
      `SELECT u.id, u.name, m.joined_at, m.left_at 
       FROM users u 
       JOIN group_memberships m ON u.id = m.user_id 
       WHERE m.group_id = ?`,
      [groupId]
    );

    // B. Calculate paid amount in INR for each member
    const paidResults = await db.all(
      `SELECT paid_by_user_id, SUM(amount_inr) as total_paid 
       FROM expenses 
       WHERE group_id = ? AND status = 'FINALIZED'
       GROUP BY paid_by_user_id`,
      [groupId]
    );
    const paidMap = {};
    paidResults.forEach(r => { paidMap[r.paid_by_user_id] = r.total_paid; });

    // C. Calculate owed amount in INR for each member
    const owedResults = await db.all(
      `SELECT s.user_id, SUM(s.calculated_amount_inr) as total_owed 
       FROM expense_splits s
       JOIN expenses e ON s.expense_id = e.id
       WHERE e.group_id = ? AND e.status = 'FINALIZED'
       GROUP BY s.user_id`,
      [groupId]
    );
    const owedMap = {};
    owedResults.forEach(r => { owedMap[r.user_id] = r.total_owed; });

    // D. Calculate settlements sent and received in INR
    const sentResults = await db.all(
      `SELECT from_user_id, SUM(amount_inr) as total_sent 
       FROM settlements 
       WHERE group_id = ?
       GROUP BY from_user_id`,
      [groupId]
    );
    const sentMap = {};
    sentResults.forEach(r => { sentMap[r.from_user_id] = r.total_sent; });

    const receivedResults = await db.all(
      `SELECT to_user_id, SUM(amount_inr) as total_received 
       FROM settlements 
       WHERE group_id = ?
       GROUP BY to_user_id`,
      [groupId]
    );
    const receivedMap = {};
    receivedResults.forEach(r => { receivedMap[r.to_user_id] = r.total_received; });

    // E. Assemble net balance sheet
    const balances = members.map(member => {
      const paid = paidMap[member.id] || 0;
      const owed = owedMap[member.id] || 0;
      const sent = sentMap[member.id] || 0;
      const received = receivedMap[member.id] || 0;
      
      const netBalance = paid - owed + sent - received;

      return {
        userId: member.id,
        name: member.name,
        joinedAt: member.joined_at,
        leftAt: member.left_at,
        totalPaid: paid,
        totalOwed: owed,
        totalSent: sent,
        totalReceived: received,
        netBalance: parseFloat(netBalance.toFixed(2))
      };
    });

    // F. Compute simplified debts using min-flow match
    const simplifiedDebts = simplifyDebts(balances);

    res.json({
      groupId: parseInt(groupId),
      balances,
      simplifiedDebts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get User Audit Trail (Rohan's detail panel)
app.get('/api/users/:userId/audit/:groupId', async (req, res) => {
  const { userId, groupId } = req.params;
  try {
    const user = await db.get('SELECT name FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // A. Fetch expenses paid by this user
    const paidExpenses = await db.all(
      `SELECT id, description, amount, currency, exchange_rate_to_inr, amount_inr, expense_date 
       FROM expenses 
       WHERE group_id = ? AND paid_by_user_id = ? AND status = 'FINALIZED'`,
      [groupId, userId]
    );

    // B. Fetch expenses split (owed) by this user
    const splitExpenses = await db.all(
      `SELECT e.id, e.description, e.amount, e.currency, e.exchange_rate_to_inr, e.amount_inr, e.expense_date, 
              s.split_value, s.calculated_amount_inr, u.name as paid_by_name
       FROM expense_splits s
       JOIN expenses e ON s.expense_id = e.id
       JOIN users u ON e.paid_by_user_id = u.id
       WHERE e.group_id = ? AND s.user_id = ? AND e.status = 'FINALIZED'`,
      [groupId, userId]
    );

    // C. Fetch settlements sent by this user
    const sentSettlements = await db.all(
      `SELECT s.id, s.amount, s.currency, s.exchange_rate_to_inr, s.amount_inr, s.settled_date, u.name as to_name
       FROM settlements s
       JOIN users u ON s.to_user_id = u.id
       WHERE s.group_id = ? AND s.from_user_id = ?`,
      [groupId, userId]
    );

    // D. Fetch settlements received by this user
    const receivedSettlements = await db.all(
      `SELECT s.id, s.amount, s.currency, s.exchange_rate_to_inr, s.amount_inr, s.settled_date, u.name as from_name
       FROM settlements s
       JOIN users u ON s.from_user_id = u.id
       WHERE s.group_id = ? AND s.to_user_id = ?`,
      [groupId, userId]
    );

    // E. Map to a unified ledger
    const ledger = [];

    paidExpenses.forEach(e => {
      ledger.push({
        id: `paid-${e.id}`,
        date: e.expense_date,
        description: e.description,
        type: 'PAID',
        originalAmount: e.amount,
        currency: e.currency,
        exchangeRate: e.exchange_rate_to_inr,
        amountInr: e.amount_inr,
        userShareInr: 0,
        netEffectInr: e.amount_inr // + credit for paying
      });
    });

    splitExpenses.forEach(s => {
      // Net effect is negative because they owe this share
      ledger.push({
        id: `split-${s.id}`,
        date: s.expense_date,
        description: `${s.description} (Paid by ${s.paid_by_name})`,
        type: 'OWED',
        originalAmount: s.amount,
        currency: s.currency,
        exchangeRate: s.exchange_rate_to_inr,
        amountInr: s.amount_inr,
        userShareInr: s.calculated_amount_inr,
        netEffectInr: -s.calculated_amount_inr
      });
    });

    sentSettlements.forEach(s => {
      ledger.push({
        id: `settle-sent-${s.id}`,
        date: s.settled_date,
        description: `Settlement to ${s.to_name}`,
        type: 'SETTLEMENT_SENT',
        originalAmount: s.amount,
        currency: s.currency,
        exchangeRate: s.exchange_rate_to_inr,
        amountInr: s.amount_inr,
        userShareInr: s.amount_inr,
        netEffectInr: s.amount_inr // sending money increases net balance (reduces debt)
      });
    });

    receivedSettlements.forEach(s => {
      ledger.push({
        id: `settle-rcvd-${s.id}`,
        date: s.settled_date,
        description: `Settlement from ${s.from_name}`,
        type: 'SETTLEMENT_RECEIVED',
        originalAmount: s.amount,
        currency: s.currency,
        exchangeRate: s.exchange_rate_to_inr,
        amountInr: s.amount_inr,
        userShareInr: s.amount_inr,
        netEffectInr: -s.amount_inr // receiving money decreases net balance (reduces credit)
      });
    });

    // Sort ledger by date descending
    ledger.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      userId: parseInt(userId),
      userName: user.name,
      ledger
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get all pending anomalies
app.get('/api/anomalies', async (req, res) => {
  try {
    const anomalies = await db.all(`SELECT * FROM import_anomalies WHERE status = 'PENDING_REVIEW'`);
    res.json(anomalies.map(a => ({
      ...a,
      raw_data: JSON.parse(a.raw_data),
      proposed_fix: JSON.parse(a.proposed_fix)
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Resolve Anomaly
app.post('/api/anomalies/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { action, overrideData, resolvedByUserId } = req.body;

  try {
    const anomaly = await db.get('SELECT * FROM import_anomalies WHERE id = ?', [id]);
    if (!anomaly) return res.status(404).json({ error: 'Anomaly not found' });

    const rawData = JSON.parse(anomaly.raw_data);
    const proposedFix = JSON.parse(anomaly.proposed_fix);

    const resolvedAt = new Date().toISOString();

    if (action === 'IGNORE') {
      // Simply mark as IGNORED
      await db.run(
        `UPDATE import_anomalies SET status = 'IGNORED', resolved_at = ?, resolved_by_user_id = ? WHERE id = ?`,
        [resolvedAt, resolvedByUserId, id]
      );
      return res.json({ success: true, message: 'Anomaly ignored' });
    }

    // Determine values to write
    let finalDetails = proposedFix.rowDetails || {};
    if (action === 'OVERRIDE' && overrideData) {
      finalDetails = { ...finalDetails, ...overrideData };
    }

    const groupId = finalDetails.group_id || 1;
    const dateStr = finalDetails.expense_date || rawData.date;
    const description = finalDetails.description || rawData.description;
    let amount = parseFloat(finalDetails.amount !== undefined ? finalDetails.amount : rawData.amount);
    const currency = (finalDetails.currency || rawData.currency || 'INR').toUpperCase();
    const splitType = (finalDetails.split_type || rawData.splittype || 'EQUAL').toUpperCase();
    let exchangeRate = parseFloat(finalDetails.exchange_rate_to_inr || 1.0);

    // If it was a currency mismatch and approved, verify exchange rate
    if (proposedFix.action === 'APPLY_EXCHANGE_RATE' || proposedFix.action === 'CONVERT_CURRENCY') {
      exchangeRate = proposedFix.exchangeRate || 83.0;
    }

    // Handle converting to settlement
    if (proposedFix.action === 'CONVERT_TO_SETTLEMENT' || (action === 'OVERRIDE' && overrideData?.isSettlement)) {
      const fromName = finalDetails.from || rawData.participants?.split(',')[0]?.trim();
      const toName = finalDetails.to || rawData.paidby || rawData.paidbyuser;
      const settleAmount = Math.abs(amount);

      const fromUser = await db.get('SELECT id FROM users WHERE LOWER(name) = ?', [fromName.toLowerCase()]);
      const toUser = await db.get('SELECT id FROM users WHERE LOWER(name) = ?', [toName.toLowerCase()]);

      if (!fromUser || !toUser) {
        return res.status(400).json({ error: `Could not resolve users: from "${fromName}" to "${toName}"` });
      }

      await db.run(
        `INSERT INTO settlements (group_id, from_user_id, to_user_id, amount, currency, exchange_rate_to_inr, amount_inr, settled_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [groupId, fromUser.id, toUser.id, settleAmount, currency, exchangeRate, settleAmount * exchangeRate, new Date(dateStr).toISOString()]
      );

      await db.run(
        `UPDATE import_anomalies SET status = 'RESOLVED', resolved_at = ?, resolved_by_user_id = ? WHERE id = ?`,
        [resolvedAt, resolvedByUserId, id]
      );

      return res.json({ success: true, message: 'Anomaly resolved and written as settlement' });
    }

    // Resolve users and memberships
    let paidByUserId = finalDetails.paid_by_user_id;
    if (!paidByUserId) {
      const paidByName = finalDetails.paid_by_name || rawData.paidby || rawData.paidbyuser;
      const payer = await db.get('SELECT id FROM users WHERE LOWER(name) = ?', [paidByName.toLowerCase()]);
      if (!payer) return res.status(400).json({ error: `Payer "${paidByName}" not found` });
      paidByUserId = payer.id;
    }

    let participantNames = finalDetails.participants || rawData.participants?.split(',').map(p => p.trim()) || [];
    let splitDetails = finalDetails.split_details || rawData.splitdetails?.split(',').map(s => parseFloat(s.trim())) || [];

    // Exclude users if flagged in proposedFix (e.g. timeline violation)
    if (proposedFix.action === 'EXCLUDE_USER_AND_RESPLIT' || proposedFix.action === 'NONE') {
      if (proposedFix.inactiveUserId || proposedFix.excludeUsers) {
        const excludeIds = proposedFix.excludeUsers || [proposedFix.inactiveUserId];
        const updatedParticipants = [];
        for (const name of participantNames) {
          const user = await db.get('SELECT id, name FROM users WHERE LOWER(name) = ?', [name.toLowerCase()]);
          if (user && !excludeIds.includes(user.id)) {
            updatedParticipants.push(user.name);
          }
        }
        participantNames = updatedParticipants;
        // recalculate split ratios if EQUAL
        if (splitType === 'EQUAL') {
          splitDetails = [];
        }
      }
    }

    // If treating negative amount as refund, adjust amount
    if (proposedFix.action === 'TREAT_AS_REFUND') {
      amount = Math.abs(amount); // splits will represent credit
    }

    // Insert as a finalized expense
    await insertFinalizedExpense(
      groupId,
      paidByUserId,
      description,
      amount,
      currency,
      exchangeRate,
      new Date(dateStr),
      splitType,
      participantNames,
      splitDetails
    );

    // Update anomaly status
    await db.run(
      `UPDATE import_anomalies SET status = 'RESOLVED', resolved_at = ?, resolved_by_user_id = ? WHERE id = ?`,
      [resolvedAt, resolvedByUserId, id]
    );

    res.json({ success: true, message: 'Anomaly successfully resolved and expense imported' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Upload & Import CSV File
app.post('/api/import', upload.single('file'), async (req, res) => {
  const { groupId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const result = await processCSVImport(csvContent, parseInt(groupId));
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Record settlement manually
app.post('/api/settle', async (req, res) => {
  const { groupId, fromUserId, toUserId, amount, currency, settledDate } = req.body;
  try {
    const rate = currency === 'USD' ? 83.0 : 1.0;
    const amountInr = amount * rate;
    
    await db.run(
      `INSERT INTO settlements (group_id, from_user_id, to_user_id, amount, currency, exchange_rate_to_inr, amount_inr, settled_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [groupId, fromUserId, toUserId, amount, currency, rate, amountInr, settledDate || new Date().toISOString()]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Express server locally
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Express API Server running at http://localhost:${port}`);
  });
}

export default app;
