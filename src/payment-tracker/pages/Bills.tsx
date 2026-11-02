import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Bill, Party } from '../types';
import { formatCurrency, formatDate, cn } from '../utils';
import { Plus, Search, Trash2, Edit, Receipt } from 'lucide-react';
import { useAuth } from '../auth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import toast from 'react-hot-toast';
import { logActivity } from '../../services/activityLog';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedJobCards, setSelectedJobCards] = useState<string[]>([]);
  
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [b, p, jSnap] = await Promise.all([
        dbService.getBills(), 
        dbService.getParties(),
        getDocs(collection(db, 'jobCards'))
      ]);
      setBills(b);
      setParties(p);
      setJobCards(jSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }

  const filteredBills = bills.filter(b => 
    String(b.bill_number || '').toLowerCase().includes(search.toLowerCase()) ||
    String(parties.find(p => p.id === b.party_id)?.party_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleJobCardSelection = (id: string) => {
    if (selectedJobCards.includes(id)) {
      setSelectedJobCards(selectedJobCards.filter(jid => jid !== id));
    } else {
      setSelectedJobCards([...selectedJobCards, id]);
    }
  };

  async function handleAddBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const billNumber = formData.get('bill_number') as string;
      const partyId = formData.get('party_id') as string;
      const amount = Number(formData.get('bill_amount'));
      
      if (!billNumber || billNumber.trim() === '') {
        toast.error('Please enter a bill number');
        return;
      }
      if (!partyId) {
        toast.error('Please select a party');
        return;
      }
      if (!amount || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      const dateStr = formData.get('bill_date') as string;
      
      const newBill = {
        bill_number: billNumber,
        party_id: partyId,
        bill_date: new Date(dateStr).getTime(),
        bill_amount: amount,
        notes: formData.get('notes') as string,
        job_card_ids: selectedJobCards,
        created_by: profile?.name || 'Admin',
      };
      
      await dbService.addBill(newBill);
      toast.success('Sales bill added successfully');
      setIsAddModalOpen(false);
      setSelectedJobCards([]);
      setSelectedPartyId('');
      loadData();
      
      const party = parties.find(p => p.id === newBill.party_id);
      await logActivity('Bill Created', `Added bill ${newBill.bill_number} for ${party?.party_name || 'Party'} (₹${newBill.bill_amount})`, profile?.uid || profile?.id || 'admin', profile?.name || 'Admin');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to add bill');
    }
  }
  
  async function handleEditBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingBill) return;
    try {
      const formData = new FormData(e.currentTarget);
      const billNumber = formData.get('bill_number') as string;
      const newAmount = Number(formData.get('bill_amount'));
      
      if (!billNumber || billNumber.trim() === '') {
        toast.error('Please enter a bill number');
        return;
      }
      if (!newAmount || newAmount <= 0) {
        toast.error('Please enter a valid bill amount');
        return;
      }

      const paid = Number(editingBill.paid_amount) || 0;
      if (paid > 0 && newAmount < paid) {
        toast.error(`Bill amount cannot be less than already paid amount (₹${paid.toLocaleString('en-IN')})`);
        return;
      }

      const dateStr = formData.get('bill_date') as string;
      const newOutstanding = Math.max(0, newAmount - paid);
      let newStatus: any = 'DUE';
      if (paid >= newAmount) {
        newStatus = 'PAID';
      } else if (paid > 0) {
        newStatus = 'PARTIALLY PAID';
      }
      
      await dbService.updateBillDetails(editingBill.id, {
        bill_number: billNumber,
        bill_date: new Date(dateStr).getTime(),
        bill_amount: newAmount,
        outstanding_amount: newOutstanding,
        status: newStatus,
        fully_paid_date: newStatus === 'PAID' ? (editingBill.fully_paid_date || Date.now()) : null,
        notes: (formData.get('notes') as string) || '',
        job_card_ids: selectedJobCards,
      });
      toast.success('Bill updated successfully');
      setEditingBill(null);
      setSelectedJobCards([]);
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to update bill');
    }
  }

  async function handleDeleteBill(id: string) {
    if (!window.confirm("Are you sure you want to delete this bill? Related payment allocations will be refunded to balance.")) return;
    try {
      await adminDbService.deleteBill(id);
      toast.success('Bill deleted successfully');
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to delete bill');
    }
  }

  function openEditModal(bill: Bill) {
    setEditingBill(bill);
    setSelectedJobCards(bill.job_card_ids || []);
  }

  function openAddModal() {
    setIsAddModalOpen(true);
    setSelectedJobCards([]);
    setSelectedPartyId('');
  }

  const { isPulling } = usePullToRefresh(loadData);

  if (loading) return <SkeletonLoader variant="list" />;

  const inputClasses = "w-full bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50/50 px-4 py-2.5 text-sm outline-none transition-colors";

  return (
    <div className="w-full space-y-4 pb-[100px] font-sans animate-slide-up">
      {isPulling && (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      )}
      <div className="w-full flex flex-row items-center justify-between gap-4 px-2 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Sales Bills</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-1.5 h-4 w-4 sm:h-5 sm:w-5" />
            Add Sales Bill
          </button>
        )}
      </div>

      <div className="w-full">
        <div className="pb-4 px-2 sm:px-0">
          <div className="relative w-full sm:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by bill no or party..."
              className="w-full border-none rounded-full bg-slate-100 focus:ring-2 focus:ring-indigo-500 py-2.5 pl-10 pr-4 text-sm font-medium outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Mobile View: High-Clarity Touch-Friendly Cards */}
        <div className="sm:hidden space-y-3 px-1">
          {filteredBills.map((bill) => {
            const party = parties.find(p => p.id === bill.party_id);
            return (
              <div key={bill.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {bill.bill_number}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {formatDate(bill.bill_date)}
                    </span>
                  </div>
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                    bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 
                    bill.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 
                    bill.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' : 
                    'bg-amber-100 text-amber-800'
                  )}>
                    {bill.status}
                  </span>
                </div>

                {/* Party Name */}
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                    {party?.party_name || 'Party'}
                  </h3>
                </div>

                {/* Amount / Due Row */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Bill</span>
                    <span className="text-base font-black text-slate-900">{formatCurrency(bill.bill_amount)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Due Balance</span>
                    {bill.outstanding_amount > 0 ? (
                      <span className="text-base font-black text-rose-600">{formatCurrency(bill.outstanding_amount)}</span>
                    ) : (
                      <span className="text-sm font-black text-emerald-600">All Paid ✓</span>
                    )}
                  </div>
                </div>

                {/* Notes or Job Cards */}
                {bill.notes && (
                  <p className="text-xs text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                    📝 {bill.notes}
                  </p>
                )}

                {/* Actions Bar */}
                {profile?.role === 'admin' && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => openEditModal(bill)}
                      className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Bill</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBill(bill.id)}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Delete Bill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredBills.length === 0 && (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No bills found</p>
              <p className="text-xs text-slate-400 mt-1">{search ? 'Try adjusting your search query' : 'Create your first bill to get started'}</p>
            </div>
          )}
        </div>

        {/* Desktop View: Clean Responsive Table */}
        <div className="hidden sm:block w-full bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Date/No</th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Party</th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Amount/Due</th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Status</th>
                  {profile?.role === 'admin' && <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.map((bill, i) => {
                  const party = parties.find(p => p.id === bill.party_id);
                  return (
                    <tr key={bill.id} className={cn('transition-colors hover:bg-slate-50', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-bold text-slate-900 whitespace-nowrap">
                          {bill.bill_number}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                          {formatDate(bill.bill_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-bold text-slate-900">
                          {party?.party_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-black text-slate-900">
                          {formatCurrency(bill.bill_amount)}
                        </div>
                        {bill.outstanding_amount > 0 ? (
                          <div className="text-xs font-bold text-rose-600 mt-0.5">
                            Due: {formatCurrency(bill.outstanding_amount)}
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-emerald-600 mt-0.5">
                            Paid ✓
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold',
                          bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 
                          bill.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 
                          bill.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' : 
                          'bg-amber-100 text-amber-800'
                        )}>
                          {bill.status}
                        </span>
                      </td>
                      {profile?.role === 'admin' && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditModal(bill)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors" title="Edit Bill">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteBill(bill.id)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors" title="Delete Bill">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan={profile?.role === 'admin' ? 5 : 4} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                          <Receipt className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-700">No bills found</p>
                        <p className="text-xs text-slate-400 mt-1">{search ? 'Try adjusting your search query' : 'Create your first bill to get started'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAB */}
      {profile?.role === 'admin' && (
        <button
          onClick={openAddModal}
          className="md:hidden fab-btn fixed bottom-24 right-5 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl z-40 flex items-center justify-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Modals - Clean Center Positioning with Keyboard Support */}
      {(isAddModalOpen || editingBill) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm transition-all overflow-y-auto">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col animate-scale-in my-auto">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-lg font-black text-slate-900">{editingBill ? 'Edit Sales Bill' : 'Add Sales Bill'}</h3>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full bg-slate-50 transition-colors">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-5 sm:px-6 py-5">
              <form onSubmit={editingBill ? handleEditBill : handleAddBill} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Bill Number *</label>
                  <input name="bill_number" defaultValue={editingBill?.bill_number} type="text" className={inputClasses} required />
                </div>
                
                {editingBill ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Party</label>
                    <div className="px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-extrabold text-slate-900 border border-slate-200">
                      {parties.find(p => p.id === editingBill.party_id)?.party_name || 'Party'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Party *</label>
                    <select 
                      name="party_id" 
                      value={selectedPartyId}
                      onChange={(e) => setSelectedPartyId(e.target.value)}
                      className={inputClasses}
                      required
                    >
                      <option value="">Select Party</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>{p.party_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Amount and Date Fields - Always visible in both Add & Edit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Bill Date *</label>
                    <input 
                      name="bill_date" 
                      type="date" 
                      defaultValue={editingBill ? new Date(editingBill.bill_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} 
                      className={inputClasses} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Amount (₹) *</label>
                    <input 
                      name="bill_amount" 
                      type="number" 
                      min="1" 
                      step="0.01" 
                      defaultValue={editingBill ? editingBill.bill_amount : ''} 
                      placeholder="0.00" 
                      className={inputClasses} 
                      required 
                    />
                  </div>
                </div>

                {/* Show already paid badge if editing bill has payments */}
                {editingBill && Number(editingBill.paid_amount) > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex justify-between items-center text-emerald-900">
                      <span className="font-bold">Already Paid:</span>
                      <span className="font-black text-emerald-700">{formatCurrency(editingBill.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-700 mt-1">
                      <span className="font-bold">Current Due:</span>
                      <span className="font-black">{formatCurrency(editingBill.outstanding_amount)}</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-1 italic">
                      * Bill amount cannot be reduced below already paid amount (₹{editingBill.paid_amount}).
                    </p>
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Attach Job Cards</label>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                    {jobCards.length === 0 ? (
                      <p className="text-xs font-medium text-slate-500">No job cards available.</p>
                    ) : (
                      jobCards.map(jc => (
                        <label key={jc.id} className="flex items-center gap-3 text-sm p-2.5 bg-white rounded-lg cursor-pointer hover:bg-indigo-50/50 shadow-sm border border-slate-100 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={selectedJobCards.includes(jc.id)}
                            onChange={() => toggleJobCardSelection(jc.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span className="font-bold text-slate-900">{jc.jobCode}</span>
                          <span className="text-xs text-slate-500 font-medium">({jc.totalQuantity} kg)</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Notes</label>
                  <textarea name="notes" defaultValue={editingBill?.notes} rows={2} className={inputClasses} placeholder="Optional notes..."></textarea>
                </div>
                
                <div className="mt-6 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex-1 sm:flex-none transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none transition-colors shadow-md">
                    {editingBill ? 'Update Bill' : 'Save Bill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
