import React, { useState, useEffect } from 'react';
import {
  User, JobCard, Chemical, ChemicalPurchase, ChemicalUsage,
  ProductionRoll, SlittingRoll, ProductionWastage, Department, Shift, JobCardStatus,
} from '../types';
import { formatWeight, calculateJobCardWastage } from '../utils/formatters';
import { PARTIES, getPartyName } from '../utils/parties';
import { JobCardDetailModal } from './JobCardDetailModal';
import { RollPDFModal } from './RollPDFModal';
import {
  Users, FileText, FlaskConical, Plus, Edit2, Trash2, Eye, X,
  Search, Layers, Scissors, Check, RefreshCw, CreditCard, Briefcase,
} from 'lucide-react';
import { PaymentTrackerModule } from '../payment-tracker/PaymentTrackerModule';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseClient';

interface AdminModuleProps {
  currentUser: User;
  users: User[];
  jobCards: JobCard[];
  chemicals: Chemical[];
  purchases: ChemicalPurchase[];
  usages: ChemicalUsage[];
  prodRolls: ProductionRoll[];
  slitRolls: SlittingRoll[];
  prodWastages: ProductionWastage[]; permissions?: { view: boolean, edit: boolean };
}

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 px-4 py-3 text-base text-gray-900 focus:outline-none focus:border-indigo-600 focus:bg-indigo-50/50 transition-colors";
const selectCls = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 px-4 py-3 text-base text-gray-900 focus:outline-none focus:border-indigo-600 focus:bg-indigo-50/50 transition-colors";

export const AdminModule: React.FC<AdminModuleProps> = ({
  currentUser, users, jobCards, chemicals, purchases, usages, prodRolls, slitRolls, prodWastages, permissions,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'jobCards' | 'users' | 'chemicals' | 'factoryRolls' | 'paymentTracker' | 'stock'>('home');
  const [jobCardSearch, setJobCardSearch] = useState('');

  // Handle hardware back button for tab navigation
  useEffect(() => {
    window.history.replaceState({ tab: 'home' }, '');
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        setActiveTab(e.state.tab);
      } else {
        setActiveTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToTab = (tabId: 'home' | 'jobCards' | 'users' | 'chemicals' | 'factoryRolls' | 'paymentTracker' | 'stock') => {
    setActiveTab(tabId);
    window.history.pushState({ tab: tabId }, '');
  };

  const statusPriority: Record<string, number> = { running: 1, pending: 2, completed: 3, dispatched: 4 };
  const sortedJobCards = [...jobCards].sort((a, b) => {
    return (statusPriority[(a.slittingStatus || 'pending').toLowerCase()] || 99) - (statusPriority[(b.slittingStatus || 'pending').toLowerCase()] || 99);
  });

  const filteredJobCards = sortedJobCards.filter((jc) => {
    if (!jobCardSearch.trim()) return true;
    const q = jobCardSearch.toLowerCase().trim();
    return (
      (jc.jobCode || '').toLowerCase().includes(q) ||
      (jc.partyCode || '').toLowerCase().includes(q) ||
      (jc.size || '').toLowerCase().includes(q) ||
      (jc.status || '').toLowerCase().includes(q) ||
      (jc.micron || '').toLowerCase().includes(q)
    );
  });

  // Job Card state
  const [selectedJobCardForDetail, setSelectedJobCardForDetail] = useState<JobCard | null>(null);
  const [pdfModalJobCard, setPdfModalJobCard] = useState<JobCard | null>(null);
  const [showJobCardModal, setShowJobCardModal] = useState(false);
  const [editingJobCard, setEditingJobCard] = useState<JobCard | null>(null);
  const [deletingJobCard, setDeletingJobCard] = useState<JobCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [jcCode, setJcCode] = useState('');
  const [jcDate, setJcDate] = useState(new Date().toISOString().split('T')[0]);
  const [jcPartyCode, setJcPartyCode] = useState('');
  const [jcSize, setJcSize] = useState('');
  const [jcMicron, setJcMicron] = useState('');
  const [jcCoilSizesInput, setJcCoilSizesInput] = useState('');
  const [jcCoilSizesList, setJcCoilSizesList] = useState<string[]>([]);
  const [jcTotalQty, setJcTotalQty] = useState('');
  const [jcStatus, setJcStatus] = useState<JobCardStatus>('pending');

  // User state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [uLoginId, setULoginId] = useState('');
  const [uName, setUName] = useState('');
  const [uDept, setUDept] = useState<Department | 'custom'>('production');
  const [uShift, setUShift] = useState<Shift>('A');
  const [uActive, setUActive] = useState(true);
  const [uPermissions, setUPermissions] = useState<any>({
    admin: { view: false, edit: false },
    chemical: { view: false, edit: false },
    production: { view: false, edit: false },
    slitting: { view: false, edit: false },
    payments: { view: false, edit: false },
  });

  // Sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const openJobCardCreate = () => {
    setEditingJobCard(null);
    setJcCode(`JC-${Math.floor(1000 + Math.random() * 9000)}`);
    setJcDate(new Date().toISOString().split('T')[0]);
    setJcPartyCode(''); setJcSize(''); setJcMicron('');
    setJcCoilSizesInput(''); setJcCoilSizesList(['230mm', '250mm']);
    setJcTotalQty(''); setJcStatus('pending');
    setShowJobCardModal(true);
  };

  const openJobCardEdit = (jc: JobCard) => {
    setEditingJobCard(jc);
    setJcCode(jc.jobCode);
    setJcDate(jc.date || new Date().toISOString().split('T')[0]);
    setJcPartyCode(jc.partyCode); setJcSize(jc.size); setJcMicron(jc.micron || '');
    setJcCoilSizesList(jc.coilSizes || []); setJcCoilSizesInput((jc.coilSizes || []).join(', '));
    setJcTotalQty(String(jc.totalQuantity || '')); setJcStatus(jc.status);
    setShowJobCardModal(true);
  };

  const addCoilSizeTag = () => {
    const val = jcCoilSizesInput.trim();
    if (val && !jcCoilSizesList.includes(val)) {
      setJcCoilSizesList([...jcCoilSizesList, val]); setJcCoilSizesInput('');
    }
  };

  const handleSaveJobCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jcCode.trim() || !jcPartyCode.trim()) return;
    const formattedPartyCode = jcPartyCode.trim().padStart(3, '0');
    const data = {
      jobCode: jcCode.trim(), date: jcDate, partyCode: formattedPartyCode,
      size: jcSize.trim(), micron: jcMicron.trim(), coilSizes: jcCoilSizesList,
      totalQuantity: parseFloat(jcTotalQty) || 0, status: jcStatus,
      createdBy: currentUser.loginId, createdAt: serverTimestamp(),
    };
    try {
      if (editingJobCard) await updateDoc(doc(db, 'jobCards', editingJobCard.id), data);
      else await addDoc(collection(db, 'jobCards'), data);
      setShowJobCardModal(false);
    } catch (err) { console.error(err); }
  };

  const handleConfirmDeleteJobCard = async () => {
    if (!deletingJobCard) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'jobCards', deletingJobCard.id));
      prodRolls.filter(r => r.jobCardId === deletingJobCard.id).forEach(r => batch.delete(doc(db, 'productionRolls', r.id)));
      slitRolls.filter(r => r.jobCardId === deletingJobCard.id).forEach(r => batch.delete(doc(db, 'slittingRolls', r.id)));
      prodWastages.filter(w => w.jobCardId === deletingJobCard.id).forEach(w => batch.delete(doc(db, 'productionWastage', w.id)));
      await batch.commit();
      setDeletingJobCard(null); setShowJobCardModal(false);
      if (selectedJobCardForDetail?.id === deletingJobCard.id) setSelectedJobCardForDetail(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete.');
    } finally { setIsDeleting(false); }
  };

  const handleUpdateStatus = async (jcId: string, newStatus: JobCardStatus, field: 'status' | 'slittingStatus' = 'status') => {
    try { await updateDoc(doc(db, 'jobCards', jcId), { [field]: newStatus }); }
    catch (err) { alert('Failed: ' + String(err)); }
  };

  const openUserCreate = () => {
    setEditingUser(null); setULoginId(''); setUName('');
    setUDept('custom'); setUShift('A'); setUActive(true);
    setUPermissions({
      admin: { view: false, edit: false },
      chemical: { view: false, edit: false },
      production: { view: false, edit: false },
      slitting: { view: false, edit: false },
      payments: { view: false, edit: false },
    });
    setShowUserModal(true);
  };

  const openUserEdit = (user: User) => {
    setEditingUser(user); setULoginId(user.loginId); setUName(user.name);
    setUDept(user.department); setUShift(user.shift); setUActive(user.active);
    
    // If user has permissions object, use it. Otherwise compute default based on department
    if (user.permissions) {
      setUPermissions(user.permissions);
    } else {
      const p = {
        admin: { view: false, edit: false },
        chemical: { view: false, edit: false },
        production: { view: false, edit: false },
        slitting: { view: false, edit: false },
        payments: { view: false, edit: false },
      };
      if (user.department === 'admin') {
        p.admin = { view: true, edit: true };
        p.chemical = { view: true, edit: true };
        p.production = { view: true, edit: true };
        p.slitting = { view: true, edit: true };
        p.payments = { view: true, edit: true };
      } else if (user.department === 'chemical') { p.chemical = { view: true, edit: true }; }
      else if (user.department === 'production') { p.production = { view: true, edit: true }; }
      else if (user.department === 'slitting') { p.slitting = { view: true, edit: true }; }
      setUPermissions(p);
    }
    
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uLoginId.trim() || !uName.trim()) return;
    const cleanId = uLoginId.trim();
    const data = {
      loginId: cleanId, name: uName.trim(), department: uDept,
      shift: uDept === 'admin' || uDept === 'chemical' ? null : uShift, active: uActive,
      permissions: uPermissions,
    };
    try {
      if (editingUser) {
        if (editingUser.id && editingUser.id !== cleanId) await deleteDoc(doc(db, 'users', editingUser.id));
        else if (editingUser.loginId && editingUser.loginId !== cleanId) await deleteDoc(doc(db, 'users', editingUser.loginId));
      }
      await setDoc(doc(db, 'users', cleanId), data, { merge: true });
      setShowUserModal(false);
    } catch (err) { console.error(err); }
  };

  const handleBulkSync = async () => {
    setSyncLoading(true); setSyncMsg('');
    try {
      const items = slitRolls.map(roll => {
        const jc = jobCards.find(j => j.id === roll.jobCardId);
        return {
          jobCardId: roll.jobCardId, jobCode: jc?.jobCode || 'UNKNOWN',
          partyCode: jc?.partyCode || '', micron: jc?.micron || '',
          date: roll.date, rollNo: roll.rollNo, coilSize: roll.coilSize,
          meter: roll.meter || 0, grossWeight: roll.grossWeight,
          coreWeight: roll.coreWeight, netWeight: roll.netWeight
        };
      });
      const res = await fetch('/api/bulk-save-to-sheet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMsg(`✅ Synced ${data.count} rolls successfully!`);
      } else {
        const err = await res.json();
        setSyncMsg(`❌ Error: ${err.error}`);
      }
    } catch {
      setSyncMsg('❌ Backend not reachable. Start server.js first.');
    }
    setSyncLoading(false);
  };

  const tabs = [
    { id: 'jobCards' as const, label: 'Job Cards', icon: FileText, count: jobCards.length, gradient: 'from-blue-500 to-blue-700', lightBg: 'bg-blue-50', lightText: 'text-blue-600' },
    { id: 'users' as const, label: 'Users', icon: Users, count: users.length, gradient: 'from-violet-500 to-violet-700', lightBg: 'bg-violet-50', lightText: 'text-violet-600' },
    { id: 'chemicals' as const, label: 'Chemicals', icon: FlaskConical, count: chemicals.length, gradient: 'from-emerald-500 to-emerald-700', lightBg: 'bg-emerald-50', lightText: 'text-emerald-600' },
    { id: 'factoryRolls' as const, label: 'Rolls', icon: Layers, count: undefined, gradient: 'from-amber-500 to-amber-700', lightBg: 'bg-amber-50', lightText: 'text-amber-600' },
    { id: 'paymentTracker' as const, label: 'Payments', icon: CreditCard, count: undefined, gradient: 'from-rose-500 to-rose-700', lightBg: 'bg-rose-50', lightText: 'text-rose-600' },
    { id: 'stock' as const, label: 'Stock', icon: Briefcase, count: undefined, gradient: 'from-teal-500 to-teal-700', lightBg: 'bg-teal-50', lightText: 'text-teal-600' },
  ];

  return (
    <div className="space-y-4 pb-[80px] animate-fade-in w-full">

      {/* HOME DASHBOARD */}
      {activeTab === 'home' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => navigateToTab(tab.id)}
              className="relative app-card p-6 flex flex-col items-center justify-center gap-4 hover:shadow-lg transition-shadow bg-white rounded-3xl"
            >
              <div className={`p-4 rounded-2xl ${tab.lightBg} ${tab.lightText}`}>
                <tab.icon className="w-10 h-10" />
              </div>
              <span className="text-base font-bold text-gray-900">{tab.label}</span>
              
              {tab.count !== undefined && (
                <span className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB: JOB CARDS ────────────────────────────────────── */}
      {activeTab === 'jobCards' && (
        <div className="space-y-4 animate-fade-in relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search job code, party…" value={jobCardSearch}
                onChange={e => setJobCardSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
              {jobCardSearch && <button onClick={() => setJobCardSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
            </div>
          </div>

          {filteredJobCards.length === 0 ? (
            <div className="app-card p-10 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{jobCardSearch ? 'No matching job cards.' : 'No job cards yet. Create one below.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredJobCards.map(jc => {
                const summary = calculateJobCardWastage(jc.id, prodRolls, slitRolls, prodWastages);
                const isRunning = jc.slittingStatus?.toLowerCase() === 'running';
                return (
                  <div key={jc.id} onClick={() => setSelectedJobCardForDetail(jc)} className={`app-card p-4 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow ${isRunning ? 'border-emerald-300 bg-emerald-50/50 running-card' : ''}`}>
                    {/* Top */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-2">
                        <span className={`inline-block font-mono text-xl font-black px-3 py-1 rounded-xl border shadow-sm ${
                          isRunning ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-amber-100 border-amber-300 text-amber-900'
                        }`}>{jc.jobCode}</span>
                        <div className="text-sm font-semibold text-gray-700">{getPartyName(jc.partyCode)}</div>
                      </div>
                      <div onClick={e => e.stopPropagation()} className="flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Slit Status</span>
                          <select value={jc.slittingStatus || 'pending'}
                            onChange={e => handleUpdateStatus(jc.id, e.target.value as JobCardStatus, 'slittingStatus')}
                            className="text-xs font-bold rounded-lg px-2 py-1.5 border cursor-pointer bg-white border-gray-300 text-gray-700 focus:outline-none shadow-sm">
                            <option value="running">🔥 Running</option>
                            <option value="pending">⏳ Pending</option>
                            <option value="completed">✅ Completed</option>
                            <option value="dispatched">🚚 Dispatched</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg border border-blue-100">
                        {jc.size}
                      </span>
                      <span className="text-[11px] font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-lg border border-purple-100">
                        {jc.micron} Mic
                      </span>
                      <span className="text-[11px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-100">
                        {formatWeight(jc.totalQuantity)} kg
                      </span>
                    </div>
                    {jc.coilSizes?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">Coils:</span>
                        {jc.coilSizes.map(cs => (
                          <span key={cs} className="text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{cs}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setPdfModalJobCard(jc); }}
                          className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-bold text-xs btn-press">
                          <FileText className="w-4 h-4" /><span>Generate PDF</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openJobCardEdit(jc); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeletingJobCard(jc); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {permissions?.edit !== false && (
            <button onClick={openJobCardCreate} className="fab-btn">
              <Plus className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      {/* ── TAB: USERS ─────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fade-in relative">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">System Users</p>
          </div>
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 bg-slate-50 rounded-2xl">No users yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map(u => {
                const deptColor: Record<string, string> = {
                  admin: 'bg-purple-100 text-purple-800', production: 'bg-emerald-100 text-emerald-800',
                  slitting: 'bg-indigo-100 text-indigo-800', chemical: 'bg-amber-100 text-amber-800',
                };
                return (
                  <div key={u.id || u.loginId} className="app-card p-4 flex items-center gap-4 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-lg font-black text-slate-700">{(u.name || u.loginId).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-base font-bold text-gray-900">{u.name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase ${deptColor[u.department] || 'bg-slate-100 text-slate-600'}`}>{u.department}</span>
                        {u.shift && <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Shift {u.shift}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-500">{u.loginId}</span>
                        <span className={`text-xs font-bold ${u.active ? 'text-emerald-600' : 'text-rose-500'}`}>· {u.active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                    <button onClick={() => openUserEdit(u)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-gray-400 hover:text-gray-700"><Edit2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
          )}
          {permissions?.edit !== false && (
            <button onClick={openUserCreate} className="fab-btn">
              <Plus className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      {/* ── TAB: CHEMICALS ─────────────────────────────────────── */}
      {activeTab === 'chemicals' && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Chemical Inventory (Admin View)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {chemicals.map(c => {
              const totalPurchased = purchases.filter(p => p.chemicalId === c.id).reduce((s, p) => s + (p.quantity || 0), 0);
              const totalUsed = usages.filter(u => u.chemicalId === c.id).reduce((s, u) => s + (u.quantityUsed || 0), 0);
              const stock = totalPurchased - totalUsed;
              const pct = totalPurchased > 0 ? Math.max(0, Math.min(100, (stock / totalPurchased) * 100)) : 0;
              return (
                <div key={c.id} className="app-card p-3.5">
                  <p className="text-xs font-bold text-gray-900 truncate">{c.name}</p>
                  <div className={`text-xl font-black font-mono mt-1 ${stock > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatWeight(stock)}<span className="text-xs font-normal text-gray-400 ml-1">{c.unit}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct > 30 ? 'bg-emerald-500' : pct > 10 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">In: {formatWeight(totalPurchased)} · Used: {formatWeight(totalUsed)}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Purchase Logs</p>
          <div className="app-card overflow-hidden">
            {purchases.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No purchases.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {[...purchases].reverse().slice(0, 20).map(p => {
                  const chem = chemicals.find(c => c.id === p.chemicalId);
                  return (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{chem?.name || 'Chemical'}</p>
                        <p className="text-xs text-gray-400">{p.date} · {p.addedBy}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        +{formatWeight(p.quantity)} {chem?.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: FACTORY ROLLS ─────────────────────────────────── */}
      {activeTab === 'factoryRolls' && (
        <div className="space-y-4 animate-fade-in">
          <div className="app-card p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Google Sheets Sync</h3>
            <p className="text-xs text-gray-500 mb-3">Sync all slitting rolls to Google Sheets (one tab per job card).</p>
            {syncMsg && (
              <div className={`mb-3 text-sm font-semibold px-3 py-2.5 rounded-xl border ${
                syncMsg.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
              }`}>{syncMsg}</div>
            )}
            <button onClick={handleBulkSync} disabled={syncLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm btn-press disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
              <span>{syncLoading ? 'Syncing…' : 'Sync All to Sheets'}</span>
            </button>
          </div>

          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-gray-900">Production Rolls</h3>
              <span className="ml-auto text-xs text-gray-400">{prodRolls.length} total</span>
            </div>
            {prodRolls.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No production rolls.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                {prodRolls.map(r => (
                  <div key={r.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-emerald-700">#{r.rollNo}</span>
                        <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md shadow-sm">Shift {r.shift}</span>
                      </div>
                      <div className="text-sm font-black text-gray-900">{formatWeight(r.netWeight)} <span className="font-normal text-gray-500">kg</span></div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="text-xs font-semibold text-slate-500">{r.joints} Joints</div>
                      {r.takenBySlitting
                        ? <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">Taken</span>
                        : <span className="text-[10px] text-gray-400 italic">Pending</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Slitting Rolls</h3>
              <span className="ml-auto text-xs text-gray-400">{slitRolls.length} total</span>
            </div>
            {slitRolls.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No slitting rolls.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                {slitRolls.map(r => (
                  <div key={r.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-blue-700">#{r.rollNo}</span>
                        <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md shadow-sm">Shift {r.shift}</span>
                      </div>
                      <div className="text-sm font-black text-gray-900">{formatWeight(r.netWeight)} <span className="font-normal text-gray-500">kg</span></div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">{r.coilSize}</div>
                      <div className="text-xs font-mono text-gray-500">{r.meter ? `${r.meter}m` : '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PAYMENT TRACKER ──────────────────────────────── */}
      {activeTab === 'paymentTracker' && (
        <div className="animate-fade-in">
          <PaymentTrackerModule />
        </div>
      )}

      {/* ── TAB: STOCK ────────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-gray-900">Finished Stock</h2>
              <p className="text-sm text-gray-500 mt-0.5">Inventory from Completed Job Cards</p>
            </div>
            <button
              onClick={async () => {
                const completedJobCards = jobCards.filter(jc => jc.slittingStatus === 'completed');
                const completedSlitRolls = slitRolls.filter(r => completedJobCards.some(jc => jc.id === r.jobCardId));
                const stockGroups: Record<string, { size: string, micron: string, weight: number, count: number }> = {};
                completedSlitRolls.forEach(roll => {
                  const jc = completedJobCards.find(j => j.id === roll.jobCardId);
                  if (jc) {
                    const size = roll.coilSize || jc.size;
                    const key = `${size}-${jc.micron}`;
                    if (!stockGroups[key]) stockGroups[key] = { size, micron: jc.micron, weight: 0, count: 0 };
                    stockGroups[key].weight += (roll.netWeight || 0);
                    stockGroups[key].count += 1;
                  }
                });
                const stockList = Object.values(stockGroups).sort((a, b) => a.size.localeCompare(b.size));
                
                let msg = `📦 *FINISHED STOCK INVENTORY*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
                if (stockList.length === 0) {
                  msg += `No stock available.\n`;
                } else {
                  stockList.forEach(item => {
                    msg += `📐 *${item.size} x ${item.micron} Mic*\n`;
                    msg += `⚖️ *${formatWeight(item.weight)} Kg*  |  📦 *${item.count} Rolls*\n`;
                    msg += `----------------------------\n`;
                  });
                }
                msg += `\n_Generated via Sunshine ERP_`;

                if (navigator.share) {
                  try {
                    await navigator.share({ text: msg });
                  } catch {
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                  }
                } else {
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }
              }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors btn-press shadow-sm"
            >
              <span>Share to WhatsApp</span>
            </button>
          </div>

          <div className="app-card overflow-hidden">
            {(() => {
              const completedJobCards = jobCards.filter(jc => jc.slittingStatus === 'completed');
              const completedSlitRolls = slitRolls.filter(r => completedJobCards.some(jc => jc.id === r.jobCardId));
              const stockGroups: Record<string, { size: string, micron: string, weight: number, count: number }> = {};
              completedSlitRolls.forEach(roll => {
                const jc = completedJobCards.find(j => j.id === roll.jobCardId);
                if (jc) {
                  const size = roll.coilSize || jc.size;
                  const key = `${size}-${jc.micron}`;
                  if (!stockGroups[key]) stockGroups[key] = { size, micron: jc.micron, weight: 0, count: 0 };
                  stockGroups[key].weight += (roll.netWeight || 0);
                  stockGroups[key].count += 1;
                }
              });
              const stockList = Object.values(stockGroups).sort((a, b) => a.size.localeCompare(b.size));

              if (stockList.length === 0) {
                return <div className="p-8 text-center text-sm text-gray-400">No completed stock available.</div>;
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {stockList.map((item, i) => (
                    <div key={i} className="app-card p-4 flex flex-col justify-between gap-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">{item.size}</span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">{item.micron} Mic</span>
                        </div>
                        <div className="text-sm font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{item.count} Rolls</div>
                      </div>
                      <div className="text-2xl font-black font-mono text-emerald-700">
                        {formatWeight(item.weight)}<span className="text-sm font-normal text-gray-500 ml-1">kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL: JOB CARD FORM ──────────────────────────────── */}
      {showJobCardModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowJobCardModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-[28px] sm:rounded-2xl shadow-2xl animate-slide-up z-50 max-h-[90vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-0">
            <div className="flex justify-center pt-3 pb-2 sm:hidden"><div className="w-10 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingJobCard ? 'Edit Job Card' : 'New Job Card'}</h2>
              <button onClick={() => setShowJobCardModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveJobCard} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Job Code"><input type="text" value={jcCode} onChange={e => setJcCode(e.target.value)} required className={inputCls} /></FormField>
                <FormField label="Date"><input type="date" value={jcDate} onChange={e => setJcDate(e.target.value)} className={inputCls} /></FormField>
                <div className="col-span-2">
                  <FormField label="Party">
                    <select value={jcPartyCode} onChange={e => setJcPartyCode(e.target.value)} required className={selectCls}>
                      <option value="">-- Select Party --</option>
                      {Object.entries(PARTIES).map(([code, name]) => (
                        <option key={code} value={code}>{name} ({code})</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <FormField label="Size"><input type="text" placeholder="e.g. 1000mm" value={jcSize} onChange={e => setJcSize(e.target.value)} className={inputCls} /></FormField>
                <FormField label="Micron"><input type="text" placeholder="e.g. 12" value={jcMicron} onChange={e => setJcMicron(e.target.value)} className={inputCls} /></FormField>
                <div className="col-span-2">
                  <FormField label="Total Quantity (kg)"><input type="number" step="0.001" placeholder="0.000" value={jcTotalQty} onChange={e => setJcTotalQty(e.target.value)} className={inputCls} /></FormField>
                </div>
                <div className="col-span-2">
                  <FormField label="Status">
                    <select value={jcStatus} onChange={e => setJcStatus(e.target.value as JobCardStatus)} className={selectCls}>
                      <option value="pending">⏳ Pending</option>
                      <option value="running">🔥 Running</option>
                      <option value="completed">✅ Completed</option>
                      <option value="dispatched">🚚 Dispatched</option>
                    </select>
                  </FormField>
                </div>
                <div className="col-span-2">
                  <FormField label="Coil Sizes">
                    <div className="flex gap-2 mb-3">
                      <input type="text" placeholder="e.g. 230mm" value={jcCoilSizesInput}
                        onChange={e => setJcCoilSizesInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCoilSizeTag())}
                        className={inputCls} />
                      <button type="button" onClick={addCoilSizeTag} className="shrink-0 px-4 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold rounded-xl text-sm transition-colors">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {jcCoilSizesList.map((size, i) => (
                        <span key={i} className="flex items-center gap-1 text-sm font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-full">
                          {size}
                          <button type="button" onClick={() => setJcCoilSizesList(jcCoilSizesList.filter((_, idx) => idx !== i))} className="text-amber-600 hover:text-rose-600"><X className="w-4 h-4" /></button>
                        </span>
                      ))}
                    </div>
                  </FormField>
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-full mt-4 transition-colors text-base shadow-md">
                {editingJobCard ? 'Update Job Card' : 'Create Job Card'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: USER FORM ──────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowUserModal(false)} />
          <div className="relative bg-white w-full max-w-md rounded-t-[28px] sm:rounded-2xl shadow-2xl animate-slide-up z-50 max-h-[90vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-0">
            <div className="flex justify-center pt-3 pb-2 sm:hidden"><div className="w-10 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingUser ? 'Edit User' : 'New User'}</h2>
              <button onClick={() => setShowUserModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <FormField label="Login ID"><input type="text" placeholder="e.g. worker001" value={uLoginId} onChange={e => setULoginId(e.target.value)} required className={inputCls} autoCapitalize="none" /></FormField>
              <FormField label="Full Name"><input type="text" placeholder="e.g. Ramesh Kumar" value={uName} onChange={e => setUName(e.target.value)} required className={inputCls} /></FormField>
              <FormField label="Department / Role">
                <select value={uDept} onChange={e => setUDept(e.target.value as any)} className={selectCls}>
                  <option value="production">Production</option>
                  <option value="slitting">Slitting</option>
                  <option value="chemical">Chemical</option>
                  <option value="admin">Admin</option>
                  <option value="custom">Custom Permissions</option>
                </select>
              </FormField>

              {uDept === 'custom' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Module Permissions</label>
                  <div className="space-y-4">
                    {['admin', 'payments', 'production', 'slitting', 'chemical'].map(mod => (
                      <div key={mod} className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900 capitalize">{mod === 'admin' ? 'App Dashboard' : mod}</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={uPermissions[mod].view} onChange={e => setUPermissions({...uPermissions, [mod]: {...uPermissions[mod], view: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            View
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={uPermissions[mod].edit} onChange={e => setUPermissions({...uPermissions, [mod]: {...uPermissions[mod], edit: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            Edit
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(uDept === 'production' || uDept === 'slitting' || uDept === 'custom') && (
                <FormField label="Shift (Optional)">
                  <select value={uShift || ''} onChange={e => setUShift(e.target.value as Shift)} className={selectCls}>
                    <option value="">No Shift</option>
                    <option value="A">Shift A</option>
                    <option value="B">Shift B</option>
                    <option value="C">Shift C</option>
                  </select>
                </FormField>
              )}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-base font-bold text-gray-900">Account Active</span>
                <button type="button" onClick={() => setUActive(!uActive)}
                  className={`w-12 h-6 rounded-full transition-all relative ${uActive ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${uActive ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-full mt-4 transition-colors text-base shadow-md">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRM ─────────────────────────────── */}
      {deletingJobCard && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeletingJobCard(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-[28px] sm:rounded-2xl shadow-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6 animate-slide-up z-50">
            <div className="flex justify-center mb-4 sm:hidden"><div className="w-10 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Job Card?</h3>
              <p className="text-base text-gray-500 mb-2">
                This will delete <span className="font-bold text-gray-900">{deletingJobCard.jobCode}</span> and all its linked rolls.
              </p>
              <p className="text-sm text-rose-600 font-semibold mb-6">This action cannot be undone.</p>
              {deleteError && <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-4">{deleteError}</div>}
              <div className="flex gap-3">
                <button onClick={() => setDeletingJobCard(null)} disabled={isDeleting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-full transition-colors text-base">Cancel</button>
                <button onClick={handleConfirmDeleteJobCard} disabled={isDeleting}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-full transition-colors text-base shadow-md disabled:opacity-60">
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: JOB CARD DETAIL ────────────────────────────── */}
      {selectedJobCardForDetail && (
        <JobCardDetailModal
          jobCard={selectedJobCardForDetail}
          prodRolls={prodRolls} slitRolls={slitRolls} prodWastages={prodWastages}
          onClose={() => setSelectedJobCardForDetail(null)}
          onDelete={jc => { setSelectedJobCardForDetail(null); setDeletingJobCard(jc); }}
        />
      )}

      {/* ── MODAL: ROLL PDF DOWNLOAD ───────────────────────────── */}
      {pdfModalJobCard && (
        <RollPDFModal
          jobCard={pdfModalJobCard}
          prodRolls={prodRolls}
          slitRolls={slitRolls}
          onClose={() => setPdfModalJobCard(null)}
        />
      )}
    </div>
  );
};
