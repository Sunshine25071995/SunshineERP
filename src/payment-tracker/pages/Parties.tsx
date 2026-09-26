import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Party, Bill } from '../types';
import { formatCurrency, calculateDueDays } from '../utils';
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
        
        {/* Mobile List View (Transaction style) */}
        <div className="md:hidden flex flex-col bg-white rounded-[28px] p-2 shadow-sm">
          {filteredParties.map((party, index) => (
            <React.Fragment key={party.id}>
              <div 
                onClick={() => onNavigate('partyLedger', party.id)}
                className="flex items-center p-3 hover:bg-slate-50 cursor-pointer transition-colors rounded-2xl"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0 mr-4">
                  {party.party_name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-base font-bold text-slate-900 truncate">{party.party_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 font-medium">{party.totalBills} Bills</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      party.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                      party.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                      party.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {party.status}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3 flex flex-col items-end">
                  {party.outstanding > 0 ? (
                    <p className="text-base font-black text-rose-600">{formatCurrency(party.outstanding)}</p>
                  ) : (
                    <p className="text-base font-black text-emerald-600">Paid</p>
                  )}
                  {profile?.role === 'admin' && (
                    <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditingParty(party)} className="text-slate-400 hover:text-indigo-600">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteParty(party.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {index < filteredParties.length - 1 && (
                <div className="mx-4 border-b border-slate-100"></div>
              )}
            </React.Fragment>
          ))}
          {filteredParties.length === 0 && (
            <div className="text-center text-sm text-slate-500 font-medium py-8">
              No parties found.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block w-full overflow-x-auto bg-white rounded-[28px] shadow-sm p-4">
          <table className="w-full divide-y divide-slate-100 whitespace-nowrap">
            <thead className="text-slate-500 text-xs uppercase tracking-wider text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Party Name</th>
                <th scope="col" className="px-4 py-3 font-bold">Contact</th>
                <th scope="col" className="px-4 py-3 font-bold text-center">Bills</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Total Sales</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Received</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Outstanding</th>
                <th scope="col" className="px-4 py-3 font-bold text-center">Status</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParties.map((party) => (
                <tr key={party.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-bold text-slate-900">
                    <button onClick={() => onNavigate('partyLedger', party.id)} className="hover:text-indigo-600 hover:underline">
                      {party.party_name}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 font-medium">
                    {party.mobile || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900 text-center">
                    {party.totalBills}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900 text-right">
                    {formatCurrency(party.totalSales)}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-emerald-600 text-right">
                    {formatCurrency(party.totalReceived)}
                  </td>
                  <td className="px-4 py-4 text-sm font-black text-rose-600 text-right">
                    {party.outstanding > 0 ? formatCurrency(party.outstanding) : '-'}
                  </td>
                  <td className="px-4 py-4 text-center text-sm">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      party.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                      party.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                      party.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {party.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-sm">
                    <button onClick={() => onNavigate('partyLedger', party.id)} className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full mr-2 font-bold transition-colors">
                      Ledger
                    </button>
                    {profile?.role === 'admin' && (
                      <>
                        <button onClick={() => setEditingParty(party)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 mr-1 transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteParty(party.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500 font-medium">
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
