import React, { useState, useEffect } from 'react';
import { User, JobCard, ProductionRoll, ProductionWastage, SlittingRoll } from '../types';
import { formatWeight, calculateJobCardWastage } from '../utils/formatters';
import { Layers, Plus, Trash2, Edit2, Check, X, Search, ChevronRight, FileText } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useBackButton } from '../utils/useBackButton';

const formatToDDMM = (dateStr: string) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
  return dateStr;
};

interface ProductionModuleProps {
  currentUser: User;
  jobCards: JobCard[];
  prodRolls: ProductionRoll[];
  prodWastages: ProductionWastage[];
  slitRolls: SlittingRoll[];
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    running: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
    dispatched: 'bg-purple-100 text-purple-800 border-purple-200',
  };
  const emoji: Record<string, string> = { running: '🔥', pending: '⏳', completed: '✅', dispatched: '🚚' };
  const s = status?.toLowerCase() || 'pending';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${map[s] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      <span>{emoji[s] || ''}</span><span className="capitalize">{status}</span>
    </span>
  );
};

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono font-black text-black placeholder:text-gray-400 placeholder:font-sans placeholder:font-normal focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";

export const ProductionModule: React.FC<ProductionModuleProps> = ({ currentUser, jobCards, prodRolls, prodWastages, slitRolls }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const statusPriority: Record<string, number> = { running: 1, pending: 2, completed: 3, dispatched: 4 };
  const sortedJobCards = [...jobCards].sort((a, b) =>
    (statusPriority[a.status?.toLowerCase()] || 99) - (statusPriority[b.status?.toLowerCase()] || 99)
  );

  const filteredJobCards = sortedJobCards.filter((jc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (jc.jobCode || '').toLowerCase().includes(q) ||
      (jc.partyCode || '').toLowerCase().includes(q) ||
      (jc.size || '').toLowerCase().includes(q) ||
      (jc.status || '').toLowerCase().includes(q)
    );
  });

  const handleUpdateStatus = async (jcId: string, newStatus: string) => {
    try { await updateDoc(doc(db, 'jobCards', jcId), { status: newStatus as any }); }
    catch (err) { console.error(err); }
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

  const [rollDate, setRollDate] = useState(getTodayString());
  const [grossWeight, setGrossWeight] = useState('');
  const [coreWeight, setCoreWeight] = useState('');
  const [joints, setJoints] = useState('0');
  const [editingRollId, setEditingRollId] = useState<string | null>(null);
  const [editGross, setEditGross] = useState('');
  const [editCore, setEditCore] = useState('');
  const [editJoints, setEditJoints] = useState('');
  const [editDate, setEditDate] = useState('');

  const [activeTab, setActiveTab] = useState<'rolls' | 'wastage'>('rolls');
  const [wastageWeight, setWastageWeight] = useState('');
  const [wastageDate, setWastageDate] = useState(getTodayString());
  const [editingWastageId, setEditingWastageId] = useState<string | null>(null);
  const [editWastageWeight, setEditWastageWeight] = useState('');
  const [editWastageDate, setEditWastageDate] = useState('');

  const activeProdRolls = prodRolls.filter(r => r.jobCardId === selectedJobCardId);
  const maxRollNo = activeProdRolls.reduce((max, r) => Math.max(max, Number(r.rollNo) || 0), 0);
  const nextRollNo = maxRollNo + 1;
  const totalProdOutput = activeProdRolls.reduce((s, r) => s + (r.netWeight || 0), 0);

  const startEditRoll = (roll: ProductionRoll) => {
    setEditingRollId(roll.id);
    setEditGross(String(roll.grossWeight || ''));
    setEditCore(String(roll.coreWeight || ''));
    setEditJoints(String(roll.joints || 0));
    setEditDate(roll.date || '');
  };

  const handleAddRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCardId || !grossWeight) return;
    const gross = parseFloat(grossWeight) || 0;
    const core = parseFloat(coreWeight) || 0;
    const net = Math.max(0, gross - core);
    try {
      await addDoc(collection(db, 'productionRolls'), {
        jobCardId: selectedJobCardId, rollNo: nextRollNo,
        shift: currentUser.shift || 'A', date: rollDate,
        grossWeight: gross, coreWeight: core, netWeight: net,
        joints: parseInt(joints, 10) || 0, takenBySlitting: false,
        createdBy: currentUser.loginId,
      });
      setGrossWeight('');
    } catch (err) { alert('Error: ' + String(err)); }
  };

  const handleUpdateRoll = async (id: string) => {
    const gross = parseFloat(editGross) || 0;
    const core = parseFloat(editCore) || 0;
    const net = Math.max(0, gross - core);
    try {
      await updateDoc(doc(db, 'productionRolls', id), {
        grossWeight: gross, coreWeight: core, netWeight: net,
        joints: parseInt(editJoints, 10) || 0, date: editDate || rollDate,
      });
      setEditingRollId(null);
    } catch (err) { alert('Failed: ' + String(err)); }
  };

  const handleDeleteRoll = async (id: string) => {
    if (window.confirm('Delete this production roll?')) {
      try { await deleteDoc(doc(db, 'productionRolls', id)); }
      catch (err) { alert('Failed: ' + String(err)); }
    }
  };

  const handleAddWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCardId || !wastageWeight) return;
    try {
      await addDoc(collection(db, 'productionWastage'), {
        jobCardId: selectedJobCardId,
        wastageWeight: parseFloat(wastageWeight) || 0,
        date: wastageDate,
        shift: currentUser.shift || 'A',
        createdBy: currentUser.loginId,
      });
      setWastageWeight('');
    } catch (err) { alert('Error: ' + String(err)); }
  };

  const handleUpdateWastage = async (id: string) => {
    try {
      await updateDoc(doc(db, 'productionWastage', id), {
        wastageWeight: parseFloat(editWastageWeight) || 0,
        date: editWastageDate || wastageDate,
      });
      setEditingWastageId(null);
    } catch (err) { alert('Failed: ' + String(err)); }
  };

  const handleDeleteWastage = async (id: string) => {
    if (window.confirm('Delete this wastage entry?')) {
      try { await deleteDoc(doc(db, 'productionWastage', id)); }
      catch (err) { alert('Failed: ' + String(err)); }
    }
  };

  if (!selectedJobCard) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full">
            Shift {currentUser.shift || 'A'}
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search job code, party, size…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
        </div>

        {filteredJobCards.length === 0 ? (
          <div className="app-card p-10 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">
              {searchQuery ? 'No matching job cards.' : 'No active job cards. Ask admin to create one.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredJobCards.map(jc => {
              const summary = calculateJobCardWastage(jc.id, prodRolls, slitRolls, prodWastages);
              const isRunning = jc.status?.toLowerCase() === 'running';
              return (
                <div key={jc.id} onClick={() => setSelectedJobCardId(jc.id)}
                  className={`w-full text-left app-card p-4 flex flex-col gap-3 cursor-pointer transition-all btn-press hover:shadow-md ${
                    isRunning ? 'border-emerald-300 bg-emerald-50/50 running-card' : ''
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-2xl font-black px-3 py-1.5 rounded-xl border shadow-sm ${
                        isRunning ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-amber-100 border-amber-300 text-amber-900'
                      }`}>{jc.jobCode}</span>
                    </div>
                    <StatusBadge status={jc.status} />
                  </div>

                  <div className="text-sm font-semibold text-gray-700">{jc.partyCode}</div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold">Size</p>
                      <p className="text-xs font-bold text-gray-900">{jc.size}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold">Micron</p>
                      <p className="text-xs font-bold text-gray-900">{jc.micron}μ</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold">Target</p>
                      <p className="text-xs font-bold font-mono text-gray-900">{formatWeight(jc.totalQuantity)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                      <p className="text-[10px] text-emerald-600 font-semibold">Prod Out</p>
                      <p className="text-xs font-black font-mono text-emerald-800">{formatWeight(summary.totalProdOutputWeight)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-2 border border-blue-100">
                      <p className="text-[10px] text-blue-600 font-semibold">Slit Out</p>
                      <p className="text-xs font-black font-mono text-blue-800">{formatWeight(summary.slittingOutputWeight)}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-2 border border-red-100">
                      <p className="text-[10px] text-red-600 font-semibold">Wastage</p>
                      <p className="text-xs font-black font-mono text-red-800">{formatWeight(summary.finalWastage)}</p>
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
    <div className="space-y-4 animate-slide-up">
      <div className="app-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Selected Job</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-3xl font-black text-emerald-900 bg-emerald-100 px-4 py-1.5 rounded-xl border border-emerald-300">
                {selectedJobCard.jobCode}
              </span>
              <StatusBadge status={selectedJobCard.status} />
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-gray-600">
              <span><span className="font-semibold">Party:</span> {selectedJobCard.partyCode}</span>
              <span><span className="font-semibold">Size:</span> {selectedJobCard.size}</span>
              {selectedJobCard.micron && <span><span className="font-semibold">Micron:</span> {selectedJobCard.micron}μ</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Shift</p>
            <p className="text-sm font-bold text-gray-700">{currentUser.shift || 'A'}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Rolls</p>
            <p className="text-sm font-black text-gray-800">{activeProdRolls.length}</p>
          </div>
          <div className="border-x border-gray-100">
            <p className="text-[10px] text-emerald-500 font-semibold uppercase">Produced</p>
            <p className="text-sm font-black text-emerald-700 font-mono">{formatWeight(totalProdOutput)}<span className="text-xs font-normal text-emerald-400"> kg</span></p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Target</p>
            <p className="text-sm font-black text-gray-800 font-mono">{formatWeight(selectedJobCard.totalQuantity)}<span className="text-xs font-normal text-gray-400"> kg</span></p>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-1 rounded-2xl flex gap-1">
        {(['rolls', 'wastage'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab ? 'segment-active text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'rolls' ? '📦 Production Rolls' : '🗑️ Wastage'}
          </button>
        ))}
      </div>

      {activeTab === 'rolls' && (
        <div className="space-y-4 animate-fade-in">
          <div className="app-card p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              Add Production Roll · <span className="font-mono text-emerald-600">{nextRollNo}</span>
            </h3>
            <form onSubmit={handleAddRoll} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Gross Wt (kg)"><input type="number" step="0.001" placeholder="0.000" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} required className={inputCls} /></FormField>
                <FormField label="Core Wt (kg)"><input type="number" step="0.001" placeholder="0.000" value={coreWeight} onChange={e => setCoreWeight(e.target.value)} className={inputCls} /></FormField>
                <FormField label="Joints"><input type="number" min="0" placeholder="0" value={joints} onChange={e => setJoints(e.target.value)} className={inputCls} /></FormField>
                <FormField label="Date"><input type="date" value={rollDate} onChange={e => setRollDate(e.target.value)} className={inputCls} /></FormField>
              </div>
              {grossWeight && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-700">Net Weight</span>
                  <span className="font-mono text-lg font-black text-emerald-900">
                    {formatWeight(Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(coreWeight) || 0)))} kg
                  </span>
                </div>
              )}
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors btn-press shadow-sm">
                <Plus className="w-4 h-4" /><span>Add Roll {nextRollNo}</span>
              </button>
            </form>
          </div>

          {activeProdRolls.length > 0 && (
            <div className="app-card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-900">Production Rolls</h3>
                <span className="text-xs font-semibold text-gray-500">{activeProdRolls.length} rolls · {formatWeight(totalProdOutput)} kg</span>
              </div>
              <div className="overflow-x-auto bg-white border border-gray-300">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#FFD966] text-black font-black text-center">
                    <tr>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Date</th>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Shift</th>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Sr. No.</th>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Gross Wt.</th>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Core Wt.</th>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Net Wt.</th>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Joints</th>
                      <th className="px-1 py-1 border border-gray-300 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...activeProdRolls].reverse().map(roll => {
                      const isEditing = editingRollId === roll.id;
                      if (isEditing) {
                        return (
                          <tr key={roll.id} className="bg-emerald-50 border border-gray-300">
                            <td colSpan={8} className="p-1 border border-gray-300">
                              <div className="flex flex-wrap gap-1 items-end">
                                <div className="flex-1 min-w-[70px]"><FormField label="Gross Wt"><input type="number" step="0.001" value={editGross} onChange={e => setEditGross(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="flex-1 min-w-[70px]"><FormField label="Core Wt"><input type="number" step="0.001" value={editCore} onChange={e => setEditCore(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="w-16"><FormField label="Joints"><input type="number" value={editJoints} onChange={e => setEditJoints(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="w-24"><FormField label="Date"><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="flex gap-1">
                                  <button onClick={() => handleUpdateRoll(roll.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg btn-press"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingRollId(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg btn-press"><X className="w-4 h-4" /></button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={roll.id} className="text-center hover:bg-gray-50">
                          <td className="px-1 py-1 border border-gray-300 font-mono text-[10px] sm:text-xs font-bold text-gray-900 whitespace-nowrap">{formatToDDMM(roll.date)}</td>
                          <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs text-gray-900">{roll.shift || '-'}</td>
                          <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs font-bold text-gray-900">{roll.rollNo}</td>
                          <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs font-bold text-gray-900">{formatWeight(roll.grossWeight)}</td>
                          <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs font-bold text-gray-900">{formatWeight(roll.coreWeight)}</td>
                          <td className="px-1 py-1 border border-gray-300 font-mono text-[10px] sm:text-xs font-black text-gray-900 font-bold">{formatWeight(roll.netWeight)}</td>
                          <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs font-bold text-gray-900">{roll.joints > 0 ? roll.joints : '-'}</td>
                          <td className="px-1 py-1 border border-gray-300 text-[10px] sm:text-xs font-bold text-gray-900">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => startEditRoll(roll)} className="p-1 text-gray-500 hover:text-gray-700"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteRoll(roll.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-[#C6E0B4] text-black font-black text-center">
                      <td colSpan={3} className="px-1 py-1 border border-gray-300 text-[10px] sm:text-xs font-bold text-gray-900">TOTAL</td>
                      <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs font-bold text-gray-900">{formatWeight(activeProdRolls.reduce((sum, r) => sum + (r.grossWeight || 0), 0))}</td>
                      <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs font-bold text-gray-900">{formatWeight(activeProdRolls.reduce((sum, r) => sum + (r.coreWeight || 0), 0))}</td>
                      <td className="px-1 py-1 border border-gray-300 font-mono font-semibold text-[10px] sm:text-xs font-bold text-gray-900">{formatWeight(activeProdRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0))}</td>
                      <td colSpan={2} className="px-1 py-1 border border-gray-300"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'wastage' && (
        <div className="space-y-4 animate-fade-in">
          <div className="app-card p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-600" /> Record Wastage
            </h3>
            <form onSubmit={handleAddWastage} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Wastage (kg)"><input type="number" step="0.001" placeholder="0.000" value={wastageWeight} onChange={e => setWastageWeight(e.target.value)} required className={inputCls} /></FormField>
                <FormField label="Date"><input type="date" value={wastageDate} onChange={e => setWastageDate(e.target.value)} className={inputCls} /></FormField>
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors btn-press shadow-sm">
                <Plus className="w-4 h-4" /><span>Add Wastage</span>
              </button>
            </form>
          </div>

          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Wastage Logs</h3>
            </div>
            {prodWastages.filter(w => w.jobCardId === selectedJobCardId).length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No wastage recorded yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {[...prodWastages.filter(w => w.jobCardId === selectedJobCardId)].reverse().map(w => {
                  const isEditing = editingWastageId === w.id;
                  if (isEditing) {
                    return (
                      <div key={w.id} className="p-4 bg-amber-50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-800">Edit Wastage</span>
                          <button onClick={() => setEditingWastageId(null)} className="text-gray-500"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField label="Wastage (kg)"><input type="number" step="0.001" value={editWastageWeight} onChange={e => setEditWastageWeight(e.target.value)} className={inputCls} /></FormField>
                          <FormField label="Date"><input type="date" value={editWastageDate} onChange={e => setEditWastageDate(e.target.value)} className={inputCls} /></FormField>
                        </div>
                        <button onClick={() => handleUpdateWastage(w.id)} className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 btn-press">
                          <Check className="w-4 h-4" /><span>Save Changes</span>
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div key={w.id} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-amber-700 bg-amber-50 inline-block px-2.5 py-1 rounded-lg border border-amber-200">
                          {formatWeight(w.wastageWeight)} kg
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Shift {w.shift} · {w.date}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingWastageId(w.id); setEditWastageWeight(String(w.wastageWeight)); setEditWastageDate(w.date); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteWastage(w.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
