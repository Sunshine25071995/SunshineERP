import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Party, Bill } from '../types';
import { formatCurrency, calculateDueDays } from '../utils';
import { Edit2, Trash2, Plus, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth';
import toast from 'react-hot-toast';

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
      toast.error('Failed to load parties data');
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

  const filteredParties = partyStats.filter(p => String(p.party_name || '').toLowerCase().includes(search.toLowerCase()));

  async function handleAddParty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
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
      toast.success('Party added successfully');
      setIsAddModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to add party');
    }
  }

  async function handleEditParty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingParty) return;
    try {
      const formData = new FormData(e.currentTarget);
      await dbService.updateParty(editingParty.id, {
        party_name: formData.get('party_name') as string,
        mobile: formData.get('mobile') as string,
        email: formData.get('email') as string,
        address: formData.get('address') as string,
        gst_number: formData.get('gst_number') as string,
        opening_balance: Number(formData.get('opening_balance')) || 0,
      });
      toast.success('Party updated successfully');
      setEditingParty(null);
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to update party');
    }
  }

  async function handleDeleteParty(id: string) {
    if (!window.confirm("Are you sure you want to delete this party? All related data will be orphaned.")) return;
    try {
      await adminDbService.deleteParty(id);
      toast.success('Party deleted');
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to delete party');
    }
  }

  if (loading) return <div className="w-full flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  const inputClasses = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50 px-4 py-3 text-sm focus:outline-none transition-colors";

  return (
    <div className="w-full space-y-4 pb-[80px]">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">Parties & Receivables</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="hidden md:inline-flex items-center justify-center bg-indigo-600 text-white rounded-xl px-4 py-2 font-bold shadow-sm hover:bg-indigo-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Party
        </button>
      </div>

      <button
        onClick={() => setIsAddModalOpen(true)}
        className="md:hidden fab-btn fixed bottom-20 right-6 z-40 bg-indigo-600 text-white p-4 rounded-[20px] shadow-lg hover:bg-indigo-700 flex items-center justify-center"
      >
        <Plus className="h-6 w-6" />
      </button>

      <div className="w-full">
        <div className="pb-4">
          <div className="relative w-full sm:max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search parties..."
              className={inputClasses.replace('rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50', 'border-none rounded-[20px] bg-slate-100 focus:ring-2 focus:ring-indigo-500 pl-10')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Mobile Card List */}
        <div className="md:hidden flex flex-col gap-3 ">
          {filteredParties.map((party) => (
            <div key={party.id} className={`app-card p-5 rounded-[24px] border-none flex flex-col gap-3 ${
                party.status === 'PAID' ? 'bg-emerald-50' :
                party.status === 'OVERDUE' ? 'bg-rose-50' :
                party.status === 'PARTIALLY PAID' ? 'bg-blue-50' :
                'bg-amber-50'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <button onClick={() => onNavigate('partyLedger', party.id)} className="text-xl font-black text-slate-900 hover:text-indigo-600 text-left">
                    {party.party_name}
                  </button>
                  <p className="text-xs text-slate-500 mt-0.5">{party.mobile || 'No contact'}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${
                  party.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                  party.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                  party.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {party.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Total Sales</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(party.totalSales)}</p>
                </div>
                <div className="bg-red-50 p-2 rounded-xl">
                  <p className="text-[10px] text-red-500 font-bold uppercase">Outstanding</p>
                  <p className="text-sm font-black text-red-600">{party.outstanding > 0 ? formatCurrency(party.outstanding) : '-'}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-slate-100 mt-1">
                <div className="text-xs font-bold text-slate-600">
                  {party.totalBills} Bills
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onNavigate('partyLedger', party.id)} className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold">
                    Ledger
                  </button>
                  {profile?.role === 'admin' && (
                    <>
                      <button onClick={() => setEditingParty(party)} className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-slate-100">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteParty(party.id)} className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-slate-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredParties.length === 0 && (
            <div className="text-center text-sm text-slate-500 font-medium py-4">
              No parties found.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full divide-y divide-slate-200 whitespace-nowrap">
            <thead className="bg-slate-800 text-white text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">Party Name</th>
                <th scope="col" className="px-3 py-2 text-left font-bold">Contact</th>
                <th scope="col" className="px-3 py-2 text-center font-bold">Bills</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">Total Sales</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">Received</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">Outstanding</th>
                <th scope="col" className="px-3 py-2 text-center font-bold">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredParties.map((party) => (
                <tr key={party.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-sm font-bold text-slate-900">
                    <button onClick={() => onNavigate('partyLedger', party.id)} className="hover:text-indigo-600 hover:underline">
                      {party.party_name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-600">
                    {party.mobile || '-'}
                  </td>
                  <td className="px-3 py-2 text-sm font-bold text-slate-900 text-center">
                    {party.totalBills}
                  </td>
                  <td className="px-3 py-2 text-sm font-bold text-slate-900 text-right">
                    {formatCurrency(party.totalSales)}
                  </td>
                  <td className="px-3 py-2 text-sm font-bold text-emerald-600 text-right">
                    {formatCurrency(party.totalReceived)}
                  </td>
                  <td className="px-3 py-2 text-sm font-black text-red-600 text-right">
                    {party.outstanding > 0 ? formatCurrency(party.outstanding) : '-'}
                  </td>
                  <td className="px-3 py-2 text-center text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      party.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                      party.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                      party.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {party.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-sm">
                    <button onClick={() => onNavigate('partyLedger', party.id)} className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-xl mr-2 font-bold" title="View Ledger">
                      Ledger
                    </button>
                    {profile?.role === 'admin' && (
                      <>
                        <button onClick={() => setEditingParty(party)} className="p-1 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 mr-1" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteParty(party.id)} className="p-1 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500 font-medium">
                    No parties found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(isAddModalOpen || editingParty) && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/50 sm:p-4 transition-all">
          <div className="bg-white rounded-t-[28px] sm:rounded-2xl shadow-xl w-full sm:max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col pb-safe">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-xl font-bold text-slate-900">{editingParty ? 'Edit Party' : 'Add New Party'}</h3>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full bg-slate-50">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto">
              <form onSubmit={editingParty ? handleEditParty : handleAddParty} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Party Name *</label>
                  <input required name="party_name" defaultValue={editingParty?.party_name} type="text" className={inputClasses} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile</label>
                    <input name="mobile" defaultValue={editingParty?.mobile} type="text" className={inputClasses} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GST Number</label>
                    <input name="gst_number" defaultValue={editingParty?.gst_number} type="text" className={inputClasses} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
                  <input name="email" defaultValue={editingParty?.email} type="email" className={inputClasses} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address</label>
                  <textarea name="address" defaultValue={editingParty?.address} rows={2} className={inputClasses}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Opening Balance (₹)</label>
                  <input name="opening_balance" defaultValue={editingParty?.opening_balance || 0} type="number" step="0.01" className={inputClasses} />
                </div>
                
                <div className="mt-6 flex justify-end space-x-3 pt-4 pb-2">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="rounded-xl px-5 py-3 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 w-full sm:w-auto">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-5 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
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
