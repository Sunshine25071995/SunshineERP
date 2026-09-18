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
    const totalReceived = partyBills.reduce((sum, b) => sum + b.paid_amount, 0); // Not perfectly accurate if they have advance, but good enough for display
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
      outstanding: outstanding > 0 ? outstanding : 0, // Advance is stored in party
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

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Parties & Receivables</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Party
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search parties..."
              className="block w-full rounded-lg border-0 py-2 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Party Name</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Total Bills</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Advance</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Oldest Due</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredParties.map((party) => (
                <tr key={party.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{party.party_name}</div>
                    <div className="text-sm text-slate-500">{party.mobile}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-500">
                    {party.totalBills}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                    {formatCurrency(party.outstanding)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-emerald-600 font-medium">
                    {party.advance_balance > 0 ? formatCurrency(party.advance_balance) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">
                    {party.oldestDueDays > 0 ? `${party.oldestDueDays} days` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      party.status === 'CLEAR' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                      party.status === 'DUE' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                      'bg-red-50 text-red-700 ring-red-600/20'
                    }`}>
                      {party.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      {profile?.role === 'admin' && (
                        <>
                          <button onClick={() => setEditingParty(party)} className="text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteParty(party.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                      <button onClick={() => onNavigate('partyLedger', party.id)} className="text-indigo-600 hover:text-indigo-900 flex items-center">
                        Ledger <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    No parties found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredParties.map((party) => (
            <div key={party.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{party.party_name}</h3>
                  <p className="text-sm text-slate-500">{party.mobile}</p>
                </div>
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                  party.status === 'CLEAR' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                  party.status === 'DUE' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                  'bg-red-50 text-red-700 ring-red-600/20'
                }`}>
                  {party.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Total Bills</p>
                  <p className="font-medium text-slate-900">{party.totalBills}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Oldest Due</p>
                  <p className="font-medium text-slate-900">{party.oldestDueDays > 0 ? `${party.oldestDueDays} days` : '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Outstanding</p>
                  <p className="font-semibold text-rose-600">{formatCurrency(party.outstanding)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Advance</p>
                  <p className="font-medium text-emerald-600">{party.advance_balance > 0 ? formatCurrency(party.advance_balance) : '-'}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                <div className="flex gap-2">
                  {profile?.role === 'admin' && (
                    <>
                      <button onClick={() => setEditingParty(party)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded bg-slate-50"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteParty(party.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-slate-50"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
                <button onClick={() => onNavigate('partyLedger', party.id)} className="inline-flex items-center text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                  View Ledger <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          ))}
          {filteredParties.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No parties found.
            </div>
          )}
        </div>
      </div>

      {(isAddModalOpen || editingParty) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">{editingParty ? 'Edit Party' : 'Add New Party'}</h3>
              <button onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="text-slate-400 hover:text-slate-500">
                &times;
              </button>
            </div>
            <form onSubmit={editingParty ? handleEditParty : handleAddParty} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Party Name *</label>
                <input required name="party_name" defaultValue={editingParty?.party_name} type="text" className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Mobile</label>
                  <input name="mobile" defaultValue={editingParty?.mobile} type="text" className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">GST Number</label>
                  <input name="gst_number" defaultValue={editingParty?.gst_number} type="text" className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input name="email" defaultValue={editingParty?.email} type="email" className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Address</label>
                <textarea name="address" defaultValue={editingParty?.address} rows={2} className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Opening Balance / Advance (₹)</label>
                <input name="opening_balance" defaultValue={editingParty?.opening_balance || 0} type="number" step="0.01" className="mt-1 block w-full rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <p className="text-xs text-slate-500 mt-1">Positive amount acts as an advance credit.</p>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700">
                  {editingParty ? 'Update Party' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
