import React, { useState, useEffect } from 'react';
import { User, JobCard, ProductionRoll, SlittingRoll } from '../types';
import { formatWeight } from '../utils/formatters';
import { Scissors, Plus, Trash2, Edit2, Check, X, ShieldAlert, CheckSquare, Square, ArrowDown, FileText, CheckCircle2, Search } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useBackButton } from '../utils/useBackButton';

interface SlittingModuleProps {
  currentUser: User;
  jobCards: JobCard[];
  prodRolls: ProductionRoll[];
  slitRolls: SlittingRoll[];
}

export const SlittingModule: React.FC<SlittingModuleProps> = ({
  currentUser,
  jobCards,
  prodRolls,
  slitRolls,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Sort Job Cards: 'running' first, then 'pending', then others
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
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (jc.jobCode || '').toLowerCase().includes(q) ||
      (jc.partyCode || '').toLowerCase().includes(q) ||
      (jc.size || '').toLowerCase().includes(q) ||
      (jc.status || '').toLowerCase().includes(q) ||
      (jc.micron || '').toLowerCase().includes(q) ||
      (jc.coilSizes || []).join(' ').toLowerCase().includes(q)
    );
  });

  const handleUpdateStatus = async (jcId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'jobCards', jcId), { status: newStatus as any });
    } catch (err) {
      console.error('Error updating status in SlittingModule:', err);
    }
  };

  const [selectedJobCardId, setSelectedJobCardId] = useState<string>('');
  
  // Use hardware back button logic
  useBackButton(!!selectedJobCardId, () => setSelectedJobCardId(''));

  // Validate selection
  useEffect(() => {
    if (selectedJobCardId && !sortedJobCards.some((j) => j.id === selectedJobCardId)) {
      setSelectedJobCardId('');
    }
  }, [sortedJobCards, selectedJobCardId]);

  const selectedJobCard = jobCards.find((j) => j.id === selectedJobCardId);

  // Helper to fetch current local date YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Active Sub-Tab State
  const [activeTab, setActiveTab] = useState<'issue' | 'output'>('issue');

  // Form State
  const [selectedCoilSize, setSelectedCoilSize] = useState('');
  const [meter, setMeter] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [coreWeight, setCoreWeight] = useState('');
  const [linkedProdRollId] = useState('');
  const [rollDate, setRollDate] = useState(getTodayString());

  // Edit Roll State
  const [editingRollId, setEditingRollId] = useState<string | null>(null);
  const [editCoilSize, setEditCoilSize] = useState('');
  const [editMeter, setEditMeter] = useState('');
  const [editGross, setEditGross] = useState('');
  const [editCore, setEditCore] = useState('');
  const [editDate, setEditDate] = useState('');

  // Auto coil size selection on job card change
  useEffect(() => {
    if (selectedJobCard && selectedJobCard.coilSizes?.length > 0) {
      setSelectedCoilSize(selectedJobCard.coilSizes[0]);
    } else {
      setSelectedCoilSize('');
    }
  }, [selectedJobCardId, selectedJobCard]);

  // Auto core weight pre-fill feature from first slitting roll for this shift
  useEffect(() => {
    if (selectedJobCardId) {
      const existingRolls = slitRolls.filter(
        (r) => r.jobCardId === selectedJobCardId && r.shift === (currentUser.shift || 'A')
      );
      if (existingRolls.length > 0) {
        setCoreWeight(String(existingRolls[0].coreWeight || ''));
      }
    }
  }, [selectedJobCardId, slitRolls, currentUser.shift]);

  // Filtered lists
  const activeProdRolls = prodRolls.filter((r) => r.jobCardId === selectedJobCardId);
  const activeSlitRolls = slitRolls.filter((r) => r.jobCardId === selectedJobCardId);

  // Continuous Roll No calculation across ALL shifts
  const maxRollNo = activeSlitRolls.reduce((max, r) => Math.max(max, Number(r.rollNo) || 0), 0);
  const nextRollNo = maxRollNo + 1;

  // Live calculation of Slitting Wastage
  const takenProdWeight = activeProdRolls
    .filter((r) => r.takenBySlitting)
    .reduce((sum, r) => sum + (r.netWeight || 0), 0);

  const totalSlittingOutputWeight = activeSlitRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

  const slittingWastage = Math.max(0, takenProdWeight - totalSlittingOutputWeight);

  // Toggle Production Roll Taken Status
  const toggleTakenBySlitting = async (roll: ProductionRoll) => {
    try {
      await updateDoc(doc(db, 'productionRolls', roll.id), {
        takenBySlitting: !roll.takenBySlitting,
      });
    } catch (err) {
      console.error('Error updating taken status:', err);
      alert('Failed to update status. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Add Slitting Roll
  const handleAddSlitRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCardId || !grossWeight || !selectedCoilSize) return;

    const gross = parseFloat(grossWeight) || 0;
    const core = parseFloat(coreWeight) || 0;
    const net = Math.max(0, gross - core);
    const m = parseFloat(meter) || 0;

    try {
      await addDoc(collection(db, 'slittingRolls'), {
        jobCardId: selectedJobCardId,
        coilSize: selectedCoilSize,
        meter: m,
        rollNo: nextRollNo,
        shift: currentUser.shift || 'A',
        date: rollDate,
        grossWeight: gross,
        coreWeight: core,
        netWeight: net,
        productionRollId: linkedProdRollId || null,
        createdBy: currentUser.loginId,
      });

      // Save to Google Sheets
      if (selectedJobCard) {
        fetch('http://localhost:3001/api/save-to-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobCardId: selectedJobCardId,
            jobCode: selectedJobCard.jobCode,
            partyCode: selectedJobCard.partyCode,
            micron: selectedJobCard.micron,
            date: rollDate,
            rollNo: nextRollNo,
            coilSize: selectedCoilSize,
            meter: m,
            grossWeight: gross,
            coreWeight: core,
            netWeight: net
          })
        }).catch(err => console.error('Failed to sync to sheets', err));
      }

      setGrossWeight('');
      setMeter('');
    } catch (err) {
      console.error('Error adding slitting roll:', err);
      alert('Failed to save slitting roll. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const startEditRoll = (r: SlittingRoll) => {
    setEditingRollId(r.id);
    setEditCoilSize(r.coilSize);
    setEditMeter(String(r.meter || ''));
    setEditGross(String(r.grossWeight));
    setEditCore(String(r.coreWeight));
    setEditDate(r.date || getTodayString());
  };

  const cancelEditRoll = () => {
    setEditingRollId(null);
  };

  const handleUpdateRoll = async (id: string) => {
    const gross = parseFloat(editGross) || 0;
    const core = parseFloat(editCore) || 0;
    const net = Math.max(0, gross - core);
    const m = parseFloat(editMeter) || 0;

    try {
      await updateDoc(doc(db, 'slittingRolls', id), {
        coilSize: editCoilSize,
        meter: m,
        grossWeight: gross,
        coreWeight: core,
        netWeight: net,
        date: editDate || rollDate,
      });

      // Update in Google Sheets
      const rollToUpdate = slitRolls.find(r => r.id === id);
      if (selectedJobCard && rollToUpdate) {
        fetch('http://localhost:3001/api/update-sheet-row', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobCode: selectedJobCard.jobCode,
            partyCode: selectedJobCard.partyCode,
            micron: selectedJobCard.micron,
            date: editDate || rollDate,
            rollNo: rollToUpdate.rollNo,
            coilSize: editCoilSize,
            meter: m,
            grossWeight: gross,
            coreWeight: core,
            netWeight: net
          })
        }).catch(err => console.error('Failed to update sheet', err));
      }

      setEditingRollId(null);
    } catch (err) {
      console.error('Error updating slitting roll:', err);
      alert('Failed to update slitting roll. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteRoll = async (id: string) => {
    if (window.confirm('Delete this slitting output roll?')) {
      const rollToDelete = slitRolls.find(r => r.id === id);
      try {
        await deleteDoc(doc(db, 'slittingRolls', id));

        // Delete from Google Sheets
        if (selectedJobCard && rollToDelete) {
          fetch('http://localhost:3001/api/delete-sheet-row', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobCode: selectedJobCard.jobCode,
              rollNo: rollToDelete.rollNo
            })
          }).catch(err => console.error('Failed to delete from sheet', err));
        }

      } catch (err) {
        console.error('Error deleting slitting roll:', err);
        alert('Failed to delete slitting roll. Error: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* MAIN VIEW: SHOW ALL JOB CARDS LIST ONLY */}
      {!selectedJobCard ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                All Job Cards List for Slitting
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Job Code, Party, Size, Status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
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
          </div>

          {filteredJobCards.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-xs">
              {searchQuery ? 'No matching Job Cards found for your search.' : 'No active Job Cards available. Please request Admin to create Job Cards.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobCards.map((jc) => {
                const isRunning = jc.status?.toLowerCase() === 'running';
                const jcSlitRolls = slitRolls.filter((r) => r.jobCardId === jc.id);
                const totalSlit = jcSlitRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

                return (
                  <div
                    key={jc.id}
                    onClick={() => setSelectedJobCardId(jc.id)}
                    className={`cursor-pointer rounded-2xl p-4.5 transition-all border shadow-xs relative flex flex-col justify-between ${
                      isRunning
                        ? 'bg-emerald-100/90 border-2 border-emerald-500 ring-2 ring-emerald-500/20 hover:border-emerald-600 hover:shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-2xl font-mono font-black text-blue-900 bg-blue-100 px-3 py-1 rounded-xl border border-blue-400 shadow-sm">
                              {jc.jobCode}
                            </span>
                            <span className="text-xs font-mono font-extrabold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                              Size: {jc.size}
                            </span>
                            {jc.micron && (
                              <span className="text-xs font-mono font-extrabold text-purple-900 bg-purple-100 px-2 py-1 rounded-lg border border-purple-300">
                                {jc.micron}μ
                              </span>
                            )}
                            {isRunning && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg bg-emerald-600 text-white animate-pulse shadow-xs">
                                🔥 Running Top
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-base mt-2">
                            Party: {jc.partyCode}
                          </h4>
                        </div>

                        {/* Status Selector Dropdown */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <select
                            value={jc.status || 'pending'}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(jc.id, e.target.value);
                            }}
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
                        </div>
                      </div>

                      {/* Card Specs */}
                      <div className="grid grid-cols-2 gap-2 text-xs mt-3 bg-white/90 p-2.5 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 text-[10px] block font-medium">Size & Micron</span>
                          <span className="font-semibold text-slate-900">{jc.size} ({jc.micron}μ)</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block font-medium">Target Quantity</span>
                          <span className="font-mono font-bold text-slate-900">{formatWeight(jc.totalQuantity)} kg</span>
                        </div>
                      </div>

                      {/* Coil sizes */}
                      {jc.coilSizes && jc.coilSizes.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-medium">Coils:</span>
                          {jc.coilSizes.map((cs, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-amber-100 text-amber-900 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-200"
                            >
                              {cs}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Progress & Action */}
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-[10px] text-slate-500 block">Slit Output</span>
                        <span className="font-mono font-bold text-blue-700 text-xs">
                          {jcSlitRolls.length} rolls ({formatWeight(totalSlit)} kg)
                        </span>
                      </div>

                      <button
                        type="button"
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-colors flex items-center gap-1"
                      >
                        <span>Select & Enter Data</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* SELECTED JOB CARD SLITTING DATA ENTRY WORKSPACE */
        <div className="space-y-4">
          {/* Simple Back Navigation Header (Hidden since we use hardware back button) */}
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-700 w-full">
              <span className="text-sm text-slate-500">Selected Job:</span>
              <span className="font-mono text-2xl font-black text-blue-900 bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-400 shadow-sm uppercase tracking-wider">
                {selectedJobCard.jobCode}
              </span>
              <span className="font-mono text-xs font-extrabold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                Size: {selectedJobCard.size}
              </span>
              <span className="text-slate-500 font-normal">(Party: {selectedJobCard.partyCode})</span>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Status:</span>
                <select
                  value={selectedJobCard.status || 'pending'}
                  onChange={(e) => handleUpdateStatus(selectedJobCard.id, e.target.value)}
                  className={`text-xs font-extrabold uppercase rounded-lg px-2.5 py-1 border transition-all cursor-pointer shadow-xs ${
                    selectedJobCard.status?.toLowerCase() === 'running'
                      ? 'bg-emerald-600 text-white border-emerald-700 animate-pulse'
                      : selectedJobCard.status?.toLowerCase() === 'completed'
                      ? 'bg-blue-600 text-white border-blue-700'
                      : selectedJobCard.status?.toLowerCase() === 'dispatched'
                      ? 'bg-purple-600 text-white border-purple-700'
                      : 'bg-amber-500 text-slate-950 border-amber-600'
                  }`}
                >
                  <option value="running" className="bg-white text-slate-900 font-bold">🔥 Running</option>
                  <option value="pending" className="bg-white text-slate-900 font-bold">⏳ Pending</option>
                  <option value="completed" className="bg-white text-slate-900 font-bold">✅ Completed</option>
                  <option value="dispatched" className="bg-white text-slate-900 font-bold">🚚 Dispatched</option>
                </select>
              </div>
            </div>
          </div>
          {/* Live Slitting Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Production Net Weight Taken</div>
              <div className="font-mono font-extrabold text-emerald-700 text-base mt-1">
                {formatWeight(takenProdWeight)} kg
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Slitting Output Net Weight</div>
              <div className="font-mono font-extrabold text-blue-700 text-base mt-1">
                {formatWeight(totalSlittingOutputWeight)} kg
              </div>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 shadow-xs">
              <div className="text-[11px] text-amber-800 font-bold">Live Slitting Wastage</div>
              <div className="font-mono font-extrabold text-amber-900 text-lg mt-0.5">
                {formatWeight(slittingWastage)} kg
              </div>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('issue')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'issue'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ArrowDown className="w-4 h-4" />
              <span>Production</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('output')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'output'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>Slitting</span>
            </button>
          </div>

          {/* TAB 1: Issue Production Rolls to Slitting */}
          {activeTab === 'issue' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDown className="w-4 h-4 text-purple-600" />
                  <span>Production Rolls to be Taken into Slitting for #{selectedJobCard.jobCode}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-purple-900 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200 font-mono font-bold">
                    Total Taken: {formatWeight(takenProdWeight)} kg
                  </span>
                </div>
              </div>

              {activeProdRolls.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No production rolls recorded for this Job Card yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 w-10 text-center">Select</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Roll No</th>
                        <th className="px-3 py-2">Shift</th>
                        <th className="px-3 py-2">Gross Wt (kg)</th>
                        <th className="px-3 py-2">Core Wt (kg)</th>
                        <th className="px-3 py-2">Net Wt (kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {activeProdRolls.map((roll) => {
                        const isTaken = roll.takenBySlitting;
                        return (
                          <tr
                            key={roll.id}
                            onClick={() => toggleTakenBySlitting(roll)}
                            className={`cursor-pointer transition-colors ${
                              isTaken ? 'bg-purple-50/70 hover:bg-purple-100/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleTakenBySlitting(roll)}
                                className="focus:outline-none flex items-center justify-center mx-auto"
                              >
                                {isTaken ? (
                                  <CheckSquare className="w-4 h-4 text-purple-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {roll.date || 'N/A'}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-emerald-700">
                              {roll.rollNo}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              <span className="bg-slate-100 text-slate-800 font-extrabold px-2 py-0.5 rounded border border-slate-200 text-xs">
                                {roll.shift}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">
                              {formatWeight(roll.grossWeight)}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">
                              {formatWeight(roll.coreWeight)}
                            </td>
                            <td className="px-3 py-2 font-mono font-extrabold text-emerald-800">
                              {formatWeight(roll.netWeight)}
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

          {/* TAB 2: Slitting Output Rolls Entry & Log */}
          {activeTab === 'output' && (
            <>

          {/* SECTION 2: Table-Format Slitting Roll Entry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add Slit Roll</span>
              </h3>
            </div>

            <form onSubmit={handleAddSlitRoll} className="grid grid-cols-2 sm:grid-cols-8 gap-2 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Entry Date</label>
                <input
                  type="date"
                  value={rollDate}
                  onChange={(e) => setRollDate(e.target.value)}
                  required
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Coil Size</label>
                <select
                  value={selectedCoilSize}
                  onChange={(e) => setSelectedCoilSize(e.target.value)}
                  required
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 font-mono text-amber-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500 text-xs"
                >
                  {selectedJobCard.coilSizes?.map((cs, i) => (
                    <option key={i} value={cs}>
                      {cs}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Roll No</label>
                <input
                  type="text"
                  value={nextRollNo}
                  disabled
                  className="w-full h-9 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1 font-mono font-bold text-blue-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Meter</label>
                <input
                  type="number"
                  value={meter}
                  onChange={(e) => setMeter(e.target.value)}
                  placeholder="0"
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Gross Wt (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  required
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Core Wt (Auto)</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={coreWeight}
                  onChange={(e) => setCoreWeight(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Net Wt (Auto)</label>
                <div className="w-full h-9 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1 font-mono font-extrabold text-blue-800 flex items-center text-xs">
                  {formatWeight(
                    Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(coreWeight) || 0))
                  )}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <button
                  type="submit"
                  className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 rounded-xl flex items-center justify-center gap-1 transition-colors shadow-xs text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Slit Roll</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: Slitting Output Rolls Log Table across ALL Shifts */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Full Slitting Output Rolls Log for Job Card #{selectedJobCard.jobCode}
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Total Output Weight: {formatWeight(totalSlittingOutputWeight)} kg
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Roll No</th>
                    <th className="px-3 py-2">Coil Size</th>
                    <th className="px-3 py-2">Meter</th>
                    <th className="px-3 py-2">Shift</th>
                    <th className="px-3 py-2">Gross Wt</th>
                    <th className="px-3 py-2">Core Wt</th>
                    <th className="px-3 py-2">Net Wt</th>
                    <th className="px-3 py-2">Created By</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {activeSlitRolls.map((roll) => {
                    const isOwner =
                      roll.createdBy === currentUser.loginId ||
                      roll.shift === currentUser.shift ||
                      currentUser.department === 'admin';
                    const isEditing = editingRollId === roll.id;

                    return (
                      <tr key={roll.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-1.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 focus:outline-none text-xs"
                            />
                          ) : (
                            roll.date || 'N/A'
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-blue-700">{roll.rollNo}</td>

                        <td className="px-3 py-1.5 font-mono">
                          {isEditing ? (
                            <select
                              value={editCoilSize}
                              onChange={(e) => setEditCoilSize(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-0.5 text-amber-900 font-bold text-xs"
                            >
                              {selectedJobCard.coilSizes?.map((cs, i) => (
                                <option key={i} value={cs}>
                                  {cs}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-bold text-xs">
                              {roll.coilSize}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-1.5 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editMeter}
                              onChange={(e) => setEditMeter(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 w-16 focus:outline-none text-xs"
                            />
                          ) : (
                            roll.meter || '-'
                          )}
                        </td>

                        <td className="px-3 py-1.5 font-semibold">
                          <span className="bg-slate-100 text-slate-800 font-extrabold px-2 py-0.5 rounded border border-slate-200 text-xs">
                            {roll.shift}
                          </span>
                        </td>

                        <td className="px-3 py-1.5 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.001"
                              value={editGross}
                              onChange={(e) => setEditGross(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 w-24 focus:outline-none text-xs"
                            />
                          ) : (
                            formatWeight(roll.grossWeight)
                          )}
                        </td>

                        <td className="px-3 py-1.5 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.001"
                              value={editCore}
                              onChange={(e) => setEditCore(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 w-24 focus:outline-none text-xs"
                            />
                          ) : (
                            formatWeight(roll.coreWeight)
                          )}
                        </td>

                        <td className="px-3 py-1.5 font-mono font-extrabold text-blue-800">
                          {isEditing ? (
                            formatWeight(
                              Math.max(
                                0,
                                (parseFloat(editGross) || 0) - (parseFloat(editCore) || 0)
                              )
                            )
                          ) : (
                            formatWeight(roll.netWeight)
                          )}
                        </td>

                        <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">
                          {roll.createdBy}
                        </td>

                        <td className="px-3 py-1.5 text-right">
                          {isOwner ? (
                            isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleUpdateRoll(roll.id)}
                                  className="p-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-300"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEditRoll}
                                  className="p-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => startEditRoll(roll)}
                                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRoll(roll.id)}
                                  className="p-1 rounded-lg text-red-500 hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">View-only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
