import React, { useState, useEffect } from 'react';
import { User, JobCard, ProductionRoll, SlittingRoll } from '../types';
import { formatWeight } from '../utils/formatters';
import { Scissors, Plus, Trash2, Edit2, Check, X, ShieldAlert, CheckSquare, Square, ArrowDown, FileText, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';

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

  const selectedJobCard = jobCards.find((j) => j.id === selectedJobCardId);

  // Form State
  const [selectedCoilSize, setSelectedCoilSize] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [coreWeight, setCoreWeight] = useState('');
  const [linkedProdRollId] = useState('');
  const [rollDate] = useState(new Date().toISOString().split('T')[0]);

  // Edit Roll State
  const [editingRollId, setEditingRollId] = useState<string | null>(null);
  const [editCoilSize, setEditCoilSize] = useState('');
  const [editGross, setEditGross] = useState('');
  const [editCore, setEditCore] = useState('');

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

    try {
      await addDoc(collection(db, 'slittingRolls'), {
        jobCardId: selectedJobCardId,
        coilSize: selectedCoilSize,
        rollNo: nextRollNo,
        shift: currentUser.shift || 'A',
        date: rollDate,
        grossWeight: gross,
        coreWeight: core,
        netWeight: net,
        productionRollId: linkedProdRollId || null,
        createdBy: currentUser.loginId,
      });

      setGrossWeight('');
    } catch (err) {
      console.error('Error adding slitting roll:', err);
      alert('Failed to save slitting roll. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const startEditRoll = (r: SlittingRoll) => {
    setEditingRollId(r.id);
    setEditCoilSize(r.coilSize);
    setEditGross(String(r.grossWeight));
    setEditCore(String(r.coreWeight));
  };

  const cancelEditRoll = () => {
    setEditingRollId(null);
  };

  const handleUpdateRoll = async (id: string) => {
    const gross = parseFloat(editGross) || 0;
    const core = parseFloat(editCore) || 0;
    const net = Math.max(0, gross - core);

    try {
      await updateDoc(doc(db, 'slittingRolls', id), {
        coilSize: editCoilSize,
        grossWeight: gross,
        coreWeight: core,
        netWeight: net,
      });
      setEditingRollId(null);
    } catch (err) {
      console.error('Error updating slitting roll:', err);
      alert('Failed to update slitting roll. Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteRoll = async (id: string) => {
    if (window.confirm('Delete this slitting output roll?')) {
      try {
        await deleteDoc(doc(db, 'slittingRolls', id));
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>All Job Cards List for Slitting (Select to Enter Data)</span>
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
                const jcSlitRolls = slitRolls.filter((r) => r.jobCardId === jc.id);
                const totalSlit = jcSlitRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

                return (
                  <div
                    key={jc.id}
                    onClick={() => setSelectedJobCardId(jc.id)}
                    className={`cursor-pointer rounded-2xl p-4.5 transition-all border shadow-xs relative flex flex-col justify-between ${
                      isRunning
                        ? 'bg-blue-50/40 border-blue-400 hover:border-blue-500 hover:shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-extrabold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                              Job: {jc.jobCode}
                            </span>
                            {isRunning && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-600 text-white animate-pulse">
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
          {/* Simple Back Navigation Header */}
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
            <button
              onClick={() => setSelectedJobCardId('')}
              className="bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors border border-slate-200 flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Back to All Job Cards</span>
            </button>
            <div className="text-xs font-bold text-slate-700">
              Selected Job: <span className="font-mono text-blue-700">#{selectedJobCard.jobCode}</span> (Party: {selectedJobCard.partyCode})
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

          {/* SECTION 1: Production Rolls Selection (Mark Taken into Slitting) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDown className="w-4 h-4 text-purple-600" />
                <span>Production Rolls to be Taken into Slitting for #{selectedJobCard.jobCode}</span>
              </h3>
              <span className="text-[11px] text-purple-900 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200 font-mono font-bold">
                Taken: {formatWeight(takenProdWeight)} kg
              </span>
            </div>

            {activeProdRolls.length === 0 ? (
              <div className="bg-slate-50 p-4 text-center text-xs text-slate-500 rounded-xl border border-slate-200">
                No production rolls recorded for this Job Card yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {activeProdRolls.map((roll) => (
                  <button
                    key={roll.id}
                    type="button"
                    onClick={() => toggleTakenBySlitting(roll)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      roll.takenBySlitting
                        ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                        <span>Roll #{roll.rollNo}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          (Shift {roll.shift})
                        </span>
                      </div>
                      <div className="text-[11px] font-mono mt-0.5">
                        Net: <strong className="text-slate-900">{formatWeight(roll.netWeight)}</strong> kg
                      </div>
                    </div>

                    <div>
                      {roll.takenBySlitting ? (
                        <CheckSquare className="w-5 h-5 text-purple-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Table-Format Slitting Roll Entry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add Slit Roll</span>
              </h3>
            </div>

            <form onSubmit={handleAddSlitRoll} className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Coil Size</label>
                <select
                  value={selectedCoilSize}
                  onChange={(e) => setSelectedCoilSize(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-mono text-amber-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  {selectedJobCard.coilSizes?.map((cs, i) => (
                    <option key={i} value={cs}>
                      {cs}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Roll No (Auto Continuation)</label>
                <input
                  type="text"
                  value={`#${nextRollNo}`}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-blue-700"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Gross Wt (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Core Wt (Auto-fill)</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={coreWeight}
                  onChange={(e) => setCoreWeight(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Net Wt (Auto)</label>
                <div className="w-full bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 font-mono font-extrabold text-blue-800">
                  {formatWeight(
                    Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(coreWeight) || 0))
                  )}
                </div>
              </div>

              <div className="flex items-end col-span-2 sm:col-span-1">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Slit Roll</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: Slitting Output Rolls Log Table across ALL Shifts */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
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
                    <th className="p-3">Roll No</th>
                    <th className="p-3">Coil Size</th>
                    <th className="p-3">Shift</th>
                    <th className="p-3">Gross Wt</th>
                    <th className="p-3">Core Wt</th>
                    <th className="p-3">Net Wt</th>
                    <th className="p-3">Created By</th>
                    <th className="p-3 text-right">Actions</th>
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
                        <td className="p-3 font-mono font-bold text-blue-700">#{roll.rollNo}</td>

                        <td className="p-3 font-mono">
                          {isEditing ? (
                            <select
                              value={editCoilSize}
                              onChange={(e) => setEditCoilSize(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-1 text-amber-900 font-bold"
                            >
                              {selectedJobCard.coilSizes?.map((cs, i) => (
                                <option key={i} value={cs}>
                                  {cs}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-bold">
                              {roll.coilSize}
                            </span>
                          )}
                        </td>

                        <td className="p-3 font-semibold">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                            Shift {roll.shift}
                          </span>
                        </td>

                        <td className="p-3 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.001"
                              value={editGross}
                              onChange={(e) => setEditGross(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-1 font-mono text-slate-900 w-24 focus:outline-none"
                            />
                          ) : (
                            formatWeight(roll.grossWeight)
                          )}
                        </td>

                        <td className="p-3 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.001"
                              value={editCore}
                              onChange={(e) => setEditCore(e.target.value)}
                              className="bg-slate-50 border border-blue-500 rounded-lg px-2 py-1 font-mono text-slate-900 w-24 focus:outline-none"
                            />
                          ) : (
                            formatWeight(roll.coreWeight)
                          )}
                        </td>

                        <td className="p-3 font-mono font-extrabold text-blue-800">
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

                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          {roll.createdBy}
                        </td>

                        <td className="p-3 text-right">
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
        </div>
      )}
    </div>
  );
};
