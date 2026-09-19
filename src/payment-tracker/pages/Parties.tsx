import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { Party, Bill } from '../types';
import { formatCurrency, calculateDueDays } from '../utils';
import { Edit2, Trash2, Plus, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth';
import { adminDbService } from '../db-admin';

export function Parties({ onNavigate }: { onNavigate: (view: string, id?: string) => void }) {
  const [parties, setParties] = useState<Party[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [pt, b] = await Promise.all([dbService.getParties(), dbService.getBills()]);
      setParties(pt);
      setBills(b);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const partyStats = parties.map(party => {
    const partyBills = bills.filter(b => b.party_id === party.id);
    const totalSales = partyBills.reduce((sum, b) => sum + b.bill_amount, 0);
    const totalReceived = partyBills.reduce((sum, b) => sum + b.paid_amount, 0);
    const outstanding = partyBills.reduce((sum, b) => sum + b.outstanding_amount, 0);
    
    const unpaidBills = partyBills.filter(b => b.status !== 'PAID').sort((a, b) => a.bill_date - b.bill_date);
    const oldestBill = unpaidBills.length > 0 ? unpaidBills[0] : null;
    const dueDays = oldestBill ? calculateDueDays(oldestBill.bill_date, null) : 0;
    
    let status = 'PAID';
    if (outstanding > 0) {
      status = dueDays > 30 ? 'OVERDUE' : (unpaidBills.some(b => b.status === 'PARTIALLY PAID') ? 'PARTIALLY PAID' : 'DUE');
    }

    return {
      ...party,
      totalBills: partyBills.length,
      totalSales,
      totalReceived,
      outstanding: outstanding > 0 ? outstanding : 0,
      oldestDueDays: dueDays,
      status
    };
  });

  const filteredParties = partyStats.filter(p => p.party_name.toLowerCase().includes(search.toLowerCase()));

  async function handleAddParty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newParty = {
      party_name: formData.get('party_name') as string,
      mobile: formData.get('mobile') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
      gst_number: formData.get('gst_number') as string,
      opening_balance: Number(formData.get('opening_balance')) || 0,
    };
    
    await dbService.addParty(newParty);
    setIsAddModalOpen(false);
    loadData();
  }

  async function handleEditParty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingParty) return;
    const formData = new FormData(e.currentTarget);
    await dbService.updateParty(editingParty.id, {
      party_name: formData.get('party_name') as string,
      mobile: formData.get('mobile') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
      gst_number: formData.get('gst_number') as string,
      opening_balance: Number(formData.get('opening_balance')) || 0,
    });
    setEditingParty(null);
    loadData();
  }

  async function handleDeleteParty(id: string) {
    if (!window.confirm("Are you sure you want to delete this party? All related data will be orphaned.")) return;
    await adminDbService.deleteParty(id);
    loadData();
  }

  if (loading) return <div className="w-full flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="w-full space-y-4">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-lg font-black text-slate-900">Parties & Receivables</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center bg-indigo-600 text-white rounded-xl px-4 py-2 font-bold shadow-sm hover:bg-indigo-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Party
        </button>
      </div>

      <div className="w-full relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Search parties..."
          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredParties.map((party) => (
          <div key={party.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="truncate pr-2">
                <h3 className="text-base font-bold text-slate-900 truncate">{party.party_name}</h3>
                <p className="text-sm text-slate-500">{party.mobile || 'No Mobile'}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                party.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                party.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                party.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {party.status}
              </span>
            </div>
            
            <div className="my-3">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Outstanding</p>
              <p className="text-2xl sm:text-3xl font-black text-red-600">
                {formatCurrency(party.outstanding)}
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-auto mb-4 text-sm bg-slate-50 rounded-xl p-3">
              <div>
                <p className="text-slate-500 text-xs font-medium">Bills</p>
                <p className="font-bold text-slate-900">{party.totalBills}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs font-medium">Sales</p>
                <p className="font-bold text-slate-900 truncate" title={formatCurrency(party.totalSales)}>{formatCurrency(party.totalSales)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs font-medium">Received</p>
                <p className="font-bold text-slate-900 truncate" title={formatCurrency(party.totalReceived)}>{formatCurrency(party.totalReceived)}</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex gap-2">
                {profile?.role === 'admin' && (
                  <>
                    <button onClick={() => setEditingParty(party)} className="p-2 text-slate-600 hover:text-indigo-600 rounded-xl bg-slate-100 hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteParty(party.id)} className="p-2 text-slate-600 hover:text-red-600 rounded-xl bg-slate-100 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
              <button onClick={() => onNavigate('partyLedger', party.id)} className="w-full sm:w-auto inline-flex justify-center items-center text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100">
                View Ledger <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        ))}
        {filteredParties.length === 0 && (
          <div className="col-span-full p-8 text-center text-sm text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-100">
            No parties found.
          </div>
        )}
      </div>

      {(isAddModalOpen || editingParty) && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/50 sm:p-4 transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">{editingParty ? 'Edit Party' : 'Add New Party'}</h3>
              <button onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto">
              <form onSubmit={editingParty ? handleEditParty : handleAddParty} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Party Name *</label>
                  <input required name="party_name" defaultValue={editingParty?.party_name} type="text" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile</label>
                    <input name="mobile" defaultValue={editingParty?.mobile} type="text" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GST Number</label>
                    <input name="gst_number" defaultValue={editingParty?.gst_number} type="text" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
                  <input name="email" defaultValue={editingParty?.email} type="email" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address</label>
                  <textarea name="address" defaultValue={editingParty?.address} rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Opening Balance (₹)</label>
                  <input name="opening_balance" defaultValue={editingParty?.opening_balance || 0} type="number" step="0.01" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                
                <div className="mt-6 flex justify-end space-x-3 pt-4 pb-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="rounded-xl px-4 py-2 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700">
                    {editingParty ? 'Update Party' : 'Save Party'}
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
