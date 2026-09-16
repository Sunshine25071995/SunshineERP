import React, { useState } from 'react';
import {
  User,
  JobCard,
  Chemical,
  ChemicalPurchase,
  ChemicalUsage,
  ProductionRoll,
  SlittingRoll,
  ProductionWastage,
  Department,
  Shift,
  JobCardStatus,
} from '../types';
import { formatWeight, calculateJobCardWastage } from '../utils/formatters';
import { JobCardDetailModal } from './JobCardDetailModal';
import {
  Users,
  FileText,
  FlaskConical,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Play,
  Truck,
  PlusCircle,
  X,
  Search,
  Layers,
  Scissors,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
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
  prodWastages: ProductionWastage[];
}

export const AdminModule: React.FC<AdminModuleProps> = ({
  currentUser,
  users,
  jobCards,
  chemicals,
  purchases,
  usages,
  prodRolls,
  slitRolls,
  prodWastages,
}) => {
  const [activeTab, setActiveTab] = useState<'jobCards' | 'users' | 'chemicals' | 'factoryRolls'>('jobCards');

  // Job Card Search Filter & Priority Sorting State
  const [jobCardSearch, setJobCardSearch] = useState('');

  const statusPriority: Record<string, number> = {
    running: 1,
    pending: 2,
    completed: 3,
    dispatched: 4,
  };

  const sortedJobCards = [...jobCards].sort((a, b) => {
    const pA = statusPriority[a.status?.toLowerCase()] || 99;
    const pB = statusPriority[b.status?.toLowerCase()] || 99;
    return pA - pB;
  });

  const filteredJobCards = sortedJobCards.filter((jc) => {
    if (!jobCardSearch.trim()) return true;
    const q = jobCardSearch.toLowerCase().trim();
    return (
      (jc.jobCode || '').toLowerCase().includes(q) ||
      (jc.partyCode || '').toLowerCase().includes(q) ||
      (jc.size || '').toLowerCase().includes(q) ||
      (jc.status || '').toLowerCase().includes(q) ||
      (jc.micron || '').toLowerCase().includes(q) ||
      (jc.coilSizes || []).join(' ').toLowerCase().includes(q)
    );
  });

  // Job Card Detail Modal State
  const [selectedJobCardForDetail, setSelectedJobCardForDetail] = useState<JobCard | null>(null);

  // Job Card Create/Edit Modal State
  const [showJobCardModal, setShowJobCardModal] = useState(false);
  const [editingJobCard, setEditingJobCard] = useState<JobCard | null>(null);

  // Job Card Delete Modal State
  const [deletingJobCard, setDeletingJobCard] = useState<JobCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Job Card Form Fields
  const [jcCode, setJcCode] = useState('');
  const [jcDate, setJcDate] = useState(new Date().toISOString().split('T')[0]);
  const [jcPartyCode, setJcPartyCode] = useState('');
  const [jcSize, setJcSize] = useState('');
  const [jcMicron, setJcMicron] = useState('');
  const [jcCoilSizesInput, setJcCoilSizesInput] = useState('');
  const [jcCoilSizesList, setJcCoilSizesList] = useState<string[]>([]);
  const [jcTotalQty, setJcTotalQty] = useState('');
  const [jcStatus, setJcStatus] = useState<JobCardStatus>('pending');

  // User Create/Edit Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [uLoginId, setULoginId] = useState('');
  const [uName, setUName] = useState('');
  const [uDept, setUDept] = useState<Department>('production');
  const [uShift, setUShift] = useState<Shift>('A');
  const [uActive, setUActive] = useState(true);

  // Chemical Form State
  const [chemName, setChemName] = useState('');
  const [chemUnit, setChemUnit] = useState('kg');

  // Chemical Purchase State
  const [purchaseChemId, setPurchaseChemId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Open Job Card Form
  const openJobCardCreate = () => {
    setEditingJobCard(null);
    setJcCode(`JC-${Math.floor(1000 + Math.random() * 9000)}`);
    setJcDate(new Date().toISOString().split('T')[0]);
    setJcPartyCode('');
    setJcSize('');
    setJcMicron('');
    setJcCoilSizesInput('');
    setJcCoilSizesList(['230mm', '250mm']);
    setJcTotalQty('');
    setJcStatus('pending');
    setShowJobCardModal(true);
  };

  const openJobCardEdit = (jc: JobCard) => {
    setEditingJobCard(jc);
    setJcCode(jc.jobCode);
    setJcDate(jc.date || new Date().toISOString().split('T')[0]);
    setJcPartyCode(jc.partyCode);
    setJcSize(jc.size);
    setJcMicron(jc.micron);
    setJcCoilSizesList(jc.coilSizes || []);
    setJcCoilSizesInput('');
    setJcTotalQty(String(jc.totalQuantity || ''));
    setJcStatus(jc.status);
    setShowJobCardModal(true);
  };

  const addCoilSizeTag = () => {
    const val = jcCoilSizesInput.trim();
    if (val && !jcCoilSizesList.includes(val)) {
      setJcCoilSizesList([...jcCoilSizesList, val]);
      setJcCoilSizesInput('');
    }
  };

  const removeCoilSizeTag = (index: number) => {
    setJcCoilSizesList(jcCoilSizesList.filter((_, i) => i !== index));
  };

  const handleSaveJobCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jcCode.trim() || !jcPartyCode.trim()) return;

    const data = {
      jobCode: jcCode.trim(),
      date: jcDate,
      partyCode: jcPartyCode.trim(),
      size: jcSize.trim(),
      micron: jcMicron.trim(),
      coilSizes: jcCoilSizesList,
      totalQuantity: parseFloat(jcTotalQty) || 0,
      status: jcStatus,
      createdBy: currentUser.loginId,
      createdAt: serverTimestamp(),
    };

    try {
      if (editingJobCard) {
        await updateDoc(doc(db, 'jobCards', editingJobCard.id), data);
      } else {
        await addDoc(collection(db, 'jobCards'), data);
      }
      setShowJobCardModal(false);
    } catch (err) {
      console.error('Error saving job card:', err);
    }
  };

  const handleConfirmDeleteJobCard = async () => {
    if (!deletingJobCard) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const batch = writeBatch(db);

      // 1. Delete main job card document
      batch.delete(doc(db, 'jobCards', deletingJobCard.id));

      // 2. Delete linked production rolls
      const linkedProd = prodRolls.filter((r) => r.jobCardId === deletingJobCard.id);
      linkedProd.forEach((r) => {
        batch.delete(doc(db, 'productionRolls', r.id));
      });

      // 3. Delete linked slitting rolls
      const linkedSlit = slitRolls.filter((r) => r.jobCardId === deletingJobCard.id);
      linkedSlit.forEach((r) => {
        batch.delete(doc(db, 'slittingRolls', r.id));
      });

      // 4. Delete linked production wastage
      const linkedWastage = prodWastages.filter((w) => w.jobCardId === deletingJobCard.id);
      linkedWastage.forEach((w) => {
        batch.delete(doc(db, 'productionWastage', w.id));
      });

      await batch.commit();

      // Reset states
      setDeletingJobCard(null);
      setShowJobCardModal(false);
      if (selectedJobCardForDetail?.id === deletingJobCard.id) {
        setSelectedJobCardForDetail(null);
      }
    } catch (err: any) {
      console.error('Error deleting job card:', err);
      setDeleteError(err?.message || 'Failed to delete job card from database. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateStatus = async (jcId: string, newStatus: JobCardStatus) => {
    try {
      await updateDoc(doc(db, 'jobCards', jcId), { status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // User Management
  const openUserCreate = () => {
    setEditingUser(null);
    setULoginId('');
    setUName('');
    setUDept('production');
    setUShift('A');
    setUActive(true);
    setShowUserModal(true);
  };

  const openUserEdit = (user: User) => {
    setEditingUser(user);
    setULoginId(user.loginId);
    setUName(user.name);
    setUDept(user.department);
    setUShift(user.shift);
    setUActive(user.active);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uLoginId.trim() || !uName.trim()) return;

    const cleanId = uLoginId.trim();
    const data = {
      loginId: cleanId,
      name: uName.trim(),
      department: uDept,
      shift: uDept === 'admin' || uDept === 'chemical' ? null : uShift,
      active: uActive,
    };

    try {
      if (editingUser) {
        if (editingUser.id && editingUser.id !== cleanId) {
          await deleteDoc(doc(db, 'users', editingUser.id));
        } else if (editingUser.loginId && editingUser.loginId !== cleanId) {
          await deleteDoc(doc(db, 'users', editingUser.loginId));
        }
      }
      // Use loginId as document ID for clean lookup
      await setDoc(doc(db, 'users', cleanId), data, { merge: true });
      setShowUserModal(false);
    } catch (err) {
      console.error('Error saving user:', err);
    }
  };

  // Chemical Master & Purchase
  const handleAddChemical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chemName.trim()) return;
    try {
      await addDoc(collection(db, 'chemicals'), {
        name: chemName.trim(),
        unit: chemUnit.trim() || 'kg',
      });
      setChemName('');
    } catch (err) {
      console.error('Error adding chemical:', err);
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseChemId || !purchaseQty) return;
    try {
      await addDoc(collection(db, 'chemicalPurchases'), {
        chemicalId: purchaseChemId,
        quantity: parseFloat(purchaseQty) || 0,
        date: purchaseDate,
        addedBy: currentUser.loginId,
      });
      setPurchaseQty('');
    } catch (err) {
      console.error('Error adding chemical purchase:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Nav Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('jobCards')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'jobCards'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="tab-jobcards"
        >
          <FileText className="w-4 h-4" />
          <span>Job Cards Directory</span>
          <span className="ml-1 bg-amber-600 text-white px-1.5 py-0.2 text-[10px] rounded-full">
            {jobCards.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="tab-users"
        >
          <Users className="w-4 h-4" />
          <span>User Access Control</span>
          <span className="ml-1 bg-slate-200 text-slate-800 px-1.5 py-0.2 text-[10px] rounded-full">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('chemicals')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'chemicals'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="tab-chemicals"
        >
          <FlaskConical className="w-4 h-4" />
          <span>Chemical Stock & Purchases</span>
        </button>

        <button
          onClick={() => setActiveTab('factoryRolls')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'factoryRolls'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="tab-factory-rolls"
        >
          <Layers className="w-4 h-4" />
          <span>Factory Rolls Directory</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: JOB CARDS MANAGEMENT */}
      {/* ========================================================= */}
      {activeTab === 'jobCards' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Active Job Cards Directory
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Job Code, Party, Size, Status..."
                  value={jobCardSearch}
                  onChange={(e) => setJobCardSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                {jobCardSearch && (
                  <button
                    onClick={() => setJobCardSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                {filteredJobCards.length}/{jobCards.length}
              </span>
            </div>

            <button
              onClick={openJobCardCreate}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
              id="create-job-card-btn"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Job Card</span>
            </button>
          </div>

          {/* Card-Style Display Grid */}
          {filteredJobCards.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-xs">
              {jobCardSearch ? 'No matching Job Cards found for your search.' : 'No Job Cards created yet. Click "Create New Job Card" above to start.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobCards.map((jc) => {
                const summary = calculateJobCardWastage(jc.id, prodRolls, slitRolls, prodWastages);
                const isNearCompletion =
                  jc.status !== 'completed' &&
                  jc.status !== 'dispatched' &&
                  summary.slittingOutputWeight >= jc.totalQuantity * 0.95 &&
                  jc.totalQuantity > 0;
                const isRunning = jc.status?.toLowerCase() === 'running';

                return (
                  <div
                    key={jc.id}
                    className={`rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between border ${
                      isRunning
                        ? 'bg-emerald-100/90 border-2 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Top Bar on Card */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-mono text-2xl font-black text-blue-900 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300 inline-block shadow-sm">
                              {jc.jobCode}
                            </div>
                            <div className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300 inline-block">
                              Size: {jc.size}
                            </div>
                            {isRunning && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-emerald-600 text-white animate-pulse shadow-xs">
                                🔥 Running Top
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-900 mt-1.5">
                            Party: {jc.partyCode}
                          </div>
                        </div>

                        {/* Status Changer */}
                        <div className="flex flex-col items-end gap-1">
                          <select
                            value={jc.status || 'pending'}
                            onChange={(e) =>
                              handleUpdateStatus(jc.id, e.target.value as JobCardStatus)
                            }
                            className={`text-xs font-extrabold uppercase rounded-lg px-2 py-1 border transition-all cursor-pointer shadow-xs ${
                              jc.status?.toLowerCase() === 'running'
                                ? 'bg-emerald-600 text-white border-emerald-700 animate-pulse'
                                : jc.status?.toLowerCase() === 'completed'
                                ? 'bg-blue-600 text-white border-blue-700'
                                : jc.status?.toLowerCase() === 'dispatched'
                                ? 'bg-purple-600 text-white border-purple-700'
                                : 'bg-amber-500 text-slate-950 border-amber-600'
                            }`}
                          >
                            <option value="running" className="bg-white text-slate-900 font-bold">🔥 Running</option>
                            <option value="pending" className="bg-white text-slate-900 font-bold">⏳ Pending</option>
                            <option value="completed" className="bg-white text-slate-900 font-bold">✅ Completed</option>
                            <option value="dispatched" className="bg-white text-slate-900 font-bold">🚚 Dispatched</option>
                          </select>

                          {/* Auto Completion Suggestion Badge */}
                          {isNearCompletion && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md border border-emerald-300 font-semibold flex items-center gap-1 animate-pulse">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Slit Output ≈ Target Qty!
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Specification Pill Row */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs mb-3">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-medium">Size / Micron</span>
                          <span className="font-bold text-slate-900">
                            {jc.size} ({jc.micron} μ)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-medium">Total Target</span>
                          <span className="font-mono font-extrabold text-slate-900">
                            {formatWeight(jc.totalQuantity)} kg
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-500 block font-medium">Coil Sizes</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {jc.coilSizes?.map((c, i) => (
                              <span
                                key={i}
                                className="bg-amber-50 text-amber-900 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-200"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Live Output & Wastage Summary */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] mb-3">
                        <div className="bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-200">
                          <span className="text-emerald-700 block text-[10px] font-medium">Prod Output</span>
                          <span className="font-mono font-extrabold text-emerald-800">
                            {formatWeight(summary.totalProdOutputWeight)}
                          </span>
                        </div>

                        <div className="bg-blue-50/60 p-1.5 rounded-lg border border-blue-200">
                          <span className="text-blue-700 block text-[10px] font-medium">Slit Output</span>
                          <span className="font-mono font-extrabold text-blue-800">
                            {formatWeight(summary.slittingOutputWeight)}
                          </span>
                        </div>

                        <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                          <span className="text-amber-800 block text-[10px] font-medium">Final Wastage</span>
                          <span className="font-mono font-extrabold text-amber-900">
                            {formatWeight(summary.finalWastage)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedJobCardForDetail(jc)}
                        className="text-amber-700 hover:text-amber-800 font-bold text-xs flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Full Detail</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openJobCardEdit(jc)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Edit Job Card"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingJobCard(jc)}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Delete Job Card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: USER MANAGEMENT */}
      {/* ========================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                System Access Credentials (Login IDs)
              </h2>
              <p className="text-xs text-slate-500">
                Manage Login IDs for Chemical, Production, and Slitting departments
              </p>
            </div>
            <button
              onClick={openUserCreate}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New User ID</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Login ID</th>
                  <th className="p-3">User Name</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Shift</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {users.map((u) => (
                  <tr key={u.id || u.loginId} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-extrabold text-amber-900">{u.loginId}</td>
                    <td className="p-3 font-semibold text-slate-900">{u.name}</td>
                    <td className="p-3 capitalize">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 font-medium">
                        {u.department}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.shift ? (
                        <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                          Shift {u.shift}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.active ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Active
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold">Deactivated</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openUserEdit(u)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CHEMICAL MASTER & PURCHASES */}
      {/* ========================================================= */}
      {activeTab === 'chemicals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chemical Master & Stock */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-600" />
                <span>Add Chemical Master Item</span>
              </h3>
              <form onSubmit={handleAddChemical} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Chemical Name (e.g. Polyurethane Binder)"
                  value={chemName}
                  onChange={(e) => setChemName(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 flex-1 focus:bg-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="Unit (kg/L)"
                  value={chemUnit}
                  onChange={(e) => setChemUnit(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 w-20 focus:bg-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs shadow-xs"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Live Chemical Stock List */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Live Chemical Inventory Stock
              </h3>
              <div className="space-y-2">
                {chemicals.map((c) => {
                  const totalPurchased = purchases
                    .filter((p) => p.chemicalId === c.id)
                    .reduce((sum, p) => sum + (p.quantity || 0), 0);
                  const totalUsed = usages
                    .filter((u) => u.chemicalId === c.id)
                    .reduce((sum, u) => sum + (u.quantityUsed || 0), 0);
                  const stock = totalPurchased - totalUsed;

                  return (
                    <div
                      key={c.id}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-500">
                          Purchased: {formatWeight(totalPurchased)} | Used: {formatWeight(totalUsed)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-medium">Current Stock</div>
                        <div
                          className={`font-mono font-extrabold text-sm ${
                            stock > 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {formatWeight(stock)} {c.unit}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Record Purchase */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>Record Chemical Purchase Entry</span>
              </h3>
              <form onSubmit={handleAddPurchase} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Select Chemical</label>
                  <select
                    value={purchaseChemId}
                    onChange={(e) => setPurchaseChemId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Choose Chemical --</option>
                    {chemicals.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Purchased Quantity</label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={purchaseQty}
                      onChange={(e) => setPurchaseQty(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Date</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition-colors shadow-xs"
                >
                  Save Purchase Entry
                </button>
              </form>
            </div>

            {/* Purchase History */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Purchase History Logs
              </h3>
              <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs">
                {purchases.map((p) => {
                  const chem = chemicals.find((c) => c.id === p.chemicalId);
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{chem?.name || 'Chemical'}</div>
                        <div className="text-[10px] text-slate-500">{p.date}</div>
                      </div>
                      <div className="font-mono font-extrabold text-emerald-700">
                        +{formatWeight(p.quantity)} {chem?.unit}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: FACTORY ROLLS */}
      {/* ========================================================= */}
      {activeTab === 'factoryRolls' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Production Rolls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>All Production Department Rolls</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2">Roll</th>
                    <th className="p-2">Shift</th>
                    <th className="p-2">Net Wt</th>
                    <th className="p-2">Joints</th>
                    <th className="p-2">Slitting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {prodRolls.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 font-mono font-bold text-emerald-700">{r.rollNo}</td>
                      <td className="p-2 font-semibold">Shift {r.shift}</td>
                      <td className="p-2 font-mono">{formatWeight(r.netWeight)}</td>
                      <td className="p-2 font-mono">{r.joints}</td>
                      <td className="p-2">
                        {r.takenBySlitting ? (
                          <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.5 rounded border border-purple-200">
                            Taken
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic font-mono">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Scissors className="w-4 h-4 text-blue-600" />
                <span>All Slitting Department Rolls</span>
              </h3>
              <button
                onClick={async () => {
                  try {
                    const items = slitRolls.map(roll => {
                      const jc = jobCards.find(j => j.id === roll.jobCardId);
                      return {
                        jobCardId: roll.jobCardId,
                        jobCode: jc?.jobCode || 'UNKNOWN',
                        partyCode: jc?.partyCode || '',
                        micron: jc?.micron || '',
                        date: roll.date,
                        rollNo: roll.rollNo,
                        coilSize: roll.coilSize,
                        meter: roll.meter || 0,
                        grossWeight: roll.grossWeight,
                        coreWeight: roll.coreWeight,
                        netWeight: roll.netWeight
                      };
                    });

                    const res = await fetch('http://localhost:3001/api/bulk-save-to-sheet', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ items })
                    });
                    
                    if (res.ok) {
                      const data = await res.json();
                      alert(`Successfully synced ${data.count} slitting rolls to Google Sheets!`);
                    } else {
                      const err = await res.json();
                      alert('Failed to sync: ' + err.error);
                    }
                  } catch (e) {
                    alert('Error syncing to Google Sheets. Make sure backend is running.');
                    console.error(e);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                Sync All to Sheets
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2">Roll</th>
                    <th className="p-2">Coil Size</th>
                    <th className="p-2">Shift</th>
                    <th className="p-2">Net Wt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {slitRolls.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 font-mono font-bold text-blue-700">{r.rollNo}</td>
                      <td className="p-2 font-mono text-amber-800 font-bold">{r.coilSize}</td>
                      <td className="p-2 font-semibold">Shift {r.shift}</td>
                      <td className="p-2 font-mono">{formatWeight(r.netWeight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* JOB CARD CREATE / EDIT MODAL */}
      {/* ========================================================= */}
      {showJobCardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingJobCard ? 'Edit Job Card Specification' : 'Create New Job Card'}
              </h3>
              <button
                onClick={() => setShowJobCardModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJobCard} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Job Code</label>
                  <input
                    type="text"
                    value={jcCode}
                    onChange={(e) => setJcCode(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-amber-900 font-bold focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    value={jcDate}
                    onChange={(e) => setJcDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Party Code</label>
                <input
                  type="text"
                  placeholder="e.g. PARTY-ABC-01"
                  value={jcPartyCode}
                  onChange={(e) => setJcPartyCode(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Size</label>
                  <input
                    type="text"
                    placeholder="500mm"
                    value={jcSize}
                    onChange={(e) => setJcSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Micron (μ)</label>
                  <input
                    type="text"
                    placeholder="12"
                    value={jcMicron}
                    onChange={(e) => setJcMicron(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Total Quantity (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="1000.000"
                    value={jcTotalQty}
                    onChange={(e) => setJcTotalQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Coil Sizes Tags Array */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Coil Sizes (Target Slitting Sizes)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. 230mm"
                    value={jcCoilSizesInput}
                    onChange={(e) => setJcCoilSizesInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCoilSizeTag();
                      }
                    }}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={addCoilSizeTag}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl font-bold"
                  >
                    Add Size
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 min-h-[40px] items-center">
                  {jcCoilSizesList.length === 0 && (
                    <span className="text-[11px] text-slate-500">No coil sizes added yet.</span>
                  )}
                  {jcCoilSizesList.map((tag, i) => (
                    <span
                      key={i}
                      className="bg-amber-100 text-amber-900 font-mono text-xs font-bold px-2 py-0.5 rounded-lg border border-amber-300 flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeCoilSizeTag(i)}
                        className="hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={jcStatus}
                  onChange={(e) => setJcStatus(e.target.value as JobCardStatus)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                >
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="dispatched">Dispatched</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200">
                {editingJobCard ? (
                  <button
                    type="button"
                    onClick={() => setDeletingJobCard(editingJobCard)}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Job Card</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJobCardModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-xs"
                  >
                    Save Job Card
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* USER EDIT / CREATE MODAL */}
      {/* ========================================================= */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? `Edit User (${editingUser.loginId})` : 'Create User Login ID'}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Login ID</label>
                <input
                  type="text"
                  placeholder="e.g. 200100"
                  value={uLoginId}
                  onChange={(e) => setULoginId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-amber-900 font-bold focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">User Name</label>
                <input
                  type="text"
                  placeholder="e.g. Production Shift A Operator"
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Department</label>
                <select
                  value={uDept}
                  onChange={(e) => setUDept(e.target.value as Department)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 capitalize"
                >
                  <option value="chemical">Chemical</option>
                  <option value="production">Production</option>
                  <option value="slitting">Slitting</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {uDept !== 'admin' && uDept !== 'chemical' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Shift</label>
                  <select
                    value={uShift || 'A'}
                    onChange={(e) => setUShift(e.target.value as Shift)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="A">Shift A</option>
                    <option value="B">Shift B</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="user-active-check"
                  checked={uActive}
                  onChange={(e) => setUActive(e.target.checked)}
                  className="accent-amber-500 w-4 h-4 rounded"
                />
                <label htmlFor="user-active-check" className="text-slate-800 font-semibold">
                  Account Active
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-xs"
                >
                  Save User ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* JOB CARD FULL DETAIL VIEW MODAL */}
      {/* ========================================================= */}
      {selectedJobCardForDetail && (
        <JobCardDetailModal
          jobCard={selectedJobCardForDetail}
          prodRolls={prodRolls}
          slitRolls={slitRolls}
          prodWastages={prodWastages}
          onClose={() => setSelectedJobCardForDetail(null)}
          onDelete={(jc) => setDeletingJobCard(jc)}
        />
      )}

      {/* ========================================================= */}
      {/* JOB CARD DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {deletingJobCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-5 text-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Job Card #{deletingJobCard.jobCode}?
                </h3>
                <p className="text-xs text-slate-500">
                  Party Code: <span className="font-semibold text-slate-800">{deletingJobCard.partyCode}</span>
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium mb-3">
                {deleteError}
              </div>
            )}

            <div className="space-y-2 text-xs text-slate-600 mb-5">
              <p className="font-medium">
                Are you sure you want to permanently delete this Job Card? This action cannot be undone.
              </p>
              
              {/* Linked items warning */}
              {(() => {
                const linkedP = prodRolls.filter((r) => r.jobCardId === deletingJobCard.id).length;
                const linkedS = slitRolls.filter((r) => r.jobCardId === deletingJobCard.id).length;
                const linkedW = prodWastages.filter((w) => w.jobCardId === deletingJobCard.id).length;

                if (linkedP > 0 || linkedS > 0 || linkedW > 0) {
                  return (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Associated Factory Logs Will Also Be Deleted:</span>
                      </div>
                      <ul className="list-disc list-inside font-mono text-[10px] space-y-0.5 text-amber-800 pl-1">
                        {linkedP > 0 && <li>{linkedP} Production Roll(s)</li>}
                        {linkedS > 0 && <li>{linkedS} Slitting Roll(s)</li>}
                        {linkedW > 0 && <li>{linkedW} Production Wastage Record(s)</li>}
                      </ul>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingJobCard(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteJobCard}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
