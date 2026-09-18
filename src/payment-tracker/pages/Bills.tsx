import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Bill, Party } from '../types';
import { formatCurrency, formatDate, calculateDueDays } from '../utils';
import { Plus, Search, Trash2, Edit } from 'lucide-react';
import { useAuth } from '../auth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';

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
    } finally {
      setLoading(false);
    }
  }

  const filteredBills = bills.filter(b => 
    b.bill_number.toLowerCase().includes(search.toLowerCase()) ||
    parties.find(p => p.id === b.party_id)?.party_name.toLowerCase().includes(search.toLowerCase())
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
    setIsAddModalOpen(false);
    setSelectedJobCards([]);
    setSelectedPartyId('');
    loadData();
  }
  
  async function handleEditBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingBill) return;
    const formData = new FormData(e.currentTarget);
    const dateStr = formData.get('bill_date') as string;
    
    await dbService.updateBillDetails(editingBill.id, {
      bill_number: formData.get('bill_number') as string,
      bill_date: new Date(dateStr).getTime(),
      notes: formData.get('notes') as string,
      job_card_ids: selectedJobCards,
    });
    setEditingBill(null);
    setSelectedJobCards([]);
    loadData();
  }

  async function handleDeleteBill(id: string) {
    if (!window.confirm("Are you sure you want to delete this bill? Related payment allocations will be refunded to advance balance.")) return;
    await adminDbService.deleteBill(id);
    loadData();
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

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Sales Bills</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Sales Bill
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by bill no or party..."
              className="block w-full rounded-lg border-0 py-2 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bill No</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Party Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Job Cards</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Due Days</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                {profile?.role === 'admin' && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredBills.map((bill) => {
                const party = parties.find(p => p.id === bill.party_id);
                const dueDays = calculateDueDays(bill.bill_date, bill.fully_paid_date);
                const linkedJobCards = (bill.job_card_ids || []).map(id => jobCards.find(j => j.id === id)?.jobCode || id);
                
                return (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(bill.bill_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {bill.bill_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {party?.party_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 max-w-[150px] truncate">
                      {linkedJobCards.length > 0 ? linkedJobCards.join(', ') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(bill.bill_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-amber-600">
                      {bill.outstanding_amount > 0 ? formatCurrency(bill.outstanding_amount) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">
                      {dueDays} {bill.fully_paid_date ? 'days to clear' : 'days'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${bill.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : bill.status === 'OVERDUE' ? 'bg-red-50 text-red-700 ring-red-600/20' : bill.status === 'PARTIALLY PAID' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 'bg-blue-50 text-blue-700 ring-blue-600/20'}`}>
                        {bill.status}
                      </span>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => openEditModal(bill)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteBill(bill.id)} className="text-red-600 hover:text-red-900">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 9 : 8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100">
          {filteredBills.map((bill) => {
            const party = parties.find(p => p.id === bill.party_id);
            const dueDays = calculateDueDays(bill.bill_date, bill.fully_paid_date);
            const linkedJobCards = (bill.job_card_ids || []).map(id => jobCards.find(j => j.id === id)?.jobCode || id);
            
            return (
              <div key={bill.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">#{bill.bill_number}</h3>
                    <p className="text-sm text-slate-700">{party?.party_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${bill.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : bill.status === 'OVERDUE' ? 'bg-red-50 text-red-700 ring-red-600/20' : bill.status === 'PARTIALLY PAID' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 'bg-blue-50 text-blue-700 ring-blue-600/20'}`}>
                      {bill.status}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(bill.bill_date)}</span>
                  </div>
                </div>
                
                {linkedJobCards.length > 0 && (
                  <div className="mb-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Job Cards:</span> {linkedJobCards.join(', ')}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Total Amount</p>
                    <p className="font-semibold text-slate-900">{formatCurrency(bill.bill_amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Outstanding</p>
                    <p className="font-semibold text-rose-600">{bill.outstanding_amount > 0 ? formatCurrency(bill.outstanding_amount) : '₹0'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Due Status</p>
                    <p className="font-medium text-slate-700">{dueDays} {bill.fully_paid_date ? 'days to clear' : 'days'}</p>
                  </div>
                </div>
                
                {profile?.role === 'admin' && (
                  <div className="mt-4 pt-3 border-t border-slate-50 flex gap-2">
                    <button onClick={() => openEditModal(bill)} className="flex-1 flex items-center justify-center gap-2 p-2 text-slate-600 hover:text-indigo-600 rounded bg-slate-50"><Edit className="w-4 h-4" /> Edit</button>
                    <button onClick={() => handleDeleteBill(bill.id)} className="flex-1 flex items-center justify-center gap-2 p-2 text-slate-600 hover:text-red-600 rounded bg-slate-50"><Trash2 className="w-4 h-4" /> Delete</button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredBills.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No bills found.
            </div>
          )}
        </div>
      </div>

      {(isAddModalOpen || editingBill) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-900">{editingBill ? 'Edit Sales Bill' : 'Add Sales Bill'}</h3>
              <button onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="text-slate-400 hover:text-slate-500">
                &times;
              </button>
            </div>
            <form onSubmit={editingBill ? handleEditBill : handleAddBill} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Bill Number *</label>
                <input required name="bill_number" defaultValue={editingBill?.bill_number} type="text" className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              
              {!editingBill && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Party *</label>
                  <select 
                    required 
                    name="party_id" 
                    value={selectedPartyId}
                    onChange={(e) => setSelectedPartyId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Party</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.party_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Attach Job Cards</label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {jobCards.length === 0 ? (
                    <p className="text-xs text-slate-500">No job cards available.</p>
                  ) : (
                    jobCards.map(jc => (
                      <label key={jc.id} className="flex items-center gap-2 text-sm p-1 hover:bg-white rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedJobCards.includes(jc.id)}
                          onChange={() => toggleJobCardSelection(jc.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium">{jc.jobCode}</span>
                        <span className="text-xs text-slate-500">({jc.totalQuantity} kg)</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Bill Date *</label>
                  <input required name="bill_date" type="date" defaultValue={editingBill ? new Date(editingBill.bill_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                {!editingBill && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Bill Amount (₹) *</label>
                    <input required name="bill_amount" type="number" min="1" step="0.01" className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Notes</label>
                <textarea name="notes" defaultValue={editingBill?.notes} rows={2} className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"></textarea>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingBill(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700">
                  {editingBill ? 'Update Bill' : 'Save Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
