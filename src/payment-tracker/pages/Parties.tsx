import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Party, Bill } from '../types';
import { formatCurrency, calculateDueDays, cn } from '../utils';
import { Edit2, Trash2, Plus, Search, ChevronRight, MessageCircle, FileText } from 'lucide-react';
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

  function shareWhatsApp(party: typeof partyStats[0]) {
    let msg = `📊 *${party.party_name}*\n`;
    msg += `━━━━━━━━━━━━━━━━\n`;
    msg += `📦 Bills: ${party.totalBills}\n`;
    msg += `💰 Sales: ${formatCurrency(party.totalSales)}\n`;
    msg += `✅ Received: ${formatCurrency(party.totalReceived)}\n`;
    msg += `🚨 Outstanding: ${formatCurrency(party.outstanding)}\n`;
    msg += `\n_Sunshine Polyfilm Industries_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const { isPulling } = usePullToRefresh(loadData);

  if (loading) return <SkeletonLoader variant="list" />;

  const inputClasses = "w-full bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50/50 px-4 py-2.5 text-sm outline-none transition-colors";

  // Summary totals
  const totalOutstanding = filteredParties.reduce((s, p) => s + p.outstanding, 0);
  const totalSales = filteredParties.reduce((s, p) => s + p.totalSales, 0);
  const totalReceived = filteredParties.reduce((s, p) => s + p.totalReceived, 0);

  return (
    <div className="w-full space-y-4 pb-[100px] font-sans animate-slide-up">
      {isPulling && (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Parties</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center bg-indigo-600 text-white rounded-full px-4 py-2 text-sm font-bold shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-1.5 h-4 w-4" />
            Add Party
          </button>
        )}
      </div>

      {/* Summary Cards - Vertically Aligned */}
      <div className="flex flex-col gap-3 px-1">
        <div className="bg-[#FCA5A5] text-black p-4 rounded-3xl border-none shadow-sm flex justify-between items-center">
          <p className="text-xs sm:text-sm font-bold opacity-80 uppercase tracking-wider">Total Sales</p>
          <p className="text-lg sm:text-2xl font-black tracking-tight break-all">{formatCurrency(totalSales)}</p>
        </div>
        <div className="bg-[#6EE7B7] text-black p-4 rounded-3xl border-none shadow-sm flex justify-between items-center">
          <p className="text-xs sm:text-sm font-bold opacity-80 uppercase tracking-wider">Received</p>
          <p className="text-lg sm:text-2xl font-black tracking-tight break-all">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-[#FDE047] text-black p-4 rounded-3xl border-none shadow-sm flex justify-between items-center">
          <p className="text-xs sm:text-sm font-bold opacity-80 uppercase tracking-wider">Outstanding</p>
          <p className="text-lg sm:text-2xl font-black tracking-tight break-all">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-1">
        <div className="relative w-full sm:max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search parties..."
            className="w-full border-none rounded-full bg-slate-100 focus:ring-2 focus:ring-indigo-500 py-2.5 pl-10 pr-4 text-sm font-medium outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Party List - Full width cards */}
      <div className="flex flex-col gap-2 px-1">
        {filteredParties.map((party) => (
          <div key={party.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Party Name Row */}
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <button 
                onClick={() => onNavigate('partyLedger', party.id)} 
                className="text-sm font-bold text-slate-900 hover:text-indigo-600 truncate max-w-[60%] text-left"
              >
                {party.party_name}
              </button>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold',
                party.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                party.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                party.status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              )}>
                {party.status}
              </span>
            </div>

            {/* Stats - Vertically Aligned */}
            <div className="flex flex-col gap-1.5 px-3 py-2">
              <div className="bg-slate-50 rounded-xl px-3 py-2 flex justify-between items-center">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Sales</p>
                <p className="text-sm sm:text-base font-black text-slate-900">{formatCurrency(party.totalSales)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-3 py-2 flex justify-between items-center">
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Received</p>
                <p className="text-sm sm:text-base font-black text-emerald-700">{formatCurrency(party.totalReceived)}</p>
              </div>
              <div className="bg-red-50 rounded-xl px-3 py-2 flex justify-between items-center">
                <p className="text-xs text-red-500 font-bold uppercase tracking-wider">Outstanding</p>
                <p className="text-sm sm:text-base font-black text-red-600">
                  {party.outstanding > 0 ? formatCurrency(party.outstanding) : '₹0'}
                </p>
              </div>
            </div>

            {/* Action Buttons Row - compact */}
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 border-t border-slate-50">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => onNavigate('partyLedger', party.id)} 
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  Ledger
                </button>
                <button 
                  onClick={() => shareWhatsApp(party)} 
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition-colors"
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </button>
              </div>
              {profile?.role === 'admin' && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditingParty(party)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeleteParty(party.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredParties.length === 0 && (
          <div className="text-center text-sm text-slate-500 font-medium py-12 bg-white rounded-2xl shadow-sm">
            No parties found.
          </div>
        )}
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

      {/* Modal - Top Positioned */}
      {(isAddModalOpen || editingParty) && (
        <div className="fixed inset-0 z-50 flex flex-col justify-start items-center bg-slate-900/60 p-4 pt-12 sm:pt-20 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white relative">
              <h3 className="text-lg font-black text-slate-900">{editingParty ? 'Edit Party' : 'Add Party'}</h3>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full bg-slate-50 transition-colors">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <form onSubmit={editingParty ? handleEditParty : handleAddParty} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Party Name *</label>
                  <input name="party_name" defaultValue={editingParty?.party_name} type="text" className={inputClasses} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Mobile</label>
                    <input name="mobile" defaultValue={editingParty?.mobile} type="text" className={inputClasses} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">GST Number</label>
                    <input name="gst_number" defaultValue={editingParty?.gst_number} type="text" className={inputClasses} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Email</label>
                  <input name="email" defaultValue={editingParty?.email} type="email" className={inputClasses} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Address</label>
                  <textarea name="address" defaultValue={editingParty?.address} rows={2} className={inputClasses}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Opening Balance (₹)</label>
                  <input name="opening_balance" defaultValue={editingParty?.opening_balance || 0} type="number" step="0.01" className={inputClasses} />
                </div>
                
                <div className="mt-6 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex-1 sm:flex-none transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none transition-colors shadow-md">
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
