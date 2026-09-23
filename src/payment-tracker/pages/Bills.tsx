import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Bill, Party } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, Search, Trash2, Edit, Receipt } from 'lucide-react';
import { useAuth } from '../auth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import toast from 'react-hot-toast';

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
      const dateStr = formData.get('bill_date') as string;
      
      const newBill = {
        bill_number: formData.get('bill_number') as string,
        party_id: formData.get('party_id') as string,
        bill_date: new Date(dateStr).getTime(),
        bill_amount: Number(formData.get('bill_amount')),
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
      const dateStr = formData.get('bill_date') as string;
      
      await dbService.updateBillDetails(editingBill.id, {
        bill_number: formData.get('bill_number') as string,
        bill_date: new Date(dateStr).getTime(),
        notes: formData.get('notes') as string,
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

  if (loading) return <div className="w-full flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  const inputClasses = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50 px-4 py-3 text-sm focus:outline-none transition-colors";

  return (
    <div className="w-full space-y-6 pb-[100px] font-sans">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Bills</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="hidden md:inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Sales Bill
          </button>
        )}
      </div>

      <div className="w-full">
        <div className="pb-4">
          <div className="relative w-full sm:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by bill no or party..."
              className="w-full border-none rounded-full bg-slate-100 focus:ring-2 focus:ring-indigo-500 py-3 pl-12 pr-4 text-base font-medium outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Mobile List View (Transaction style) */}
        <div className="md:hidden flex flex-col bg-white rounded-[28px] p-2 shadow-sm">
          {filteredBills.map((bill, index) => {
            const party = parties.find(p => p.id === bill.party_id);
            return (
              <React.Fragment key={bill.id}>
                <div className="flex items-center p-3 hover:bg-slate-50 transition-colors rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mr-4">
                    <Receipt className="h-6 w-6" />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-slate-900 truncate">{bill.bill_number}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 
                        bill.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 
                        bill.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' : 
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 truncate mt-0.5">{party?.party_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(bill.bill_date)}</p>
                  </div>

                  <div className="text-right shrink-0 ml-3 flex flex-col items-end justify-center">
                    <p className="text-base font-black text-slate-900">{formatCurrency(bill.bill_amount)}</p>
                    {bill.outstanding_amount > 0 ? (
                      <p className="text-xs font-bold text-rose-600 mt-1">Due: {formatCurrency(bill.outstanding_amount)}</p>
                    ) : (
                      <p className="text-xs font-bold text-emerald-600 mt-1">Paid</p>
                    )}
                    
                    {profile?.role === 'admin' && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => openEditModal(bill)} className="text-slate-400 hover:text-indigo-600">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteBill(bill.id)} className="text-slate-400 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {index < filteredBills.length - 1 && (
                  <div className="mx-4 border-b border-slate-100"></div>
                )}
              </React.Fragment>
            );
          })}
          {filteredBills.length === 0 && (
            <div className="text-center text-sm text-slate-500 font-medium py-8">
              No bills found.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block w-full overflow-x-auto bg-white rounded-[28px] shadow-sm p-4">
          <table className="w-full divide-y divide-slate-100 whitespace-nowrap">
            <thead className="text-slate-500 text-xs uppercase tracking-wider text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Date</th>
                <th scope="col" className="px-4 py-3 font-bold">Bill No</th>
                <th scope="col" className="px-4 py-3 font-bold">Party</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Amount</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Outstanding</th>
                <th scope="col" className="px-4 py-3 font-bold text-center">Status</th>
                {profile?.role === 'admin' && <th scope="col" className="px-4 py-3 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.map((bill) => {
                const party = parties.find(p => p.id === bill.party_id);
                return (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-sm text-slate-600 font-medium">
                      {formatDate(bill.bill_date)}
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-900">
                      {bill.bill_number}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-900 font-bold">
                      {party?.party_name}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-black text-slate-900">
                      {formatCurrency(bill.bill_amount)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-black text-rose-600">
                      {bill.outstanding_amount > 0 ? formatCurrency(bill.outstanding_amount) : '-'}
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 
                        bill.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 
                        bill.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' : 
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="px-4 py-4 text-right text-sm">
                        <button onClick={() => openEditModal(bill)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 mr-1 transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteBill(bill.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 7 : 6} className="px-4 py-8 text-center text-sm text-slate-500 font-medium">
                    No bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

      {/* Modals - Bottom Sheet Style */}
      {(isAddModalOpen || editingBill) && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/40 sm:p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl w-full sm:max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col pb-safe">
            <div className="px-6 py-5 flex justify-between items-center bg-white relative">
              <h3 className="text-xl font-black text-slate-900">{editingBill ? 'Edit Sales Bill' : 'Add Sales Bill'}</h3>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full bg-slate-50">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-6">
              <form onSubmit={editingBill ? handleEditBill : handleAddBill} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Bill Number *</label>
                  <input required name="bill_number" defaultValue={editingBill?.bill_number} type="text" className={inputClasses} />
                </div>
                
                {!editingBill && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Party *</label>
                    <select 
                      required 
                      name="party_id" 
                      value={selectedPartyId}
                      onChange={(e) => setSelectedPartyId(e.target.value)}
                      className={inputClasses}
                    >
                      <option value="">Select Party</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>{p.party_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-2xl border-none">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Attach Job Cards</label>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                    {jobCards.length === 0 ? (
                      <p className="text-xs font-medium text-slate-500">No job cards available.</p>
                    ) : (
                      jobCards.map(jc => (
                        <label key={jc.id} className="flex items-center gap-3 text-sm p-3 bg-white rounded-xl cursor-pointer hover:bg-indigo-50/50 shadow-sm transition-colors">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Bill Date *</label>
                    <input required name="bill_date" type="date" defaultValue={editingBill ? new Date(editingBill.bill_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} className={inputClasses} />
                  </div>
                  {!editingBill && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Amount (₹) *</label>
                      <input required name="bill_amount" type="number" min="1" step="0.01" className={inputClasses} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Notes</label>
                  <textarea name="notes" defaultValue={editingBill?.notes} rows={2} className={inputClasses}></textarea>
                </div>
                
                <div className="mt-8 flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="rounded-full px-6 py-3.5 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 w-full sm:w-auto transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-full px-6 py-3.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto transition-colors shadow-md">
                    {editingBill ? 'Update' : 'Save'}
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
