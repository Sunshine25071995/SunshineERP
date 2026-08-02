import React, { useState, useEffect } from 'react';
import { User, JobCard, ProductionRoll, ProductionWastage } from '../types';
import { formatWeight } from '../utils/formatters';
import { Layers, Plus, Trash2, Edit2, Check, X, ShieldAlert, Scale, CheckCircle2, FileText } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';

interface ProductionModuleProps {
  currentUser: User;
  jobCards: JobCard[];
  prodRolls: ProductionRoll[];
  prodWastages: ProductionWastage[];
}

export const ProductionModule: React.FC<ProductionModuleProps> = ({
  currentUser,
  jobCards,
  prodRolls,
  prodWastages,
}) => {
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

  const [selectedJobCardId, setSelectedJobCardId] = useState<string>('');

  // Validate selection
  useEffect(() => {
    if (selectedJobCardId && !sortedJobCards.some((j) => j.id === selectedJobCardId)) {
      setSelectedJobCardId('');
    }
  }, [sortedJobCards, selectedJobCardId]);

  // Selected Job Card
  const selectedJobCard = jobCards.find((j) => j.id === selectedJobCardId);

  // Helper to fetch current local date YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // New Roll Form State
  const [grossWeight, setGrossWeight] = useState('');
  const [coreWeight, setCoreWeight] = useState('');
  const [joints, setJoints] = useState('0');
  const [rollDate, setRollDate] = useState(getTodayString());

  // Manual Wastage Form State
  const [wastageInput, setWastageInput] = useState('');

  // Editing Roll State
  const [editingRollId, setEditingRollId] = useState<string | null>(null);
  const [editGross, setEditGross] = useState('');
  const [editCore, setEditCore] = useState('');
  const [editJoints, setEditJoints] = useState('');
  const [editDate, setEditDate] = useState('');

  // Auto-fill Core Weight feature from first row entry for this job card & shift
  useEffect(() => {
    if (selectedJobCardId) {
      const existingRolls = prodRolls.filter(
        (r) => r.jobCardId === selectedJobCardId && r.shift === (currentUser.shift || 'A')
      );
      if (existingRolls.length > 0) {
        setCoreWeight(String(existingRolls[0].coreWeight || ''));
      }
    }
  }, [selectedJobCardId, prodRolls, currentUser.shift]);

  // Filter rolls for active job card
  const activeJobRolls = prodRolls.filter((r) => r.jobCardId === selectedJobCardId);
  const activeJobWastages = prodWastages.filter((w) => w.jobCardId === selectedJobCardId);

  // Continuous Roll No calculation across ALL shifts
  const maxRollNo = activeJobRolls.reduce((max, r) => Math.max(max, Number(r.rollNo) || 0), 0);
  const nextRollNo = maxRollNo + 1;

  // Live computed Net Weight preview for form
  const computedGross = parseFloat(grossWeight) || 0;
  const computedCore = parseFloat(coreWeight) || 0;
  const computedNet = Math.max(0, computedGross - computedCore);

  // Totals for Dashboard
  const shiftUserRolls = activeJobRolls.filter((r) => r.shift === (currentUser.shift || 'A'));
  const totalShiftNetWeight = shiftUserRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);
  const totalJobCardNetWeight = activeJobRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

  const totalShiftWastage = activeJobWastages
    .filter((w) => w.shift === (currentUser.shift || 'A'))
    .reduce((sum, w) => sum + (w.wastageWeight || 0), 0);
  const totalJobCardWastage = activeJobWastages.reduce((sum, w) => sum + (w.wastageWeight || 0), 0);

  const handleAddRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCardId || !grossWeight) return;

    const gross = parseFloat(grossWeight) || 0;
    const core = parseFloat(coreWeight) || 0;
    const net = Math.max(0, gross - core);

    try {
      await addDoc(collection(db, 'productionRolls'), {
        jobCardId: selectedJobCardId,
        rollNo: nextRollNo,
        shift: currentUser.shift || 'A',
        date: rollDate,
        grossWeight: gross,
        coreWeight: core,
        netWeight: net,
        joints: parseInt(joints, 10) || 0,
        takenBySlitting: false,
        createdBy: currentUser.loginId,
      });

      setGrossWeight('');
      setJoints('0');
    } catch (err) {
      console.error('Error adding production roll:', err);
      alert('Failed to save production roll. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleAddWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCardId || !wastageInput) return;

    try {
      await addDoc(collection(db, 'productionWastage'), {
        jobCardId: selectedJobCardId,
        shift: currentUser.shift || 'A',
        date: rollDate,
        wastageWeight: parseFloat(wastageInput) || 0,
        createdBy: currentUser.loginId,
      });

      setWastageInput('');
    } catch (err) {
      console.error('Error adding wastage:', err);
      alert('Failed to save wastage. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const startEditRoll = (r: ProductionRoll) => {
    setEditingRollId(r.id);
    setEditGross(String(r.grossWeight));
    setEditCore(String(r.coreWeight));
    setEditJoints(String(r.joints));
    setEditDate(r.date || getTodayString());
  };

  const cancelEditRoll = () => {
    setEditingRollId(null);
  };

  const handleUpdateRoll = async (id: string) => {
    const gross = parseFloat(editGross) || 0;
    const core = parseFloat(editCore) || 0;
    const net = Math.max(0, gross - core);

    try {
      await updateDoc(doc(db, 'productionRolls', id), {
        grossWeight: gross,
        coreWeight: core,
        netWeight: net,
        joints: parseInt(editJoints, 10) || 0,
        date: editDate || rollDate,
      });
      setEditingRollId(null);
    } catch (err) {
      console.error('Error updating production roll:', err);
      alert('Failed to update roll. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteRoll = async (id: string) => {
    if (window.confirm('Delete this production roll entry?')) {
      try {
        await deleteDoc(doc(db, 'productionRolls', id));
      } catch (err) {
        console.error('Error deleting roll:', err);
        alert('Failed to delete roll. Error: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* MAIN VIEW: SHOW ALL JOB CARDS LIST ONLY */}
      {!selectedJobCard ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <span>All Job Cards List (Select to Enter Data)</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Total Job Cards: {jobCards.length}
            </span>
          </div>

          {sortedJobCards.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-xs">
              No active Job Cards available. Please request Admin to create Job Cards.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedJobCards.map((jc) => {
                const isRunning = jc.status?.toLowerCase() === 'running';
                const jcRolls = prodRolls.filter((r) => r.jobCardId === jc.id);
                const totalProd = jcRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

                return (
                  <div
                    key={jc.id}
                    onClick={() => setSelectedJobCardId(jc.id)}
                    className={`cursor-pointer rounded-2xl p-4.5 transition-all border shadow-xs relative flex flex-col justify-between ${
                      isRunning
                        ? 'bg-emerald-50/40 border-emerald-400 hover:border-emerald-500 hover:shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              Job: {jc.jobCode}
                            </span>
                            {isRunning && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-600 text-white animate-pulse">
                                🔥 Running Top
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-base mt-2">
                            Party: {jc.partyCode}
                          </h4>
                        </div>

                        {!isRunning && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                            {jc.status}
                          </span>
                        )}
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
                              className="text-[10px] bg-slate-100 text-slate-700 font-mono font-semibold px-1.5 py-0.5 rounded border border-slate-200"
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
                        <span className="text-[10px] text-slate-500 block">Rolls / Produced</span>
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          {jcRolls.length} rolls ({formatWeight(totalProd)} kg)
                        </span>
                      </div>

                      <button
                        type="button"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-colors flex items-center gap-1"
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
        /* SELECTED JOB CARD DATA ENTRY WORKSPACE */
        <div className="space-y-4">
          {/* Simple Back Navigation Header */}
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
            <button
              onClick={() => setSelectedJobCardId('')}
              className="bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors border border-slate-200 flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Back to All Job Cards</span>
            </button>
            <div className="text-xs font-bold text-slate-700">
              Selected Job: <span className="font-mono text-emerald-700">#{selectedJobCard.jobCode}</span> (Party: {selectedJobCard.partyCode})
            </div>
          </div>
          {/* Selected Job Card Details & Production Dashboard Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Shift {currentUser.shift} Output</div>
              <div className="font-mono font-extrabold text-emerald-700 text-base mt-1">
                {formatWeight(totalShiftNetWeight)} kg
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Shift {currentUser.shift} Wastage</div>
              <div className="font-mono font-extrabold text-amber-800 text-base mt-1">
                {formatWeight(totalShiftWastage)} kg
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Total Job Production</div>
              <div className="font-mono font-extrabold text-blue-700 text-base mt-1">
                {formatWeight(totalJobCardNetWeight)} kg
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Total Job Prod Wastage</div>
              <div className="font-mono font-extrabold text-purple-700 text-base mt-1">
                {formatWeight(totalJobCardWastage)} kg
              </div>
            </div>
          </div>

          {/* Table-Format Grid Entry Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Add Production Roll</span>
              </h3>
            </div>

            <form onSubmit={handleAddRoll} className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 items-end text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Entry Date</label>
                <input
                  type="date"
                  value={rollDate}
                  onChange={(e) => setRollDate(e.target.value)}
                  required
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Roll No</label>
                <input
                  type="text"
                  value={nextRollNo}
                  disabled
                  className="w-full h-9 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1 font-mono font-bold text-emerald-700 text-xs"
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
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">
                  Core Wt (Auto)
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={coreWeight}
                  onChange={(e) => setCoreWeight(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Net Wt (Auto)</label>
                <div className="w-full h-9 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1 font-mono font-extrabold text-emerald-800 flex items-center text-xs">
                  {formatWeight(computedNet)}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 truncate">Joints</label>
                <input
                  type="number"
                  value={joints}
                  onChange={(e) => setJoints(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <button
                  type="submit"
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 rounded-xl flex items-center justify-center gap-1 transition-colors shadow-xs text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Roll</span>
                </button>
              </div>
            </form>
          </div>

          {/* Roll Entries List Table across ALL Shifts */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Full Production Rolls Log for Job Card #{selectedJobCard.jobCode}
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Total Rolls: {activeJobRolls.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Roll No</th>
                    <th className="px-3 py-2">Shift</th>
                    <th className="px-3 py-2">Gross Wt (kg)</th>
                    <th className="px-3 py-2">Core Wt (kg)</th>
                    <th className="px-3 py-2">Net Wt (kg)</th>
                    <th className="px-3 py-2">Joints</th>
                    <th className="px-3 py-2">Created By</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {activeJobRolls.map((roll) => {
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
                              className="bg-slate-50 border border-emerald-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 focus:outline-none text-xs"
                            />
                          ) : (
                            roll.date || 'N/A'
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-emerald-700">
                          {roll.rollNo}
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
                              className="bg-slate-50 border border-emerald-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 w-24 focus:outline-none text-xs"
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
                              className="bg-slate-50 border border-emerald-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 w-24 focus:outline-none text-xs"
                            />
                          ) : (
                            formatWeight(roll.coreWeight)
                          )}
                        </td>

                        <td className="px-3 py-1.5 font-mono font-extrabold text-emerald-800">
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

                        <td className="px-3 py-1.5 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editJoints}
                              onChange={(e) => setEditJoints(e.target.value)}
                              className="bg-slate-50 border border-emerald-500 rounded-lg px-2 py-0.5 font-mono text-slate-900 w-16 focus:outline-none text-xs"
                            />
                          ) : (
                            roll.joints
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
                                  className="p-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300"
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

          {/* Production Manual Wastage Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-600" />
              <span>Production Department Manual Wastage Entry</span>
            </h3>

            <form onSubmit={handleAddWastage} className="flex gap-2 text-xs">
              <input
                type="number"
                step="0.001"
                placeholder="Wastage Weight in kg (0.000)"
                value={wastageInput}
                onChange={(e) => setWastageInput(e.target.value)}
                required
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition-colors shadow-xs"
              >
                Record Wastage
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
