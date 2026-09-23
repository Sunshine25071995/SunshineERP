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
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 px-4 py-3 text-base text-gray-900 focus:outline-none focus:border-indigo-600 focus:bg-indigo-50/50 transition-colors";
const selectCls = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 px-4 py-3 text-base text-gray-900 focus:outline-none focus:border-indigo-600 focus:bg-indigo-50/50 transition-colors";

export const ChemicalModule: React.FC<ChemicalModuleProps> = ({
  currentUser,
  chemicals,
  purchases,
  usages,
}) => {
  const [activeTab, setActiveTab] = useState<'usage' | 'purchase'>('usage');
  
  // Modals state
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showAddChemModal, setShowAddChemModal] = useState(false);

  // Form state
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
      setShowUsageModal(false);
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
      setShowPurchaseModal(false);
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

  const renderModal = (show: boolean, onClose: () => void, title: string, children: React.ReactNode) => {
    if (!show) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white w-full sm:max-w-md fixed inset-x-0 bottom-0 sm:static rounded-t-[28px] sm:rounded-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6 shadow-2xl animate-slide-up z-50 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center mb-4 sm:hidden"><div className="w-10 h-1.5 bg-gray-300 rounded-full" /></div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button type="button" onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-[80px] animate-fade-in w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-headline-small font-bold text-gray-900">Chemicals</h2>
          <p className="text-sm text-gray-500 mt-1">Stock & Usage Management</p>
        </div>
        <button
          onClick={() => setShowAddChemModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-full transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New</span>
        </button>
      </div>

      {/* Inventory Stock Cards */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Live Inventory</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {chemicals.map((c) => {
            const totalPurchased = purchases.filter(p => p.chemicalId === c.id).reduce((s, p) => s + (p.quantity || 0), 0);
            const totalUsed = usages.filter(u => u.chemicalId === c.id).reduce((s, u) => s + (u.quantityUsed || 0), 0);
            const stock = totalPurchased - totalUsed;
            const pct = totalPurchased > 0 ? Math.max(0, Math.min(100, (stock / totalPurchased) * 100)) : 0;
            return (
              <div key={c.id} className="app-card p-4 rounded-2xl bg-slate-50">
                <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                <div className={`text-2xl font-black font-mono mt-1 ${stock > 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                  {formatWeight(stock)}<span className="text-sm font-normal text-gray-500 ml-1">{c.unit}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct > 30 ? 'bg-indigo-500' : pct > 10 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">In: {formatWeight(totalPurchased)} · Used: {formatWeight(totalUsed)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* MD3 Top App Bar Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button 
          onClick={() => setActiveTab('usage')} 
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'usage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <FlaskConical className="w-4 h-4" /> Usage
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('purchase')} 
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'purchase' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Purchase
          </div>
        </button>
      </div>

      {/* USAGE TAB */}
      {activeTab === 'usage' && (
        <div className="space-y-6 animate-fade-in">
          {/* Daily Summary */}
          <div>
            <h3 className="text-title-large font-bold text-gray-900 mb-3">Daily Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div key={idx} className="app-card p-4 rounded-2xl bg-white flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-gray-900">{chem?.name || 'Unknown'}</span>
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                        {item.date === new Date().toISOString().split('T')[0] ? 'Today' : item.date}
                      </span>
                    </div>
                    <div className="text-xl font-black font-mono text-gray-800">
                      {formatWeight(item.total)}<span className="text-sm font-normal text-gray-500 ml-1">{chem?.unit}</span>
                    </div>
                  </div>
                );
              })}
              {usages.length === 0 && (
                <div className="col-span-full p-8 text-center text-sm text-gray-500 bg-gray-50 rounded-2xl">
                  No usage recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Raw Logs */}
          <div>
            <h3 className="text-title-large font-bold text-gray-900 mb-3">Detailed Logs</h3>
            <div className="space-y-3">
              {[...usages].reverse().map((u) => {
                const chem = chemicals.find(c => c.id === u.chemicalId);
                const isOwner = u.usedBy === currentUser.loginId || currentUser.department === 'admin';
                const isEditing = editingUsageId === u.id;
                return (
                  <div key={u.id} className="app-card p-4 rounded-2xl bg-white flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-gray-900 truncate">{chem?.name || 'Chemical'}</div>
                      <div className="text-sm text-gray-500">{u.date} · by {u.usedBy}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input type="number" step="0.001" value={editQty} onChange={e => setEditQty(e.target.value)}
                            className="w-24 bg-slate-100 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          <button onClick={() => handleUpdateUsage(u.id)} className="w-10 h-10 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full"><Check className="w-5 h-5" /></button>
                          <button onClick={() => setEditingUsageId(null)} className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                      ) : (
                        <>
                          <div className="text-lg font-black font-mono text-gray-800">
                            {formatWeight(u.quantityUsed)}<span className="text-sm font-normal text-gray-500 ml-1">{chem?.unit}</span>
                          </div>
                          {isOwner && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingUsageId(u.id); setEditQty(String(u.quantityUsed)); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteUsage(u.id)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-rose-50 text-gray-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <button onClick={() => setShowUsageModal(true)} className="fab-btn">
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* PURCHASE TAB */}
      {activeTab === 'purchase' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-title-large font-bold text-gray-900 mb-3">Purchase Logs</h3>
            {purchases.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 bg-gray-50 rounded-2xl">
                No purchases recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {[...purchases].reverse().map((p) => {
                  const chem = chemicals.find(c => c.id === p.chemicalId);
                  const isOwner = p.addedBy === currentUser.loginId || currentUser.department === 'admin';
                  const isEditing = editingPurchaseId === p.id;
                  return (
                    <div key={p.id} className="app-card p-4 rounded-2xl bg-white flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-bold text-gray-900 truncate">{chem?.name || 'Chemical'}</div>
                        <div className="text-sm text-gray-500">{p.date} · by {p.addedBy}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input type="number" step="0.001" value={editPurchaseQty} onChange={e => setEditPurchaseQty(e.target.value)}
                              className="w-24 bg-slate-100 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <button onClick={() => handleUpdatePurchase(p.id)} className="w-10 h-10 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full"><Check className="w-5 h-5" /></button>
                            <button onClick={() => setEditingPurchaseId(null)} className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full"><X className="w-5 h-5" /></button>
                          </div>
                        ) : (
                          <>
                            <div className="text-lg font-black font-mono text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">
                              +{formatWeight(p.quantity)} <span className="text-sm font-normal text-emerald-700">{chem?.unit}</span>
                            </div>
                            {isOwner && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditingPurchaseId(p.id); setEditPurchaseQty(String(p.quantity)); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeletePurchase(p.id)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-rose-50 text-gray-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <button onClick={() => setShowPurchaseModal(true)} className="fab-btn">
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* MODALS as Bottom Sheets */}
      {renderModal(showUsageModal, () => setShowUsageModal(false), "Record Usage", (
        <form onSubmit={handleSaveUsage}>
          <FormField label="Chemical">
            <select value={selectedChemId} onChange={(e) => setSelectedChemId(e.target.value)} required className={selectCls}>
              <option value="">— Select Chemical —</option>
              {chemicals.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
            </select>
          </FormField>
          <FormField label="Quantity Used">
            <input type="number" step="0.001" placeholder="0.000" value={quantityUsed}
              onChange={(e) => setQuantityUsed(e.target.value)} required className={inputCls} />
          </FormField>
          <FormField label="Date">
            <input type="date" value={usageDate}
              onChange={(e) => setUsageDate(e.target.value)} required className={inputCls} />
          </FormField>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-full mt-4 transition-colors text-base shadow-md">
            Record Usage
          </button>
        </form>
      ))}

      {renderModal(showPurchaseModal, () => setShowPurchaseModal(false), "Record Purchase", (
        <form onSubmit={handleSavePurchase}>
          <FormField label="Chemical">
            <select value={purchaseChemId} onChange={(e) => setPurchaseChemId(e.target.value)} required className={selectCls}>
              <option value="">— Select Chemical —</option>
              {chemicals.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
            </select>
          </FormField>
          <FormField label="Quantity">
            <input type="number" step="0.001" placeholder="0.000" value={purchaseQty}
              onChange={(e) => setPurchaseQty(e.target.value)} required className={inputCls} />
          </FormField>
          <FormField label="Date">
            <input type="date" value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)} required className={inputCls} />
          </FormField>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-full mt-4 transition-colors text-base shadow-md">
            Record Purchase
          </button>
        </form>
      ))}

      {renderModal(showAddChemModal, () => setShowAddChemModal(false), "Add Chemical", (
        <form onSubmit={handleAddChemicalMaster}>
          <FormField label="Chemical Name">
            <input type="text" placeholder="e.g. Polyurethane Binder" value={newChemName}
              onChange={(e) => setNewChemName(e.target.value)} required className={inputCls} />
          </FormField>
          <FormField label="Unit">
            <select value={newChemUnit} onChange={(e) => setNewChemUnit(e.target.value)} className={selectCls}>
              <option>kg</option><option>L</option><option>g</option><option>ml</option>
            </select>
          </FormField>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-full mt-4 transition-colors text-base shadow-md">
            Add Chemical
          </button>
        </form>
      ))}
    </div>
  );
};
