import React, { useState, useEffect } from 'react';
import { User, JobCard, ProductionRoll, SlittingRoll, ProductionWastage } from '../types';
import { formatWeight, calculateJobCardWastage } from '../utils/formatters';
import { Plus, Trash2, Edit2, X, CheckSquare, Search, Scissors } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useBackButton } from '../utils/useBackButton';

const formatToDDMM = (dateStr: string) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
  return dateStr;
};

interface SlittingModuleProps {
  currentUser: User;
  jobCards: JobCard[];
  prodRolls: ProductionRoll[];
  slitRolls: SlittingRoll[];
  prodWastages: ProductionWastage[];
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    running: 'bg-indigo-100 text-indigo-800',
    pending: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-800',
    dispatched: 'bg-purple-100 text-purple-800',
  };
  const s = status?.toLowerCase() || 'pending';
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${map[s] || 'bg-slate-100 text-slate-700'}`}>
      <span className="capitalize">{status}</span>
    </span>
  );
};

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    {children}
  </div>
);

const md3InputCls = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50 px-4 py-3 text-base text-slate-900 outline-none transition-colors";

const BottomSheetModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div className="w-full sm:w-[500px] bg-white rounded-t-[28px] sm:rounded-3xl p-6 pb-safe animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const SlittingModule: React.FC<SlittingModuleProps> = ({ currentUser, jobCards, prodRolls, slitRolls, prodWastages }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const statusPriority: Record<string, number> = { running: 1, pending: 2, completed: 3, dispatched: 4 };
  const sortedJobCards = [...jobCards].sort((a, b) => {
    return (statusPriority[(a.slittingStatus || 'pending').toLowerCase()] || 99) - (statusPriority[(b.slittingStatus || 'pending').toLowerCase()] || 99);
  });

  const filteredJobCards = sortedJobCards.filter((jc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      String(jc.jobCode || '').toLowerCase().includes(q) ||
      String(jc.partyCode || '').toLowerCase().includes(q) ||
      String(jc.size || '').toLowerCase().includes(q) ||
      String(jc.status || '').toLowerCase().includes(q) ||
      String(jc.micron || '').toLowerCase().includes(q)
    );
  });

  const handleUpdateStatus = async (jcId: string, newStatus: string) => {
    try { await updateDoc(doc(db, 'jobCards', jcId), { slittingStatus: newStatus as any }); }
    catch (err) { console.error('Error updating status:', err); }
  };

  const [selectedJobCardId, setSelectedJobCardId] = useState<string>('');
  useBackButton(!!selectedJobCardId, () => setSelectedJobCardId(''));

  useEffect(() => {
    if (selectedJobCardId && !sortedJobCards.some(j => j.id === selectedJobCardId)) {
      setSelectedJobCardId('');
    }
  }, [sortedJobCards, selectedJobCardId]);

  const selectedJobCard = jobCards.find(j => j.id === selectedJobCardId);

  const getTodayString = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };

  const [activeTab, setActiveTab] = useState<'issue' | 'output'>('issue');
  
  const [isAddRollModalOpen, setIsAddRollModalOpen] = useState(false);
  const [selectedCoilSize, setSelectedCoilSize] = useState('');
  const [meter, setMeter] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [coreWeight, setCoreWeight] = useState('');
  const [rollDate, setRollDate] = useState(getTodayString());
  
  const [editingRollId, setEditingRollId] = useState<string | null>(null);
  const [editCoilSize, setEditCoilSize] = useState('');
  const [editMeter, setEditMeter] = useState('');
  const [editGross, setEditGross] = useState('');
  const [editCore, setEditCore] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (selectedJobCard?.coilSizes?.length > 0) setSelectedCoilSize(selectedJobCard.coilSizes[0]);
    else setSelectedCoilSize('');
  }, [selectedJobCardId, selectedJobCard]);

  useEffect(() => {
    if (selectedJobCardId) {
      const existing = slitRolls.filter(r => r.jobCardId === selectedJobCardId && r.shift === (currentUser.shift || 'A'));
      if (existing.length > 0) setCoreWeight(String(existing[0].coreWeight || ''));
    }
  }, [selectedJobCardId, slitRolls, currentUser.shift]);

  useEffect(() => {
    if (grossWeight && coreWeight !== undefined && selectedJobCard?.micron && selectedCoilSize) {
      const g = parseFloat(grossWeight) || 0;
      const c = parseFloat(coreWeight) || 0;
      const n = Math.max(0, g - c);
      const mic = parseFloat(selectedJobCard.micron) || 0;
      const cs = parseFloat(selectedCoilSize) || 0;
      if (n > 0 && mic > 0 && cs > 0) {
        const m = (n / mic / 0.00139 / cs) * 1000;
        setMeter(String(Math.ceil(m / 10) * 10));
      }
    }
  }, [grossWeight, coreWeight, selectedJobCard?.micron, selectedCoilSize]);

  useEffect(() => {
    if (editGross && editCore !== undefined && selectedJobCard?.micron && editCoilSize) {
      const g = parseFloat(editGross) || 0;
      const c = parseFloat(editCore) || 0;
      const n = Math.max(0, g - c);
      const mic = parseFloat(selectedJobCard.micron) || 0;
      const cs = parseFloat(editCoilSize) || 0;
      if (n > 0 && mic > 0 && cs > 0) {
        const m = (n / mic / 0.00139 / cs) * 1000;
        setEditMeter(String(Math.ceil(m / 10) * 10));
      }
    }
  }, [editGross, editCore, selectedJobCard?.micron, editCoilSize]);

  const activeProdRolls = prodRolls.filter(r => r.jobCardId === selectedJobCardId);
  const activeSlitRolls = slitRolls.filter(r => r.jobCardId === selectedJobCardId);
  const maxRollNo = activeSlitRolls.reduce((max, r) => Math.max(max, Number(r.rollNo) || 0), 0);
  const nextRollNo = maxRollNo + 1;
  const takenProdWeight = activeProdRolls.filter(r => r.takenBySlitting).reduce((s, r) => s + (r.netWeight || 0), 0);
  const totalSlittingOutputWeight = activeSlitRolls.reduce((s, r) => s + (r.netWeight || 0), 0);
  const slittingWastage = Math.max(0, takenProdWeight - totalSlittingOutputWeight);

  const toggleTakenBySlitting = async (roll: ProductionRoll) => {
    try { await updateDoc(doc(db, 'productionRolls', roll.id), { takenBySlitting: !roll.takenBySlitting }); }
    catch (err) { alert('Failed: ' + String(err)); }
  };

  const handleAddSlitRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCardId || !grossWeight || !selectedCoilSize) return;
    const gross = parseFloat(grossWeight) || 0;
    const core = parseFloat(coreWeight) || 0;
    const net = Math.max(0, gross - core);
    const m = parseFloat(meter) || 0;
    try {
      await addDoc(collection(db, 'slittingRolls'), {
        jobCardId: selectedJobCardId, coilSize: selectedCoilSize, meter: m,
        rollNo: nextRollNo, shift: currentUser.shift || 'A', date: rollDate,
        grossWeight: gross, coreWeight: core, netWeight: net,
        productionRollId: null, createdBy: currentUser.loginId,
      });
      if (selectedJobCard) {
        if (!selectedJobCard.slittingStatus || selectedJobCard.slittingStatus === 'pending') {
          await updateDoc(doc(db, 'jobCards', selectedJobCardId), { slittingStatus: 'running' });
        }
        fetch('/api/save-to-sheet', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobCardId: selectedJobCardId, jobCode: selectedJobCard.jobCode,
            partyCode: selectedJobCard.partyCode, micron: selectedJobCard.micron,
            date: rollDate, rollNo: nextRollNo, coilSize: selectedCoilSize,
            meter: m, grossWeight: gross, coreWeight: core, netWeight: net
          })
        }).catch(err => console.error('Failed to sync to sheets', err));
      }
      setGrossWeight(''); setMeter('');
      setIsAddRollModalOpen(false);
    } catch (err) { alert('Error: ' + String(err)); }
  };

  const startEditRoll = (roll: SlittingRoll) => {
    setEditingRollId(roll.id);
    setEditCoilSize(roll.coilSize || '');
    setEditMeter(String(roll.meter || ''));
    setEditGross(String(roll.grossWeight || ''));
    setEditCore(String(roll.coreWeight || ''));
    setEditDate(roll.date || '');
  };

  const handleUpdateRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRollId) return;
    const gross = parseFloat(editGross) || 0;
    const core = parseFloat(editCore) || 0;
    const net = Math.max(0, gross - core);
    const m = parseFloat(editMeter) || 0;
    try {
      await updateDoc(doc(db, 'slittingRolls', editingRollId), {
        coilSize: editCoilSize, meter: m, grossWeight: gross, coreWeight: core,
        netWeight: net, date: editDate || rollDate,
      });
      const rollToUpdate = slitRolls.find(r => r.id === editingRollId);
      if (selectedJobCard && rollToUpdate) {
        fetch('/api/update-sheet-row', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobCode: selectedJobCard.jobCode, partyCode: selectedJobCard.partyCode,
            micron: selectedJobCard.micron, date: editDate || rollDate,
            rollNo: rollToUpdate.rollNo, coilSize: editCoilSize, meter: m,
            grossWeight: gross, coreWeight: core, netWeight: net
          })
        }).catch(err => console.error('Failed to update sheet', err));
      }
      setEditingRollId(null);
    } catch (err) { alert('Failed: ' + String(err)); }
  };

  const handleDeleteRoll = async (id: string) => {
    if (window.confirm('Delete this roll?')) {
      const rollToDelete = slitRolls.find(r => r.id === id);
      try {
        await deleteDoc(doc(db, 'slittingRolls', id));
        if (selectedJobCard && rollToDelete) {
          fetch('/api/delete-sheet-row', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobCode: selectedJobCard.jobCode, rollNo: rollToDelete.rollNo })
          }).catch(err => console.error('Failed to delete from sheet', err));
        }
      } catch (err) { alert('Failed: ' + String(err)); }
    }
  };

  if (!selectedJobCard) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Slitting</h2>
          <div className="text-sm font-bold bg-indigo-100 text-indigo-800 px-4 py-1.5 rounded-full">
            Shift {currentUser.shift || 'A'}
          </div>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search job code, party, size…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white rounded-2xl pl-12 pr-12 py-4 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-shadow shadow-sm" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-1"><X className="w-5 h-5" /></button>}
        </div>

        {filteredJobCards.length === 0 ? (
          <div className="app-card p-12 text-center rounded-3xl bg-white flex flex-col items-center">
            <Scissors className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-500">
              {searchQuery ? 'No matching job cards.' : 'No active job cards.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobCards.map(jc => {
              const summary = calculateJobCardWastage(jc.id, prodRolls, slitRolls, prodWastages);
              const isRunning = jc.slittingStatus?.toLowerCase() === 'running';
              return (
                <div key={jc.id} onClick={() => setSelectedJobCardId(jc.id)}
                  className={`app-card p-5 rounded-3xl flex flex-col gap-4 cursor-pointer transition-all active:scale-[0.98] ${
                    isRunning ? 'bg-indigo-50/50' : 'bg-white'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold tracking-tight text-slate-900">{jc.jobCode}</span>
                      <span className="text-base font-medium text-slate-600 mt-1">{jc.partyCode}</span>
                    </div>
                    <StatusBadge status={jc.slittingStatus || 'pending'} />
                  </div>

                  <div className="flex gap-4 bg-slate-50 p-3 rounded-2xl">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 font-medium">Size</p>
                      <p className="font-bold text-slate-800">{jc.size}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 font-medium">Micron</p>
                      <p className="font-bold text-slate-800">{jc.micron}μ</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 font-medium">Target</p>
                      <p className="font-bold text-slate-800">{formatWeight(jc.totalQuantity)}kg</p>
                    </div>
                  </div>
                  
                  {(jc.coilSizes || []).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(jc.coilSizes || []).map((size: string) => (
                        <span key={size} className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl">
                          {size}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-indigo-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Prod</p>
                      <p className="text-sm font-black text-indigo-900 mt-1">{formatWeight(summary.totalProdOutputWeight)}</p>
                    </div>
                    <div className="bg-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Slit</p>
                      <p className="text-sm font-black text-slate-900 mt-1">{formatWeight(summary.slittingOutputWeight)}</p>
                    </div>
                    <div className="bg-rose-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Waste</p>
                      <p className="text-sm font-black text-rose-900 mt-1">{formatWeight(summary.finalWastage)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-[100px] animate-slide-up">
      <div className="app-card p-5 rounded-3xl bg-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Selected Job</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedJobCard.jobCode}</h2>
          </div>
          <select value={selectedJobCard.slittingStatus || 'pending'}
            onChange={e => handleUpdateStatus(selectedJobCard.id, e.target.value)}
            className="text-sm font-bold rounded-full px-4 py-2 bg-slate-100 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer">
            <option value="running">🔥 Running</option>
            <option value="pending">⏳ Pending</option>
            <option value="completed">✅ Completed</option>
            <option value="dispatched">🚚 Dispatched</option>
          </select>
        </div>
        
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
          <p className="text-base text-slate-700"><span className="font-semibold text-slate-400">Party:</span> {selectedJobCard.partyCode}</p>
          <p className="text-base text-slate-700"><span className="font-semibold text-slate-400">Size:</span> {selectedJobCard.size}</p>
          {selectedJobCard.micron && <p className="text-base text-slate-700"><span className="font-semibold text-slate-400">Micron:</span> {selectedJobCard.micron}μ</p>}
        </div>

        <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-2xl p-4">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Taken</p>
            <p className="text-lg font-black text-slate-800">{formatWeight(takenProdWeight)} <span className="text-sm font-medium text-slate-400">kg</span></p>
          </div>
          <div className="text-center border-x border-slate-200">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Slit Out</p>
            <p className="text-lg font-black text-indigo-700">{formatWeight(totalSlittingOutputWeight)} <span className="text-sm font-medium text-indigo-400">kg</span></p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Wastage</p>
            <p className="text-lg font-black text-rose-700">{formatWeight(slittingWastage)} <span className="text-sm font-medium text-rose-400">kg</span></p>
          </div>
        </div>
      </div>

      <div className="flex bg-slate-200 p-1 rounded-2xl">
        {(['issue', 'output'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab === 'issue' ? 'Raw Input' : 'Slit Output'}
          </button>
        ))}
      </div>

      {activeTab === 'issue' && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Select rolls taken by slitting</p>
          {activeProdRolls.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No production rolls for this job card.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeProdRolls.map(roll => (
                <div key={roll.id} onClick={() => toggleTakenBySlitting(roll)}
                  className={`app-card p-5 rounded-3xl cursor-pointer transition-all border-2 active:scale-95 ${
                    roll.takenBySlitting ? 'bg-indigo-50/50 border-indigo-500 shadow-md' : 'bg-white border-transparent'
                  }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        roll.takenBySlitting ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-transparent'
                      }`}>
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xl text-slate-900">Roll #{roll.rollNo}</span>
                        <p className="text-sm font-medium text-slate-500 mt-1">{formatToDDMM(roll.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net</p>
                      <p className="font-black text-xl text-indigo-700">{formatWeight(roll.netWeight)} <span className="text-sm font-medium text-indigo-400">kg</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'output' && (
        <div className="space-y-4">
          {activeSlitRolls.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No slit rolls yet. Add one using the + button.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...activeSlitRolls].reverse().map(roll => (
                <div key={roll.id} className="app-card bg-white p-5 rounded-3xl flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xl text-slate-900">Roll #{roll.rollNo}</span>
                    <span className="text-sm font-bold text-slate-400">{formatToDDMM(roll.date)} • Sh {roll.shift}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">Coil: {roll.coilSize}</span>
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">Meter: {roll.meter}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Gross</p>
                      <p className="font-bold text-slate-800">{formatWeight(roll.grossWeight)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Core</p>
                      <p className="font-bold text-slate-800">{formatWeight(roll.coreWeight)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-indigo-500 mb-1">Net</p>
                      <p className="font-black text-indigo-700">{formatWeight(roll.netWeight)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end items-center gap-2 mt-1">
                    <button onClick={() => startEditRoll(roll)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-full transition-colors"><Edit2 className="w-5 h-5" /></button>
                    <button onClick={() => handleDeleteRoll(roll.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-full transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FABs */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        {activeTab === 'output' && (
          <button onClick={() => setIsAddRollModalOpen(true)} className="fab-btn bg-indigo-600 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-transform active:scale-95">
            <Plus className="w-8 h-8" />
          </button>
        )}
      </div>

      {/* Modals */}
      <BottomSheetModal isOpen={isAddRollModalOpen} onClose={() => setIsAddRollModalOpen(false)} title={`Add Slit Roll #${nextRollNo}`}>
        <form onSubmit={handleAddSlitRoll} className="space-y-4">
          <FormField label="Coil Size">
            <div className="flex gap-2 flex-wrap mb-3">
              {(selectedJobCard.coilSizes || []).map((size: string) => (
                <button key={size} type="button" onClick={() => setSelectedCoilSize(size)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    selectedCoilSize === size
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}>
                  {size}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Or type manually" value={selectedCoilSize} onChange={e => setSelectedCoilSize(e.target.value)} required className={md3InputCls} />
          </FormField>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Meter"><input type="number" step="0.01" value={meter} onChange={e => setMeter(e.target.value)} className={md3InputCls} /></FormField>
            <FormField label="Date"><input type="date" value={rollDate} onChange={e => setRollDate(e.target.value)} className={md3InputCls} /></FormField>
            <FormField label="Gross Weight (kg)"><input type="number" step="0.001" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} required className={md3InputCls} /></FormField>
            <FormField label="Core Weight (kg)"><input type="number" step="0.001" value={coreWeight} onChange={e => setCoreWeight(e.target.value)} className={md3InputCls} /></FormField>
          </div>
          
          {grossWeight && (
            <div className="bg-indigo-50 rounded-xl p-4 flex justify-between items-center mb-2">
              <span className="font-bold text-indigo-800">Net Weight</span>
              <span className="text-xl font-black text-indigo-900">{formatWeight(Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(coreWeight) || 0)))} kg</span>
            </div>
          )}
          
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-full text-lg transition-colors">Add Slit Roll</button>
        </form>
      </BottomSheetModal>

      <BottomSheetModal isOpen={!!editingRollId} onClose={() => setEditingRollId(null)} title="Edit Slit Roll">
        <form onSubmit={handleUpdateRoll} className="space-y-4">
          <FormField label="Coil Size">
            <select value={editCoilSize} onChange={e => setEditCoilSize(e.target.value)} className={md3InputCls}>
              {(selectedJobCard.coilSizes || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Meter"><input type="number" step="0.01" value={editMeter} onChange={e => setEditMeter(e.target.value)} className={md3InputCls} /></FormField>
            <FormField label="Date"><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={md3InputCls} /></FormField>
            <FormField label="Gross Weight (kg)"><input type="number" step="0.001" value={editGross} onChange={e => setEditGross(e.target.value)} required className={md3InputCls} /></FormField>
            <FormField label="Core Weight (kg)"><input type="number" step="0.001" value={editCore} onChange={e => setEditCore(e.target.value)} className={md3InputCls} /></FormField>
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-full text-lg transition-colors">Save Changes</button>
        </form>
      </BottomSheetModal>

    </div>
  );
};
