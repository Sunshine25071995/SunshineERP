import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Party, Bill } from '../types';
import { formatCurrency, calculateDueDays, cn } from '../utils';
import { Edit2, Trash2, Plus, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth';
import toast from 'react-hot-toast';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

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

  const { isPulling } = usePullToRefresh(loadData);

  if (loading) return <SkeletonLoader variant="list" />;

  const inputClasses = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50 px-4 py-3 text-sm focus:outline-none transition-colors";

  return (
    <div className="w-full space-y-6 pb-[100px] font-sans animate-slide-up">
      {isPulling && (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      )}
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Parties</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="hidden md:inline-flex items-center justify-center bg-indigo-600 text-white rounded-full px-5 py-2.5 font-bold shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Party
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
              placeholder="Search parties..."
              className="w-full border-none rounded-full bg-slate-100 focus:ring-2 focus:ring-indigo-500 py-3 pl-12 pr-4 text-base font-medium outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Responsive Edge-to-Edge Table */}
        <div className="w-full bg-white sm:rounded-[28px] shadow-sm border-y sm:border border-slate-200 overflow-hidden -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">Party</th>
                <th scope="col" className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Sales/Rec</th>
                <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Outstanding</th>
                <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParties.map((party, i) => (
                <tr key={party.id} className={cn('transition-colors hover:bg-slate-50', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <button onClick={() => onNavigate('partyLedger', party.id)} className="text-[11px] sm:text-sm font-bold text-slate-900 hover:text-indigo-600 text-left line-clamp-1">
                      {party.party_name}
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold',
                        party.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                        party.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                        party.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      )}>
                        {party.status}
                      </span>
                      {party.mobile && <span className="text-[9px] sm:text-xs text-slate-500 hidden sm:inline">{party.mobile}</span>}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-right">
                    <div className="text-[10px] sm:text-xs font-bold text-slate-900">{formatCurrency(party.totalSales)}</div>
                    <div className="text-[9px] sm:text-xs font-bold text-emerald-600">{formatCurrency(party.totalReceived)}</div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right align-top sm:align-middle">
                    <div className="text-[11px] sm:text-sm font-black text-rose-600">
                      {party.outstanding > 0 ? formatCurrency(party.outstanding) : <span className="text-emerald-600">Paid</span>}
                    </div>
                    {/* Show sales/rec on mobile under outstanding to save space */}
                    <div className="sm:hidden mt-0.5 flex flex-col items-end">
                      <span className="text-[8px] text-slate-500">S: {formatCurrency(party.totalSales)}</span>
                      <span className="text-[8px] text-emerald-600">R: {formatCurrency(party.totalReceived)}</span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right align-top sm:align-middle">
                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1 sm:gap-2">
                      <button onClick={() => onNavigate('partyLedger', party.id)} className="text-[10px] sm:text-xs px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded font-bold transition-colors">
                        Ledger
                      </button>
                      {profile?.role === 'admin' && (
                        <div className="flex gap-1 mt-1 sm:mt-0">
                          <button onClick={() => setEditingParty(party)} className="p-1 text-slate-400 hover:text-indigo-600 rounded bg-slate-50 hover:bg-slate-100">
                            <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          <button onClick={() => handleDeleteParty(party.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded bg-slate-50 hover:bg-slate-100">
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500 font-medium">
                    No parties found.
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
          onClick={() => setIsAddModalOpen(true)}
          className="md:hidden fab-btn fixed bottom-24 right-5 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl z-40 flex items-center justify-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Modals - Bottom Sheet Style */}
      {(isAddModalOpen || editingParty) && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/40 sm:p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl w-full sm:max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col pb-safe animate-scale-in">
            <div className="px-6 py-5 flex justify-between items-center bg-white relative">
              <h3 className="text-xl font-black text-slate-900">{editingParty ? 'Edit Party' : 'Add Party'}</h3>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full bg-slate-50">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-6">
              <form onSubmit={editingParty ? handleEditParty : handleAddParty} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Party Name *</label>
                  <input required name="party_name" defaultValue={editingParty?.party_name} type="text" className={inputClasses} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Mobile</label>
                    <input name="mobile" defaultValue={editingParty?.mobile} type="text" className={inputClasses} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">GST Number</label>
                    <input name="gst_number" defaultValue={editingParty?.gst_number} type="text" className={inputClasses} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Email</label>
                  <input name="email" defaultValue={editingParty?.email} type="email" className={inputClasses} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Address</label>
                  <textarea name="address" defaultValue={editingParty?.address} rows={2} className={inputClasses}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Opening Balance (₹)</label>
                  <input name="opening_balance" defaultValue={editingParty?.opening_balance || 0} type="number" step="0.01" className={inputClasses} />
                </div>
                
                <div className="mt-8 flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="rounded-full px-6 py-3.5 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 w-full sm:w-auto transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-full px-6 py-3.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto transition-colors shadow-md">
                    {editingParty ? 'Update' : 'Save'}
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
