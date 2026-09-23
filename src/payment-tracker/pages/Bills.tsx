import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Bill, Party } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, Search, Trash2, Edit } from 'lucide-react';
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
    <div className="w-full space-y-4 pb-[80px]">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">Sales Bills</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="hidden md:inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Sales Bill
          </button>
        )}
      </div>

      {profile?.role === 'admin' && (
        <button
          onClick={openAddModal}
          className="md:hidden fab-btn fixed bottom-20 right-6 z-40 bg-indigo-600 text-white p-4 rounded-2xl shadow-lg hover:bg-indigo-700 flex items-center justify-center"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <div className="w-full">
        <div className="pb-4">
          <div className="relative w-full sm:max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by bill no or party..."
              className={inputClasses.replace('rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50', 'border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 pl-10')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Mobile Card List */}
        <div className="md:hidden flex flex-col gap-3 ">
          {filteredBills.map((bill) => {
            const party = parties.find(p => p.id === bill.party_id);
            return (
              <div key={bill.id} className="app-card p-4 rounded-2xl bg-white flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{party?.party_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">{bill.bill_number} · {formatDate(bill.bill_date)}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${
                    bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 
                    bill.status === 'OVERDUE' ? 'bg-red-100 text-red-800' : 
                    bill.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' : 
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {bill.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Amount</p>
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(bill.bill_amount)}</p>
                  </div>
                  <div className="bg-red-50 p-2 rounded-xl">
                    <p className="text-[10px] text-red-500 font-bold uppercase">Outstanding</p>
                    <p className="text-sm font-black text-red-600">{bill.outstanding_amount > 0 ? formatCurrency(bill.outstanding_amount) : '₹0'}</p>
                  </div>
                </div>

                {profile?.role === 'admin' && (
                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 mt-1">
                    <button onClick={() => openEditModal(bill)} className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-slate-100">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteBill(bill.id)} className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-slate-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredBills.length === 0 && (
            <div className="text-center text-sm text-slate-500 font-medium py-4">
              No bills found.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full divide-y divide-slate-200 whitespace-nowrap">
            <thead className="bg-slate-800 text-white text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">Date</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Bill No</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Party</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">Amount</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">Outstanding</th>
                <th scope="col" className="px-3 py-2 text-center font-bold">Status</th>
                {profile?.role === 'admin' && <th scope="col" className="px-3 py-2 text-right font-bold">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredBills.map((bill) => {
                const party = parties.find(p => p.id === bill.party_id);
                return (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-sm text-slate-700 font-medium">
                      {formatDate(bill.bill_date)}
                    </td>
                    <td className="px-3 py-2 text-sm font-bold text-slate-900">
                      {bill.bill_number}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-900 font-bold">
                      {party?.party_name}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">
                      {formatCurrency(bill.bill_amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-black text-red-600">
                      {bill.outstanding_amount > 0 ? formatCurrency(bill.outstanding_amount) : '₹0'}
                    </td>
                    <td className="px-3 py-2 text-center text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 
                        bill.status === 'OVERDUE' ? 'bg-red-100 text-red-800' : 
                        bill.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' : 
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="px-3 py-2 text-right text-sm">
                        <button onClick={() => openEditModal(bill)} className="p-1 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 mr-1">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteBill(bill.id)} className="p-1 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 7 : 6} className="px-3 py-6 text-center text-sm text-slate-500 font-medium">
                    No bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(isAddModalOpen || editingBill) && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/50 sm:p-4 transition-all">
          <div className="bg-white rounded-t-[28px] sm:rounded-2xl shadow-xl w-full sm:max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col pb-safe">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-xl font-bold text-slate-900">{editingBill ? 'Edit Sales Bill' : 'Add Sales Bill'}</h3>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full bg-slate-50">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto">
              <form onSubmit={editingBill ? handleEditBill : handleAddBill} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bill Number *</label>
                  <input required name="bill_number" defaultValue={editingBill?.bill_number} type="text" className={inputClasses} />
                </div>
                
                {!editingBill && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Party *</label>
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

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Attach Job Cards</label>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {jobCards.length === 0 ? (
                      <p className="text-xs font-medium text-slate-500">No job cards available.</p>
                    ) : (
                      jobCards.map(jc => (
                        <label key={jc.id} className="flex items-center gap-3 text-sm p-2 bg-white border border-slate-100 rounded-lg cursor-pointer hover:bg-indigo-50/50">
                          <input 
                            type="checkbox" 
                            checked={selectedJobCards.includes(jc.id)}
                            onChange={() => toggleJobCardSelection(jc.id)}
                            className="rounded border-slate-400 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span className="font-bold text-slate-900">{jc.jobCode}</span>
                          <span className="text-xs text-slate-500">({jc.totalQuantity} kg)</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bill Date *</label>
                    <input required name="bill_date" type="date" defaultValue={editingBill ? new Date(editingBill.bill_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} className={inputClasses} />
                  </div>
                  {!editingBill && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bill Amount (₹) *</label>
                      <input required name="bill_amount" type="number" min="1" step="0.01" className={inputClasses} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
                  <textarea name="notes" defaultValue={editingBill?.notes} rows={2} className={inputClasses}></textarea>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3 pt-4 pb-2">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="rounded-xl px-5 py-3 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 w-full sm:w-auto">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-5 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
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
