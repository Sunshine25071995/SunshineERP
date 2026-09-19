import React, { useState, useEffect } from 'react';
import { User, JobCard, ProductionRoll, SlittingRoll, ProductionWastage } from '../types';
import { formatWeight, calculateJobCardWastage } from '../utils/formatters';
import { Scissors, Plus, Trash2, Edit2, Check, X, CheckSquare, Square, Search, ChevronRight, Package } from 'lucide-react';
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

export const SlittingModule: React.FC<SlittingModuleProps> = ({ currentUser, jobCards, prodRolls, slitRolls, prodWastages }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const statusPriority: Record<string, number> = { running: 1, pending: 2, completed: 3, dispatched: 4 };
  const sortedJobCards = [...jobCards].sort((a, b) => {
    return (statusPriority[a.status?.toLowerCase()] || 99) - (statusPriority[b.status?.toLowerCase()] || 99);
  });

  const filteredJobCards = sortedJobCards.filter((jc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (jc.jobCode || '').toLowerCase().includes(q) ||
      (jc.partyCode || '').toLowerCase().includes(q) ||
      (jc.size || '').toLowerCase().includes(q) ||
      (jc.status || '').toLowerCase().includes(q) ||
      (jc.micron || '').toLowerCase().includes(q)
    );
  });

  const handleUpdateStatus = async (jcId: string, newStatus: string) => {
    try { await updateDoc(doc(db, 'jobCards', jcId), { status: newStatus as any }); }
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
        fetch('http://localhost:3001/api/save-to-sheet', {
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

  const handleUpdateRoll = async (id: string) => {
    const gross = parseFloat(editGross) || 0;
    const core = parseFloat(editCore) || 0;
    const net = Math.max(0, gross - core);
    const m = parseFloat(editMeter) || 0;
    try {
      await updateDoc(doc(db, 'slittingRolls', id), {
        coilSize: editCoilSize, meter: m, grossWeight: gross, coreWeight: core,
        netWeight: net, date: editDate || rollDate,
      });
      const rollToUpdate = slitRolls.find(r => r.id === id);
      if (selectedJobCard && rollToUpdate) {
        fetch('http://localhost:3001/api/update-sheet-row', {
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
          fetch('http://localhost:3001/api/delete-sheet-row', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobCode: selectedJobCard.jobCode, rollNo: rollToDelete.rollNo })
          }).catch(err => console.error('Failed to delete from sheet', err));
        }
      } catch (err) { alert('Failed: ' + String(err)); }
    }
  };

  // ── VIEW A: JOB CARD LIST ────────────────────────────────────
  if (!selectedJobCard) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">

          <div className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full">
            Shift {currentUser.shift || 'A'}
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search job code, party, size…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
        </div>

        {filteredJobCards.length === 0 ? (
          <div className="app-card p-10 text-center">
            <Scissors className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">
              {searchQuery ? 'No matching job cards found.' : 'No active job cards. Ask admin to create one.'}
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

  // ── VIEW B: JOB CARD DETAIL ───────────────────────────────────
  return (
    <div className="space-y-4 animate-slide-up">
      {/* Job Header Card */}
      <div className="app-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Selected Job</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-3xl font-black text-blue-900 bg-blue-100 px-4 py-1.5 rounded-xl border border-blue-300">
                {selectedJobCard.jobCode}
              </span>
              <StatusBadge status={selectedJobCard.status} />
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-gray-600">
              <span><span className="font-semibold">Party:</span> {selectedJobCard.partyCode}</span>
              <span><span className="font-semibold">Size:</span> {selectedJobCard.size}</span>
              <span><span className="font-semibold">Micron:</span> {selectedJobCard.micron}μ</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Shift</p>
            <p className="text-sm font-bold text-gray-700">{currentUser.shift || 'A'}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Taken Input</p>
            <p className="text-sm font-black text-gray-800 font-mono">{formatWeight(takenProdWeight)}<span className="text-xs font-normal text-gray-400"> kg</span></p>
          </div>
          <div className="border-x border-gray-100">
            <p className="text-[10px] text-blue-500 font-semibold uppercase">Slit Output</p>
            <p className="text-sm font-black text-blue-700 font-mono">{formatWeight(totalSlittingOutputWeight)}<span className="text-xs font-normal text-blue-400"> kg</span></p>
          </div>
          <div>
            <p className="text-[10px] text-amber-500 font-semibold uppercase">Wastage</p>
            <p className="text-sm font-black text-amber-700 font-mono">{formatWeight(slittingWastage)}<span className="text-xs font-normal text-amber-400"> kg</span></p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-gray-100 p-1 rounded-2xl flex gap-1">
        {(['issue', 'output'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab ? 'segment-active text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'issue' ? '📦 Raw Input' : '✂️ Slit Output'}
          </button>
        ))}
      </div>

      {/* TAB: Raw Input */}
      {activeTab === 'issue' && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mark production rolls taken by slitting</p>
          {activeProdRolls.length === 0 ? (
            <div className="app-card p-8 text-center">
              <Package className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No production rolls for this job card.</p>
            </div>
          ) : (
            <div className="app-card overflow-hidden">
              <div className="overflow-x-auto border border-gray-300 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#FFD966] text-black font-black text-center">
                    <tr>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 text-base sm:text-lg font-bold text-gray-900">Select</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 text-base sm:text-lg font-bold text-gray-900">Date</th>
                        <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Shift</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 text-base sm:text-lg font-bold text-gray-900">Sr. No.</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 text-base sm:text-lg font-bold text-gray-900">Net Wt.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProdRolls.map(roll => (
                      <tr key={roll.id} onClick={() => toggleTakenBySlitting(roll)}
                        className={`cursor-pointer transition-colors text-center ${
                          roll.takenBySlitting ? 'bg-[#C6E0B4]' : 'bg-white'
                        }`}>
                        <td className="px-1.5 py-0 px-1 border border-gray-300">
                          <div className={`mx-auto w-4 h-4 sm:w-5 sm:h-5 rounded-sm flex items-center justify-center ${
                            roll.takenBySlitting ? 'bg-green-700 text-white' : 'bg-white border border-gray-400 text-transparent'
                          }`}>
                            <CheckSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </div>
                        </td>
                        <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{formatToDDMM(roll.date)}</td>
                        <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{roll.rollNo}</td>
                        <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono text-base sm:text-lg font-bold text-gray-900 font-bold">{formatWeight(roll.netWeight)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Slit Output */}
      {activeTab === 'output' && (
        <div className="space-y-4 animate-fade-in">
          {/* Add Form */}
          <div className="app-card p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Add Slit Roll · <span className="font-mono text-blue-600">{nextRollNo}</span>
            </h3>
            <form onSubmit={handleAddSlitRoll} className="space-y-3">
              <FormField label="Coil Size">
                <div className="flex gap-2 flex-wrap">
                  {(selectedJobCard.coilSizes || []).map(size => (
                    <button key={size} type="button" onClick={() => setSelectedCoilSize(size)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all btn-press ${
                        selectedCoilSize === size
                          ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300'
                      }`}>
                      {size}
                    </button>
                  ))}
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Meter"><input type="number" step="0.01" placeholder="0.00" value={meter} onChange={e => setMeter(e.target.value)} className={inputCls} /></FormField>
                <FormField label="Date"><input type="date" value={rollDate} onChange={e => setRollDate(e.target.value)} className={inputCls} /></FormField>
                <FormField label="Gross Wt (kg)"><input type="number" step="0.001" placeholder="0.000" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} required className={inputCls} /></FormField>
                <FormField label="Core Wt (kg)"><input type="number" step="0.001" placeholder="0.000" value={coreWeight} onChange={e => setCoreWeight(e.target.value)} className={inputCls} /></FormField>
              </div>
              {grossWeight && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-700">Net Weight</span>
                  <span className="font-mono text-lg font-black text-blue-900">
                    {formatWeight(Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(coreWeight) || 0)))} kg
                  </span>
                </div>
              )}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors btn-press shadow-sm">
                <Plus className="w-4 h-4" /><span>Add Roll {nextRollNo}</span>
              </button>
            </form>
          </div>

          {/* Roll List */}
          {activeSlitRolls.length > 0 && (
            <div className="app-card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-900">Output Rolls</h3>
                <span className="text-xs font-semibold text-gray-500">{activeSlitRolls.length} rolls · {formatWeight(totalSlittingOutputWeight)} kg</span>
              </div>
              <div className="overflow-x-auto bg-white border border-gray-300">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#FFD966] text-black font-black text-center">
                    <tr>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Date</th>
                        <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Shift</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Sr. No.</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Gross Wt.</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Core Wt.</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Net Wt.</th>
                      <th className="px-1.5 py-0 px-1 border border-gray-300 whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...activeSlitRolls].reverse().map(roll => {
                      const isEditing = editingRollId === roll.id;
                      if (isEditing) {
                        return (
                          <tr key={roll.id} className="bg-blue-50 border border-gray-300">
                            <td colSpan={7} className="p-2 border border-gray-300">
                              <div className="flex flex-wrap gap-2 items-end">
                                <div className="flex-1 min-w-[120px]">
                                  <FormField label="Coil Size">
                                    <select value={editCoilSize} onChange={e => setEditCoilSize(e.target.value)} className={inputCls}>
                                      {(selectedJobCard.coilSizes || []).map(s => <option key={s}>{s}</option>)}
                                    </select>
                                  </FormField>
                                </div>
                                <div className="flex-1 min-w-[100px]"><FormField label="Meter"><input type="number" step="0.01" value={editMeter} onChange={e => setEditMeter(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="flex-1 min-w-[100px]"><FormField label="Gross Wt"><input type="number" step="0.001" value={editGross} onChange={e => setEditGross(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="flex-1 min-w-[100px]"><FormField label="Core Wt"><input type="number" step="0.001" value={editCore} onChange={e => setEditCore(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="w-32"><FormField label="Date"><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputCls} /></FormField></div>
                                <div className="flex gap-1">
                                  <button onClick={() => handleUpdateRoll(roll.id)} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg btn-press"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingRollId(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2.5 rounded-lg btn-press"><X className="w-4 h-4" /></button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={roll.id} className="text-center">
                          <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900 whitespace-nowrap">{formatToDDMM(roll.date)}</td>
                          <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg text-gray-900">{roll.shift || '-'}</td>
                          <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{roll.rollNo}</td>
                          <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{formatWeight(roll.grossWeight)}</td>
                          <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{formatWeight(roll.coreWeight)}</td>
                          <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-bold text-base sm:text-lg font-bold text-gray-900">{formatWeight(roll.netWeight)}</td>
                          <td className="px-1.5 py-0 px-1 border border-gray-300 text-base sm:text-lg font-bold text-gray-900">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => startEditRoll(roll)} className="p-1 text-gray-500 hover:text-gray-700"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteRoll(roll.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="bg-[#C6E0B4] text-black font-black text-center">
                      <td colSpan={2} className="px-1.5 py-0 px-1 border border-gray-300 text-base sm:text-lg font-bold text-gray-900">TOTAL</td>
                      <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{formatWeight(activeSlitRolls.reduce((sum, r) => sum + (r.grossWeight || 0), 0))}</td>
                      <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{formatWeight(activeSlitRolls.reduce((sum, r) => sum + (r.coreWeight || 0), 0))}</td>
                      <td className="px-1.5 py-0 px-1 border border-gray-300 font-mono font-semibold text-base sm:text-lg font-bold text-gray-900">{formatWeight(activeSlitRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0))}</td>
                      <td className="px-1.5 py-0 px-1 border border-gray-300"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
