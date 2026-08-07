import React, { useState } from 'react';
import { User, Chemical, ChemicalPurchase, ChemicalUsage } from '../types';
import { formatWeight } from '../utils/formatters';
import { FlaskConical, Plus, Trash2, Edit2, Check, X, ShieldAlert, PlusCircle, ShoppingCart } from 'lucide-react';
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
  // Active Tab State: 'usage' | 'purchase'
  const [activeTab, setActiveTab] = useState<'usage' | 'purchase'>('usage');

  // Chemical Usage Form State
  const [selectedChemId, setSelectedChemId] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);

  // Chemical Usage Editing State
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

  // Chemical Purchase Form State
  const [purchaseChemId, setPurchaseChemId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Chemical Purchase Editing State
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editPurchaseQty, setEditPurchaseQty] = useState('');

  // Add New Chemical Master Item State
  const [showAddChemModal, setShowAddChemModal] = useState(false);
  const [newChemName, setNewChemName] = useState('');
  const [newChemUnit, setNewChemUnit] = useState('kg');

  // Usage Handlers
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

  const startEditUsage = (u: ChemicalUsage) => {
    setEditingUsageId(u.id);
    setEditQty(String(u.quantityUsed));
  };

  const cancelEditUsage = () => {
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

  // Purchase Handlers
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseChemId || !purchaseQty) return;

    try {
      await addDoc(collection(db, 'chemicalPurchases'), {
        chemicalId: purchaseChemId,
        quantity: parseFloat(purchaseQty) || 0,
        date: purchaseDate,
        addedBy: currentUser.loginId,
      });

      setPurchaseChemId('');
      setPurchaseQty('');
    } catch (err) {
      console.error('Error saving chemical purchase:', err);
    }
  };

  const startEditPurchase = (p: ChemicalPurchase) => {
    setEditingPurchaseId(p.id);
    setEditPurchaseQty(String(p.quantity));
  };

  const cancelEditPurchase = () => {
    setEditingPurchaseId(null);
    setEditPurchaseQty('');
  };

  const handleUpdatePurchase = async (id: string) => {
    try {
      await updateDoc(doc(db, 'chemicalPurchases', id), {
        quantity: parseFloat(editPurchaseQty) || 0,
      });
      setEditingPurchaseId(null);
    } catch (err) {
      console.error('Error updating purchase:', err);
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase entry?')) {
      try {
        await deleteDoc(doc(db, 'chemicalPurchases', id));
      } catch (err) {
        console.error('Error deleting purchase:', err);
      }
    }
  };

  // Master Item Handler
  const handleAddChemicalMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChemName.trim()) return;

    try {
      await addDoc(collection(db, 'chemicals'), {
        name: newChemName.trim(),
        unit: newChemUnit.trim() || 'kg',
      });

      setNewChemName('');
      setShowAddChemModal(false);
    } catch (err) {
      console.error('Error adding chemical master item:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Chemical Inventory Stock Header & Master Addition */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amber-600" />
            <span>Live Chemical Inventory Stock</span>
          </h2>

          <button
            onClick={() => setShowAddChemModal(!showAddChemModal)}
            className="text-xs text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-xl font-bold transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chemical Item</span>
          </button>
        </div>

        {/* Modal / Inline Panel to Add New Chemical Master Item */}
        {showAddChemModal && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900 uppercase">
                Add New Chemical Master Item
              </span>
              <button
                onClick={() => setShowAddChemModal(false)}
                className="text-amber-700 hover:text-amber-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddChemicalMaster} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Chemical Name (e.g. Polyurethane Binder)"
                value={newChemName}
                onChange={(e) => setNewChemName(e.target.value)}
                required
                className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 flex-1 focus:outline-none focus:border-amber-600"
              />
              <input
                type="text"
                placeholder="Unit (kg/L)"
                value={newChemUnit}
                onChange={(e) => setNewChemUnit(e.target.value)}
                required
                className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 w-24 focus:outline-none focus:border-amber-600"
              />
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition-colors shadow-xs"
              >
                Add Chemical
              </button>
            </form>
          </div>
        )}

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
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Inward: {formatWeight(totalPurchased)} | Used: {formatWeight(totalUsed)}
                </div>
                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-100">
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

      {/* Sub-Navigation Tabs: Usage vs Purchase */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'usage'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Chemical Usage Entry & Logs</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
              activeTab === 'usage' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {usages.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('purchase')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'purchase'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Chemical Purchase Entry & Logs</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
              activeTab === 'purchase' ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-100 text-emerald-900'
            }`}
          >
            {purchases.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Chemical Usage Entry & Logs */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
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
                  {usages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                        No chemical usage recorded yet.
                      </td>
                    </tr>
                  ) : (
                    usages.map((u) => {
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
                                    onClick={cancelEditUsage}
                                    className="p-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => startEditUsage(u)}
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Chemical Purchase Entry & Logs */}
      {activeTab === 'purchase' && (
        <div className="space-y-6">
          {/* Inline Row Purchase Entry Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Record Chemical Purchase Inward Entry</span>
            </h3>

            <form onSubmit={handleSavePurchase} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Select Chemical</label>
                <select
                  value={purchaseChemId}
                  onChange={(e) => setPurchaseChemId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
                <label className="block text-slate-600 font-medium mb-1">Purchased Quantity</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={purchaseQty}
                  onChange={(e) => setPurchaseQty(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Record Purchase</span>
                </button>
              </div>
            </form>
          </div>

          {/* Purchase Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <span>Chemical Purchase Inward Logs</span>
              </h3>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                Editable only by creator / admin
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Chemical</th>
                    <th className="p-3">Purchased Quantity</th>
                    <th className="p-3">Recorded By</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                        No chemical purchases recorded yet.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => {
                      const chem = chemicals.find((c) => c.id === p.chemicalId);
                      const isOwner = p.addedBy === currentUser.loginId || currentUser.department === 'admin';
                      const isEditing = editingPurchaseId === p.id;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono text-slate-600">{p.date}</td>
                          <td className="p-3 font-semibold text-slate-900">{chem?.name || 'Chemical'}</td>

                          <td className="p-3 font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.001"
                                value={editPurchaseQty}
                                onChange={(e) => setEditPurchaseQty(e.target.value)}
                                className="bg-slate-50 border border-emerald-500 rounded-lg px-2 py-1 font-mono text-slate-900 w-28 focus:outline-none"
                              />
                            ) : (
                              <span className="font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                +{formatWeight(p.quantity)} {chem?.unit}
                              </span>
                            )}
                          </td>

                          <td className="p-3">
                            <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold">
                              {p.addedBy}
                            </span>
                          </td>

                          <td className="p-3 text-right">
                            {isOwner ? (
                              isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleUpdatePurchase(p.id)}
                                    className="p-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={cancelEditPurchase}
                                    className="p-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => startEditPurchase(p)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePurchase(p.id)}
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

