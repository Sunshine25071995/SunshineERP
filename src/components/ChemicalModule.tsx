import React, { useState } from 'react';
import { User, Chemical, ChemicalPurchase, ChemicalUsage } from '../types';
import { formatWeight } from '../utils/formatters';
import { FlaskConical, Plus, Trash2, Edit2, Check, X, ShoppingCart } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';

interface ChemicalModuleProps {
  currentUser: User;
  chemicals: Chemical[];
  purchases: ChemicalPurchase[];
  usages: ChemicalUsage[];
}

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-sans placeholder:font-normal focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";
const selectCls = "w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";

export const ChemicalModule: React.FC<ChemicalModuleProps> = ({
  currentUser,
  chemicals,
  purchases,
  usages,
}) => {
  const [activeTab, setActiveTab] = useState<'usage' | 'purchase'>('usage');
  const [selectedChemId, setSelectedChemId] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [purchaseChemId, setPurchaseChemId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editPurchaseQty, setEditPurchaseQty] = useState('');
  const [showAddChemModal, setShowAddChemModal] = useState(false);
  const [newChemName, setNewChemName] = useState('');
  const [newChemUnit, setNewChemUnit] = useState('kg');

  const handleSaveUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChemId || !quantityUsed) return;
    try {
      await addDoc(collection(db, 'chemicalUsage'), {
        chemicalId: selectedChemId, quantityUsed: parseFloat(quantityUsed) || 0,
        date: usageDate, usedBy: currentUser.loginId,
      });
      setSelectedChemId(''); setQuantityUsed('');
    } catch (err) { console.error(err); }
  };

  const handleUpdateUsage = async (id: string) => {
    try {
      await updateDoc(doc(db, 'chemicalUsage', id), { quantityUsed: parseFloat(editQty) || 0 });
      setEditingUsageId(null);
    } catch (err) { console.error(err); }
  };

  const handleDeleteUsage = async (id: string) => {
    if (window.confirm('Delete this usage entry?')) {
      try { await deleteDoc(doc(db, 'chemicalUsage', id)); } catch (err) { console.error(err); }
    }
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseChemId || !purchaseQty) return;
    try {
      await addDoc(collection(db, 'chemicalPurchases'), {
        chemicalId: purchaseChemId, quantity: parseFloat(purchaseQty) || 0,
        date: purchaseDate, addedBy: currentUser.loginId,
      });
      setPurchaseChemId(''); setPurchaseQty('');
    } catch (err) { console.error(err); }
  };

  const handleUpdatePurchase = async (id: string) => {
    try {
      await updateDoc(doc(db, 'chemicalPurchases', id), { quantity: parseFloat(editPurchaseQty) || 0 });
      setEditingPurchaseId(null);
    } catch (err) { console.error(err); }
  };

  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('Delete this purchase entry?')) {
      try { await deleteDoc(doc(db, 'chemicalPurchases', id)); } catch (err) { console.error(err); }
    }
  };

  const handleAddChemicalMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChemName.trim()) return;
    try {
      await addDoc(collection(db, 'chemicals'), { name: newChemName.trim(), unit: newChemUnit.trim() || 'kg' });
      setNewChemName(''); setShowAddChemModal(false);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">Chemical</h2>
          <p className="text-sm text-gray-500 mt-0.5">Stock & Usage Management</p>
        </div>
        <button
          onClick={() => setShowAddChemModal(!showAddChemModal)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors btn-press shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chemical</span>
        </button>
      </div>

      {/* Add chemical panel */}
      {showAddChemModal && (
        <div className="app-card p-4 border-blue-200 bg-blue-50 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-blue-900">Add New Chemical</span>
            <button onClick={() => setShowAddChemModal(false)} className="text-blue-500 hover:text-blue-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleAddChemicalMaster} className="space-y-3">
            <FormField label="Chemical Name">
              <input type="text" placeholder="e.g. Polyurethane Binder" value={newChemName}
                onChange={(e) => setNewChemName(e.target.value)} required className={inputCls} />
            </FormField>
            <FormField label="Unit">
              <select value={newChemUnit} onChange={(e) => setNewChemUnit(e.target.value)} className={selectCls}>
                <option>kg</option><option>L</option><option>g</option><option>ml</option>
              </select>
            </FormField>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl btn-press">
              Add Chemical
            </button>
          </form>
        </div>
      )}

      {/* Inventory Stock Cards */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Live Inventory</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {chemicals.map((c) => {
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
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct > 30 ? 'bg-emerald-500' : pct > 10 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">In: {formatWeight(totalPurchased)} · Used: {formatWeight(totalUsed)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-gray-100 p-1 rounded-2xl flex gap-1">
        {(['usage', 'purchase'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === tab ? 'segment-active text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'usage' ? <><FlaskConical className="w-4 h-4" /><span>Usage</span></> : <><ShoppingCart className="w-4 h-4" /><span>Purchase</span></>}
          </button>
        ))}
      </div>

      {/* USAGE TAB */}
      {activeTab === 'usage' && (
        <div className="space-y-4 animate-fade-in">
          <div className="app-card p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-600" /> Record Usage
            </h3>
            <form onSubmit={handleSaveUsage} className="space-y-3">
              <FormField label="Chemical">
                <select value={selectedChemId} onChange={(e) => setSelectedChemId(e.target.value)} required className={selectCls}>
                  <option value="">— Select Chemical —</option>
                  {chemicals.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Quantity Used">
                  <input type="number" step="0.001" placeholder="0.000" value={quantityUsed}
                    onChange={(e) => setQuantityUsed(e.target.value)} required className={inputCls} />
                </FormField>
                <FormField label="Date">
                  <input type="date" value={usageDate}
                    onChange={(e) => setUsageDate(e.target.value)} required className={inputCls} />
                </FormField>
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 btn-press shadow-sm">
                <Plus className="w-4 h-4" /><span>Record Usage</span>
              </button>
            </form>
          </div>

          {/* Daily Summary Table */}
          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-gray-900">Daily Usage Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100/50">
                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Date</th>
                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Chemical</th>
                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Total Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(
                    usages.reduce((acc, u) => {
                      if (!acc[u.date]) acc[u.date] = {};
                      if (!acc[u.date][u.chemicalId]) acc[u.date][u.chemicalId] = 0;
                      acc[u.date][u.chemicalId] += u.quantityUsed;
                      return acc;
                    }, {} as Record<string, Record<string, number>>)
                  )
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .flatMap(([date, chemMap]) => 
                    Object.entries(chemMap).map(([chemId, total]) => ({ date, chemId, total }))
                  )
                  .map((item, idx) => {
                    const chem = chemicals.find(c => c.id === item.chemId);
                    return (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap">{item.date === new Date().toISOString().split('T')[0] ? <span className="text-blue-600">Today</span> : item.date}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{chem?.name || 'Unknown'}</td>
                        <td className="px-4 py-2.5 text-sm font-black font-mono text-amber-700 text-right">{formatWeight(item.total)}<span className="text-xs font-normal text-amber-500 ml-1">{chem?.unit}</span></td>
                      </tr>
                    );
                  })}
                  {usages.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No usage recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Usage Log Table */}
          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Detailed Logs</h3>
            </div>
            {usages.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No usage recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Chemical</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Date / User</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 text-right">Quantity</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...usages].reverse().map((u) => {
                      const chem = chemicals.find(c => c.id === u.chemicalId);
                      const isOwner = u.usedBy === currentUser.loginId || currentUser.department === 'admin';
                      const isEditing = editingUsageId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{chem?.name || 'Chemical'}</td>
                          <td className="px-4 py-2.5">
                            <div className="text-xs font-semibold text-gray-600">{u.date}</div>
                            <div className="text-[10px] text-gray-400">by {u.usedBy}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isEditing ? (
                              <input type="number" step="0.001" value={editQty} onChange={e => setEditQty(e.target.value)}
                                className="w-20 bg-white border border-blue-400 rounded-lg px-2 py-1 text-xs font-mono text-gray-900 focus:outline-none" />
                            ) : (
                              <span className="font-mono text-sm font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                {formatWeight(u.quantityUsed)} {chem?.unit}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleUpdateUsage(u.id)} className="w-7 h-7 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEditingUsageId(null)} className="w-7 h-7 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              isOwner && (
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => { setEditingUsageId(u.id); setEditQty(String(u.quantityUsed)); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700"><Edit2 className="w-3 h-3" /></button>
                                  <button onClick={() => handleDeleteUsage(u.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PURCHASE TAB */}
      {activeTab === 'purchase' && (
        <div className="space-y-4 animate-fade-in">
          <div className="app-card p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-600" /> Record Purchase
            </h3>
            <form onSubmit={handleSavePurchase} className="space-y-3">
              <FormField label="Chemical">
                <select value={purchaseChemId} onChange={(e) => setPurchaseChemId(e.target.value)} required className={selectCls}>
                  <option value="">— Select Chemical —</option>
                  {chemicals.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Quantity">
                  <input type="number" step="0.001" placeholder="0.000" value={purchaseQty}
                    onChange={(e) => setPurchaseQty(e.target.value)} required className={inputCls} />
                </FormField>
                <FormField label="Date">
                  <input type="date" value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)} required className={inputCls} />
                </FormField>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 btn-press shadow-sm">
                <Plus className="w-4 h-4" /><span>Record Purchase</span>
              </button>
            </form>
          </div>

          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Purchase Logs</h3>
            </div>
            {purchases.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No purchases recorded yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {[...purchases].reverse().map((p) => {
                  const chem = chemicals.find(c => c.id === p.chemicalId);
                  const isOwner = p.addedBy === currentUser.loginId || currentUser.department === 'admin';
                  const isEditing = editingPurchaseId === p.id;
                  return (
                    <div key={p.id} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{chem?.name || 'Chemical'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.date} · by {p.addedBy}</p>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input type="number" step="0.001" value={editPurchaseQty} onChange={e => setEditPurchaseQty(e.target.value)}
                            className="w-24 bg-white border border-blue-400 rounded-lg px-2 py-1.5 text-sm font-mono text-gray-900 focus:outline-none" />
                          <button onClick={() => handleUpdatePurchase(p.id)} className="w-8 h-8 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-lg"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingPurchaseId(null)} className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-mono text-sm font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            +{formatWeight(p.quantity)} {chem?.unit}
                          </span>
                          {isOwner && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingPurchaseId(p.id); setEditPurchaseQty(String(p.quantity)); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeletePurchase(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </>
                      )}
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
