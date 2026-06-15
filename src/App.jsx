import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ArrowRight, 
  UploadCloud, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  DollarSign, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  UserCheck, 
  RefreshCw, 
  FileText, 
  Check, 
  X, 
  Plus, 
  Eye, 
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

export default function App() {
  // Authentication & State
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [groupId] = useState(1); // Main Seeded Group: Apartment 4B
  
  // Dashboard Data State
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [activeTab, setActiveTab] = useState('aisha'); // 'aisha', 'rohan', 'meera'
  
  // Rohan Audit State
  const [selectedAuditUser, setSelectedAuditUser] = useState(null);
  const [auditLedger, setAuditLedger] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  
  // Meera Importer State
  const [anomalies, setAnomalies] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [loadingImport, setLoadingImport] = useState(false);
  const [editingAnomaly, setEditingAnomaly] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Manual Expense Form State
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    splitType: 'EQUAL',
    participants: [],
    splitDetails: ''
  });

  // Manual Settlement Form State
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementData, setSettlementData] = useState({
    toUserId: '',
    amount: '',
    currency: 'INR'
  });

  // Load Initial Users & Summary Data
  useEffect(() => {
    fetchUsers();
    fetchSummary();
    fetchAnomalies();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups/${groupId}/summary`);
      const data = await res.json();
      setBalances(data.balances || []);
      setSimplifiedDebts(data.simplifiedDebts || []);
    } catch (err) {
      console.error('Error fetching summary', err);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const res = await fetch(`${API_BASE}/anomalies`);
      const data = await res.json();
      setAnomalies(data || []);
    } catch (err) {
      console.error('Error fetching anomalies', err);
    }
  };

  // Switch Audit Trail
  const selectAuditUser = async (userId) => {
    setSelectedAuditUser(userId);
    setLoadingAudit(true);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/audit/${groupId}`);
      const data = await res.json();
      setAuditLedger(data.ledger || []);
    } catch (err) {
      console.error('Error fetching audit trail', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Simulate CSV Upload with Spreetail Assignment Cases
  const runCSVImportSimulation = async () => {
    setLoadingImport(true);
    setImportResults(null);

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
2026-04-18,April Grocery,1000,INR,Sam,EQUAL,"Aisha, Rohan, Priya, Sam"`;

    const blob = new Blob([mockCSV], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'expenses_export.csv');
    formData.append('groupId', groupId);

    try {
      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setImportResults(data.result);
      fetchAnomalies();
      fetchSummary();
      if (selectedAuditUser) selectAuditUser(selectedAuditUser);
    } catch (err) {
      console.error('Error importing CSV', err);
    } finally {
      setLoadingImport(false);
    }
  };

  // CSV File Selector Handler
  const handleCSVFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingImport(true);
    setImportResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', groupId);

    try {
      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setImportResults(data.result);
      fetchAnomalies();
      fetchSummary();
      if (selectedAuditUser) selectAuditUser(selectedAuditUser);
    } catch (err) {
      console.error('Error importing CSV', err);
    } finally {
      setLoadingImport(false);
    }
  };

  // Resolve Staged Anomaly
  const handleResolveAnomaly = async (anomalyId, action, customData = null) => {
    try {
      const res = await fetch(`${API_BASE}/anomalies/${anomalyId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          overrideData: customData,
          resolvedByUserId: currentUser.id
        })
      });
      const result = await res.json();
      if (result.success) {
        fetchAnomalies();
        fetchSummary();
        if (selectedAuditUser) selectAuditUser(selectedAuditUser);
        setEditingAnomaly(null);
      } else {
        alert('Resolution failed: ' + result.error);
      }
    } catch (err) {
      console.error('Error resolving anomaly', err);
    }
  };

  // Handle Manual Expense Creation
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    // Simulate raw csv import of a clean line for simple entry
    const details = newExpense.splitDetails;
    const participantsStr = newExpense.participants.map(pId => {
      const u = users.find(user => user.id === parseInt(pId));
      return u ? u.name : '';
    }).filter(n => n.length > 0).join(', ');

    const rowStr = `Date,Description,Amount,Currency,Paid By,Split Type,Participants,Split Details\n${new Date().toISOString().split('T')[0]},${newExpense.description},${newExpense.amount},${newExpense.currency},${users.find(u => u.id === currentUser.id).name},${newExpense.splitType},"${participantsStr}","${details}"`;
    
    setLoadingImport(true);
    const blob = new Blob([rowStr], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'manual_expense.csv');
    formData.append('groupId', groupId);

    try {
      const res = await fetch(`${API_BASE}/import`, { method: 'POST', body: formData });
      const data = await res.json();
      setShowAddExpense(false);
      setNewExpense({ description: '', amount: '', currency: 'INR', splitType: 'EQUAL', participants: [], splitDetails: '' });
      fetchAnomalies();
      fetchSummary();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingImport(false);
    }
  };

  // Handle Manual Settlement Recording
  const handleRecordSettlement = async (e) => {
    e.preventDefault();
    if (!settlementData.toUserId || !settlementData.amount) return;

    try {
      const res = await fetch(`${API_BASE}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          fromUserId: currentUser.id,
          toUserId: parseInt(settlementData.toUserId),
          amount: parseFloat(settlementData.amount),
          currency: settlementData.currency
        })
      });
      const result = await res.json();
      if (result.success) {
        setShowSettleModal(false);
        setSettlementData({ toUserId: '', amount: '', currency: 'INR' });
        fetchSummary();
        if (selectedAuditUser) selectAuditUser(selectedAuditUser);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Form helpers
  const toggleParticipant = (userId) => {
    const current = [...newExpense.participants];
    const index = current.indexOf(userId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(userId);
    }
    setNewExpense({ ...newExpense, participants: current });
  };

  // Avatar colors mapping
  const getAvatarColor = (name) => {
    const colors = {
      aisha: 'bg-purple-600 border-purple-400 text-purple-100',
      rohan: 'bg-sky-600 border-sky-400 text-sky-100',
      priya: 'bg-emerald-600 border-emerald-400 text-emerald-100',
      meera: 'bg-rose-600 border-rose-400 text-rose-100',
      sam: 'bg-amber-600 border-amber-400 text-amber-100',
      dev: 'bg-teal-600 border-teal-400 text-teal-100'
    };
    return colors[name.toLowerCase()] || 'bg-slate-600 border-slate-400 text-slate-100';
  };

  // Persona descriptor
  const getPersonaDesc = (name) => {
    const descs = {
      Aisha: 'Product Owner. Wants simplified summary calculations ("Who pays whom").',
      Rohan: 'Detailed Auditor. Demands transaction-level ledgers for exact splits.',
      Priya: 'International Traveler. Flags conversion rate discrepancies (USD vs INR).',
      Meera: 'Staging Overseer. Moved out Mar 31. Approves/rejects CSV anomaly resolutions.',
      Sam: 'Protected Roommate. Joined Apr 15. Shielded from March billing violations.',
      Dev: 'Trip Guest. Active Feb 15 - Mar 15. USD trip spender.'
    };
    return descs[name] || '';
  };

  // ----------------------------------------------------
  // RENDER: LOGIN PORTAL
  // ----------------------------------------------------
  if (!currentUser) {
    return (
      <div className="min-height-100vh flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-4xl w-full text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-4 tracking-wider uppercase pulsing-glow">
            <Sparkles size={14} className="text-purple-400" /> Spreetail Assignment Showcase
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-violet-300 to-teal-400 leading-tight tracking-tight mb-3">
            Shared Expenses Dashboard
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
            A relational database-backed application featuring defensive ingestion, currency conversion, timeline violation containment, and greedy debt minimization.
          </p>
        </div>

        <div className="max-w-4xl w-full glass-panel rounded-2xl p-6 md:p-10">
          <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center justify-center gap-2">
            <UserCheck className="text-purple-400" size={20} /> Select a roommate persona to login:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(u => (
              <div 
                key={u.id}
                onClick={() => {
                  setCurrentUser(u);
                  selectAuditUser(u.id);
                }}
                className="group cursor-pointer glass-panel bg-slate-900/30 rounded-xl p-5 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/10 transition-all flex flex-col items-center text-center"
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl border-2 shadow-lg group-hover:scale-105 transition-transform ${getAvatarColor(u.name)}`}>
                  {u.name.substring(0, 2)}
                </div>
                <h3 className="text-lg font-bold text-slate-200 mt-4 group-hover:text-purple-300 transition-colors">{u.name}</h3>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3">
                  {getPersonaDesc(u.name)}
                </p>
                <div className="mt-4 flex items-center text-xs text-purple-400 font-semibold group-hover:text-purple-300">
                  Select Persona <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <p className="text-xs text-slate-600 mt-8 text-center">
          Relational Database Engine: SQLite3 &bull; Frontend Compiler: Vite React &bull; Styles: Tailwind v4
        </p>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: MAIN APP INTERFACE
  // ----------------------------------------------------
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navbar */}
      <header className="glass-panel border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
            SE
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight m-0 flex items-center gap-1.5">
              Apartment 4B Ledger
              <span className="text-xs font-normal text-slate-400 px-2 py-0.5 rounded bg-slate-800/80">Group #1</span>
            </h1>
            <p className="text-xs text-slate-400 m-0">Dynamic Shared Expenses app</p>
          </div>
        </div>

        {/* User profile dropdown and simulated import controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={runCSVImportSimulation}
            disabled={loadingImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loadingImport ? 'animate-spin' : ''} />
            Simulate CSV Import
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-slate-800">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(currentUser.name)}`}>
              {currentUser.name.substring(0, 2)}
            </div>
            <span className="text-xs font-semibold text-slate-300">{currentUser.name} (Active)</span>
            <button 
              onClick={() => setCurrentUser(null)} 
              className="text-[10px] text-purple-400 hover:text-purple-300 ml-2 font-bold underline"
            >
              Switch
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col gap-6">
        
        {/* Statistics & Import Feedback Indicator */}
        {importResults && (
          <div className="glass-panel border-teal-500/30 bg-teal-950/10 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                <CheckCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-teal-300 text-sm">Simulation Import Completed</h4>
                <p className="text-xs text-slate-400">
                  Ingested {importResults.totalProcessed} records. {importResults.successCount} imported cleanly; {importResults.anomaliesCount} flagged for review.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setImportResults(null)}
              className="text-xs text-slate-500 hover:text-slate-300 font-bold px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('aisha')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'aisha' 
                ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins size={16} />
            Aisha's Simplified Summary
          </button>
          <button
            onClick={() => {
              setActiveTab('rohan');
              if (!selectedAuditUser) selectAuditUser(currentUser.id);
            }}
            className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'rohan' 
                ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            Rohan's Detailed Audit
          </button>
          <button
            onClick={() => setActiveTab('meera')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all relative ${
              activeTab === 'meera' 
                ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert size={16} />
            Meera's CSV Importer Portal
            {anomalies.length > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
          </button>
        </div>

        {/* ----------------------------------------------------
            TAB 1: AISHA'S DASHBOARD (DEBT SIMPLIFICATION)
            ---------------------------------------------------- */}
        {activeTab === 'aisha' && (
          <div className="flex flex-col gap-6">
            
            {/* Roommate Net Balances Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {balances.map(b => {
                const isNegative = b.netBalance < 0;
                return (
                  <div key={b.userId} className="glass-panel rounded-xl p-4 flex flex-col items-center text-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2 ${getAvatarColor(b.name)}`}>
                      {b.name.substring(0, 2)}
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">{b.name}</span>
                    <span className={`text-base font-bold mt-1 ${isNegative ? 'text-rose-400' : 'text-teal-400'}`}>
                      {isNegative ? '-' : '+'}₹{Math.abs(b.netBalance).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      {b.leftAt ? 'Left End of Mar' : b.name === 'Sam' ? 'Joined Mid-Apr' : 'Member'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Core Row: Simplified Debts + Options */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Simplified Debts List */}
              <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col">
                <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Coins className="text-purple-400" size={18} />
                    Who Pays Whom, How Much (Simplified)
                  </span>
                  <span className="text-xs font-normal text-slate-400">
                    Minimized transactions via Min-Flow match
                  </span>
                </h3>

                {simplifiedDebts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500">
                    <CheckCircle className="text-teal-500 mb-2" size={32} />
                    <p className="text-sm">All balances are completely settled!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {simplifiedDebts.map((debt, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-slate-800/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center">
                            <span className="text-sm font-semibold text-rose-400">{debt.fromName}</span>
                            <ArrowRight size={14} className="mx-2 text-slate-500" />
                            <span className="text-sm font-semibold text-teal-400">{debt.toName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-slate-100">
                            ₹{debt.amount.toLocaleString('en-IN')}
                          </span>
                          {currentUser.id === debt.fromId && (
                            <button
                              onClick={() => {
                                setSettlementData({
                                  toUserId: debt.toId.toString(),
                                  amount: debt.amount.toString(),
                                  currency: 'INR'
                                });
                                setShowSettleModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            >
                              Quick Settle
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons sidebar */}
              <div className="flex flex-col gap-4">
                <div className="glass-panel rounded-xl p-6">
                  <h4 className="font-bold text-slate-200 text-sm mb-4">Ledger Quick Actions</h4>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setShowAddExpense(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all"
                    >
                      <Plus size={16} /> Add Expense Split
                    </button>
                    <button
                      onClick={() => setShowSettleModal(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition-all"
                    >
                      <UserCheck size={16} /> Record a Payment
                    </button>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-6 bg-purple-950/5 border-purple-900/20">
                  <h4 className="font-bold text-purple-300 text-sm mb-2 flex items-center gap-1.5">
                    <Sparkles size={14} /> Evaluation Hint
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    You can switch active roommate profiles in the top right. 
                    Switch to <strong>Sam</strong> (who joined in mid-April) and then click the <strong>Rohan's Detailed Audit</strong> tab to verify he has no March expense charges!
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ----------------------------------------------------
            TAB 2: ROHAN'S LEDGER DRILL-DOWN AUDIT
            ---------------------------------------------------- */}
        {activeTab === 'rohan' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* User List Sidebar */}
            <div className="glass-panel rounded-xl p-4 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Select Account</h4>
              {users.map(u => {
                const bal = balances.find(b => b.userId === u.id);
                const isSelected = selectedAuditUser === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => selectAuditUser(u.id)}
                    className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-all ${
                      isSelected 
                        ? 'bg-purple-600/10 border border-purple-500/40 text-purple-300' 
                        : 'border border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${getAvatarColor(u.name)}`}>
                        {u.name.substring(0, 2)}
                      </div>
                      <span className="text-xs font-bold">{u.name}</span>
                    </div>
                    {bal && (
                      <span className={`text-xs font-semibold ${bal.netBalance < 0 ? 'text-rose-400' : 'text-teal-400'}`}>
                        {bal.netBalance < 0 ? '-' : '+'}₹{Math.abs(bal.netBalance).toLocaleString('en-IN')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Audit Ledger Detail Panel */}
            <div className="lg:col-span-3 glass-panel rounded-xl p-6 flex flex-col min-h-[400px]">
              
              {selectedAuditUser && (
                <div className="flex flex-col gap-6">
                  {/* Account detail header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        Audit Ledger: {users.find(u => u.id === selectedAuditUser)?.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Detailed breakdown of all settlements and split share allocations in INR
                      </p>
                    </div>

                    {balances.find(b => b.userId === selectedAuditUser) && (
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Total Net Balance</span>
                        <span className={`text-lg font-bold ${
                          balances.find(b => b.userId === selectedAuditUser).netBalance < 0 ? 'text-rose-400' : 'text-teal-400'
                        }`}>
                          {balances.find(b => b.userId === selectedAuditUser).netBalance < 0 ? 'Owes ' : 'Owed '}
                          ₹{Math.abs(balances.find(b => b.userId === selectedAuditUser).netBalance).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ledger Table */}
                  {loadingAudit ? (
                    <div className="flex items-center justify-center py-24 text-slate-400">
                      <RefreshCw className="animate-spin mr-2" /> Loading Audit Ledger...
                    </div>
                  ) : auditLedger.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                      <FileText className="mb-2" size={32} />
                      <p className="text-sm">No recorded ledger items found for this account.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase">
                            <th className="pb-3 pr-2">Date</th>
                            <th className="pb-3 pr-2">Description</th>
                            <th className="pb-3 pr-2">Type</th>
                            <th className="pb-3 pr-2 text-right">Raw Spend</th>
                            <th className="pb-3 pr-2 text-right">Your Share</th>
                            <th className="pb-3 text-right">Net Impact (INR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLedger.map((item) => {
                            const isPositive = item.netEffectInr > 0;
                            return (
                              <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-900/20">
                                <td className="py-3 pr-2 text-slate-400 font-medium whitespace-nowrap">
                                  {new Date(item.date).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </td>
                                <td className="py-3 pr-2 font-bold text-slate-300">
                                  {item.description}
                                </td>
                                <td className="py-3 pr-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    item.type === 'PAID' ? 'bg-teal-500/10 text-teal-300' :
                                    item.type === 'OWED' ? 'bg-rose-500/10 text-rose-300' :
                                    'bg-indigo-500/10 text-indigo-300'
                                  }`}>
                                    {item.type}
                                  </span>
                                </td>
                                <td className="py-3 pr-2 text-right font-medium text-slate-400">
                                  {item.originalAmount !== 0 ? `${item.originalAmount.toFixed(2)} ${item.currency}` : '-'}
                                </td>
                                <td className="py-3 pr-2 text-right font-medium text-slate-400">
                                  {item.userShareInr !== 0 ? `₹${item.userShareInr.toFixed(2)}` : '-'}
                                </td>
                                <td className={`py-3 text-right font-bold ${
                                  isPositive ? 'text-teal-400' : 'text-rose-400'
                                }`}>
                                  {isPositive ? '+' : '-'}₹{Math.abs(item.netEffectInr).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>
        )}

        {/* ----------------------------------------------------
            TAB 3: MEERA'S INTERACTIVE IMPORT REPORT PORTAL
            ---------------------------------------------------- */}
        {activeTab === 'meera' && (
          <div className="flex flex-col gap-6">
            
            {/* CSV File Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between min-h-[160px]">
                <div>
                  <h3 className="font-bold text-slate-200 text-sm mb-1">Upload CSV Export Sheet</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Upload your raw <code>expenses_export.csv</code>. The parser engine checks for at least 12 categories of discrepancies and stages violations for manual review without failing.
                  </p>
                </div>
                
                <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition-colors">
                    <UploadCloud size={14} />
                    Choose CSV File
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={handleCSVFileChange}
                    />
                  </label>
                  <span className="text-xs text-slate-500 font-medium">Or use the Simulation button above</span>
                </div>
              </div>

              {/* Staging Area Info Widget */}
              <div className="glass-panel rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-2">Import Staging Status</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-rose-400">{anomalies.length}</span>
                    <span className="text-xs text-slate-400">Anomalies Staged</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
                  Meera's rule: all rows with duplicate entries, timeline errors, or conversion bugs must be reviewed and approved manually.
                </p>
              </div>

            </div>

            {/* Anomalies Table Portal */}
            <div className="glass-panel rounded-xl p-6 flex flex-col">
              <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-rose-400" size={18} />
                Flagged Import Anomalies Review
              </h3>

              {anomalies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <CheckCircle className="text-teal-500 mb-2" size={32} />
                  <p className="text-sm">No staged anomalies. All imported records are finalized!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase">
                        <th className="pb-3 pr-2 w-12">Row</th>
                        <th className="pb-3 pr-2">Error Type</th>
                        <th className="pb-3 pr-2">Description</th>
                        <th className="pb-3 pr-2">Original CSV Data</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.map((a) => (
                        <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-900/20 align-top">
                          <td className="py-4 pr-2 font-bold text-slate-500">#{a.raw_row_index}</td>
                          <td className="py-4 pr-2">
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold text-[10px]">
                              {a.error_type}
                            </span>
                          </td>
                          <td className="py-4 pr-2 font-medium text-slate-300 max-w-xs leading-normal">
                            {a.error_description}
                          </td>
                          <td className="py-4 pr-2 max-w-sm">
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded p-2 text-[10px] font-mono text-slate-400 overflow-x-auto max-w-xs sm:max-w-sm">
                              {Object.entries(a.raw_data).map(([k, v]) => (
                                <div key={k} className="whitespace-nowrap">
                                  <span className="text-purple-400 font-semibold">{k}:</span> {v}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                              {a.proposed_fix && a.proposed_fix.action !== 'NONE' && (
                                <button
                                  onClick={() => handleResolveAnomaly(a.id, 'APPROVE')}
                                  className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] transition-colors"
                                >
                                  Apply Fix: {a.proposed_fix.action}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingAnomaly(a);
                                  setEditFormData({
                                    description: a.raw_data.description || '',
                                    amount: Math.abs(parseFloat(a.raw_data.amount)) || 0,
                                    currency: (a.raw_data.currency || 'INR').toUpperCase(),
                                    split_type: (a.raw_data.splittype || 'EQUAL').toUpperCase(),
                                    participants: a.raw_data.participants ? a.raw_data.participants.split(',').map(p=>p.trim()) : [],
                                    split_details: a.raw_data.splitdetails || '',
                                    expense_date: a.raw_data.date || new Date().toISOString().split('T')[0],
                                    isSettlement: a.error_type === 'SETTLEMENT_LOGGED_AS_EXPENSE'
                                  });
                                }}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-[10px] transition-colors"
                              >
                                Override Manual
                              </button>
                              <button
                                onClick={() => handleResolveAnomaly(a.id, 'IGNORE')}
                                className="px-2 py-1 rounded hover:bg-rose-950/20 text-rose-400 font-semibold text-[10px] transition-colors"
                              >
                                Discard Row
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>

          </div>
        )}

      </main>

      {/* ----------------------------------------------------
          MODAL: MANUAL OVERRIDE ANOMALY RESOLUTION
          ---------------------------------------------------- */}
      {editingAnomaly && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-100 text-base">Manual Override Anomaly #{editingAnomaly.raw_row_index}</h3>
              <button onClick={() => setEditingAnomaly(null)} className="text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleResolveAnomaly(editingAnomaly.id, 'OVERRIDE', editFormData);
            }} className="flex flex-col gap-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Description</label>
                  <input 
                    type="text" 
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Date</label>
                  <input 
                    type="date" 
                    value={editFormData.expense_date}
                    onChange={(e) => setEditFormData({...editFormData, expense_date: e.target.value})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({...editFormData, amount: parseFloat(e.target.value)})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Currency</label>
                  <select 
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({...editFormData, currency: e.target.value})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Split Model</label>
                  <select 
                    value={editFormData.split_type}
                    onChange={(e) => setEditFormData({...editFormData, split_type: e.target.value})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                  >
                    <option value="EQUAL">Equal</option>
                    <option value="EXACT">Exact Values</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="SHARES">Shares</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">Participants (Comma separated names)</label>
                <input 
                  type="text" 
                  value={editFormData.participants ? editFormData.participants.join(', ') : ''}
                  onChange={(e) => setEditFormData({...editFormData, participants: e.target.value.split(',').map(p=>p.trim())})}
                  className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">Split Details (Values in order of participants)</label>
                <input 
                  type="text" 
                  value={editFormData.split_details}
                  onChange={(e) => setEditFormData({...editFormData, split_details: e.target.value})}
                  className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                  placeholder="e.g. 50, 50 (or leave blank for Equal)"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="chk-settle"
                  checked={editFormData.isSettlement}
                  onChange={(e) => setEditFormData({...editFormData, isSettlement: e.target.checked})}
                />
                <label htmlFor="chk-settle" className="text-slate-400 font-semibold cursor-pointer">
                  Treat this transaction as a debt settlement instead of an expense
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setEditingAnomaly(null)}
                  className="px-4 py-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  Confirm Override & Commit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: ADD EXPENSE SPLIT
          ---------------------------------------------------- */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-100 text-base">Add New Expense Split</h3>
              <button onClick={() => setShowAddExpense(false)} className="text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleCreateExpense} className="flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Description</label>
                  <input 
                    type="text" 
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                    placeholder="e.g. Electricity, Lunch"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 font-bold">Amount</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                      className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                      placeholder="1000"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 font-bold">Currency</label>
                    <select 
                      value={newExpense.currency}
                      onChange={(e) => setNewExpense({...newExpense, currency: e.target.value})}
                      className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold">Split Model</label>
                <select 
                  value={newExpense.splitType}
                  onChange={(e) => setNewExpense({...newExpense, splitType: e.target.value})}
                  className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                >
                  <option value="EQUAL">Equal Splits</option>
                  <option value="EXACT">Exact splits per user</option>
                  <option value="PERCENTAGE">Percentage splits</option>
                  <option value="SHARES">Shares counts</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">Splitting Members</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {users.map(u => {
                    const isChecked = newExpense.participants.includes(u.id.toString());
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => toggleParticipant(u.id.toString())}
                        className={`p-2 rounded text-left border flex items-center gap-2 transition-all ${
                          isChecked 
                            ? 'bg-purple-600/10 border-purple-500/40 text-purple-300' 
                            : 'bg-slate-900/30 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked ? 'bg-purple-600 border-purple-400' : 'border-slate-700'
                        }`}>
                          {isChecked && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-[10px] font-bold">{u.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">Split Details (Amounts/Percent/Shares relative to chosen order)</label>
                <input 
                  type="text" 
                  value={newExpense.splitDetails}
                  onChange={(e) => setNewExpense({...newExpense, splitDetails: e.target.value})}
                  className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                  placeholder="e.g. 500, 500 (Optional for Equal)"
                />
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  Create Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: RECORD SETTLEMENT
          ---------------------------------------------------- */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-100 text-base">Record a Settlement</h3>
              <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleRecordSettlement} className="flex flex-col gap-4 text-xs">
              
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">Payer (From)</label>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80 text-slate-400 font-bold">
                  {currentUser.name}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">Recipient (To)</label>
                <select 
                  value={settlementData.toUserId}
                  onChange={(e) => setSettlementData({...settlementData, toUserId: e.target.value})}
                  className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                  required
                >
                  <option value="">Select Recipient</option>
                  {users.filter(u => u.id !== currentUser.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={settlementData.amount}
                    onChange={(e) => setSettlementData({...settlementData, amount: e.target.value})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                    placeholder="500"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Currency</label>
                  <select 
                    value={settlementData.currency}
                    onChange={(e) => setSettlementData({...settlementData, currency: e.target.value})}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-slate-800/80 text-center text-[10px] text-slate-500 mt-12 bg-slate-950/20">
        Shared Expenses App &bull; Deployed on Local Sandbox &bull; Spreetail Assignment Review Project
      </footer>
    </div>
  );
}
