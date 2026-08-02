import React, { useState } from 'react';
import { User, Chemical, ChemicalPurchase, ChemicalUsage } from '../types';
import { formatWeight } from '../utils/formatters';
import { FlaskConical, Plus, Trash2, Edit2, Check, X, ShieldAlert } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';

interface ChemicalModuleProps {
  currentUser: User;
  chemicals: Chemical[];
  purchases: ChemicalPurchase[];
  usages: ChemicalUsage[];
}

export const ChemicalModule: React.FC<ChemicalModuleProps> = ({
  currentUser,
  chemicals,
  purchases,
  usages,
}) => {
  // Inline entry form
  const [selectedChemId, setSelectedChemId] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);

  // Editing state
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

  const handleSaveUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChemId || !quantityUsed) return;

    try {
      await addDoc(collection(db, 'chemicalUsage'), {
        chemicalId: selectedChemId,
        quantityUsed: parseFloat(quantityUsed) || 0,
        date: usageDate,
        usedBy: currentUser.loginId,
      });

      setSelectedChemId('');
      setQuantityUsed('');
    } catch (err) {
      console.error('Error saving chemical usage:', err);
    }
  };

  const startEdit = (u: ChemicalUsage) => {
    setEditingUsageId(u.id);
    setEditQty(String(u.quantityUsed));
  };

  const cancelEdit = () => {
    setEditingUsageId(null);
    setEditQty('');
  };

  const handleUpdateUsage = async (id: string) => {
    try {
      await updateDoc(doc(db, 'chemicalUsage', id), {
        quantityUsed: parseFloat(editQty) || 0,
      });
      setEditingUsageId(null);
    } catch (err) {
      console.error('Error updating usage:', err);
    }
  };

  const handleDeleteUsage = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this usage entry?')) {
      try {
        await deleteDoc(doc(db, 'chemicalUsage', id));
      } catch (err) {
        console.error('Error deleting usage:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Chemical Inventory Stock */}
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-600" />
          <span>Live Chemical Inventory Stock</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs"
              >
                <div className="text-xs font-bold text-slate-900">{c.name}</div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-[11px] text-slate-500 font-medium">Available Stock</span>
                  <span
                    className={`font-mono font-extrabold text-base ${
                      stock > 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatWeight(stock)} {c.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline Row Entry Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-amber-600" />
          <span>Table-Format Inline Chemical Usage Entry</span>
        </h3>

        <form onSubmit={handleSaveUsage} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Chemical</label>
            <select
              value={selectedChemId}
              onChange={(e) => setSelectedChemId(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="">-- Choose Chemical --</option>
              {chemicals.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Quantity Used</label>
            <input
              type="number"
              step="0.001"
              placeholder="0.000"
              value={quantityUsed}
              onChange={(e) => setQuantityUsed(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Date</label>
            <input
              type="date"
              value={usageDate}
              onChange={(e) => setUsageDate(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Record Usage</span>
            </button>
          </div>
        </form>
      </div>

      {/* Usage Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Chemical Usage Logs
          </h3>
          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            Editable only by creator (ID: {currentUser.loginId})
          </span>
        </div>

        {/* Responsive Desktop Table & Mobile Stacked Cards */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Chemical</th>
                <th className="p-3">Quantity Used</th>
                <th className="p-3">Recorded By</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {usages.map((u) => {
                const chem = chemicals.find((c) => c.id === u.chemicalId);
                const isOwner = u.usedBy === currentUser.loginId || currentUser.department === 'admin';
                const isEditing = editingUsageId === u.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-slate-600">{u.date}</td>
                    <td className="p-3 font-semibold text-slate-900">{chem?.name || 'Chemical'}</td>

                    <td className="p-3 font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.001"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="bg-slate-50 border border-amber-500 rounded-lg px-2 py-1 font-mono text-slate-900 w-28 focus:outline-none"
                        />
                      ) : (
                        <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {formatWeight(u.quantityUsed)} {chem?.unit}
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold">
                        {u.usedBy}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      {isOwner ? (
                        isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleUpdateUsage(u.id)}
                              className="p-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(u)}
                              className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUsage(u.id)}
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
  );
};
