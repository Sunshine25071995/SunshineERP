import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Payment, Party } from '../types';
import { formatCurrency, formatDate, cn } from '../utils';
import { Plus, Search, Trash2, Edit, CreditCard } from 'lucide-react';
import { useAuth } from '../auth';
import toast from 'react-hot-toast';
import { logActivity } from '../../services/activityLog';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [p, pt] = await Promise.all([dbService.getPayments(), dbService.getParties()]);
      setPayments(p);
      setParties(pt);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }

  const filteredPayments = payments.filter(p => 
    String(parties.find(pt => pt.id === p.party_id)?.party_name || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const partyId = formData.get('party_id') as string;
      const amount = Number(formData.get('amount'));
      
      if (!partyId) {
        toast.error('Please select a party');
        return;
      }
      if (!amount || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      const dateStr = formData.get('payment_date') as string;
      
      const newPayment = {
        party_id: partyId,
        payment_date: new Date(dateStr).getTime(),
        amount: amount,
        payment_mode: formData.get('payment_mode') as string,
        reference_number: '',
        notes: formData.get('notes') as string,
        created_by: profile?.name || 'User',
      };
      
      await dbService.addPayment(newPayment);
      toast.success('Payment added successfully');
      setIsAddModalOpen(false);
      loadData();
      
      const party = parties.find(p => p.id === newPayment.party_id);
      await logActivity('Payment Received', `Received ₹${newPayment.amount} from ${party?.party_name || 'Party'} via ${newPayment.payment_mode}`, profile?.uid || profile?.id || 'admin', profile?.name || 'Admin');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to add payment');
    }
  }
  
  async function handleEditPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const formData = new FormData(e.currentTarget);
      const dateStr = formData.get('payment_date') as string;
      
      await dbService.updatePaymentDetails(editingPayment.id, {
        payment_date: new Date(dateStr).getTime(),
        payment_mode: formData.get('payment_mode') as string,
        notes: formData.get('notes') as string,
      });
      toast.success('Payment updated successfully');
      setEditingPayment(null);
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to update payment');
    }
  }

  async function handleDeletePayment(id: string) {
    if (!window.confirm("Are you sure you want to delete this payment? It will reverse bill allocations and adjust the party's balance.")) return;
    try {
      await adminDbService.deletePayment(id);
      toast.success('Payment deleted successfully');
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to delete payment');
    }
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
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Payments</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-1.5 h-4 w-4 sm:h-5 sm:w-5" />
            Add Payment
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
              placeholder="Search by party name..."
              className="w-full border-none rounded-full bg-slate-100 focus:ring-2 focus:ring-indigo-500 py-2.5 pl-10 pr-4 text-sm font-medium outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Mobile View: High-Clarity Touch-Friendly Payment Cards */}
        <div className="sm:hidden space-y-3 px-1">
          {filteredPayments.map((payment) => {
            const party = parties.find(p => p.id === payment.party_id);
            return (
              <div key={payment.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-semibold text-slate-500">
                    {formatDate(payment.payment_date)}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-100 capitalize">
                    {payment.payment_mode.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {party?.party_name || 'Party'}
                    </h3>
                    {payment.reference_number && (
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        Ref: {payment.reference_number}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-emerald-600">
                      +{formatCurrency(payment.amount)}
                    </span>
                  </div>
                </div>

                {payment.notes && (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    📝 {payment.notes}
                  </p>
                )}

                {profile?.role === 'admin' && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => setEditingPayment(payment)}
                      className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Payment</span>
                    </button>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Delete Payment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredPayments.length === 0 && (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No payments recorded</p>
              <p className="text-xs text-slate-400 mt-1">{search ? 'No payments matching your search' : 'Record your first received payment below'}</p>
            </div>
          )}
        </div>

        {/* Desktop View: Clean Responsive Table */}
        <div className="hidden sm:block w-full bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Date/Mode</th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Party</th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Amount</th>
                  {profile?.role === 'admin' && <th scope="col" className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((payment, i) => {
                  const party = parties.find(p => p.id === payment.party_id);
                  return (
                    <tr key={payment.id} className={cn('transition-colors hover:bg-slate-50', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {formatDate(payment.payment_date)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 capitalize font-medium">
                          {payment.payment_mode.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-bold text-slate-900">
                          {party?.party_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-black text-emerald-600">
                          +{formatCurrency(payment.amount)}
                        </div>
                      </td>
                      {profile?.role === 'admin' && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setEditingPayment(payment)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors" title="Edit Payment">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeletePayment(payment.id)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors" title="Delete Payment">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={profile?.role === 'admin' ? 4 : 3} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-700">No payments recorded</p>
                        <p className="text-xs text-slate-400 mt-1">{search ? 'No payments matching your search' : 'Record your first received payment below'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Payment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm transition-all overflow-y-auto">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col animate-scale-in my-auto">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-lg font-black text-slate-900">Add Payment</h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full bg-slate-50 transition-colors">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-5 sm:px-6 py-5">
              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Party *</label>
                  <select name="party_id" className={inputClasses} required>
                    <option value="">Select Party</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.party_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Date *</label>
                    <input name="payment_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inputClasses} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Amount (₹) *</label>
                    <input name="amount" type="number" min="1" step="0.01" className={inputClasses} placeholder="0.00" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Mode *</label>
                  <select name="payment_mode" className={inputClasses}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Notes</label>
                  <textarea name="notes" rows={2} className={inputClasses} placeholder="Optional notes..."></textarea>
                </div>
                
                <div className="mt-6 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex-1 sm:flex-none transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none transition-colors shadow-md">
                    Save Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm transition-all overflow-y-auto">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col animate-scale-in my-auto">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-lg font-black text-slate-900">Edit Payment</h3>
              <button type="button" onClick={() => setEditingPayment(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full bg-slate-50 transition-colors">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-5 sm:px-6 py-5">
              <form onSubmit={handleEditPayment} className="space-y-4">
                {/* Party & Amount Display */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Party</label>
                  <div className="px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-extrabold text-slate-900 border border-slate-200">
                    {parties.find(p => p.id === editingPayment.party_id)?.party_name || 'Party'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Date *</label>
                    <input name="payment_date" defaultValue={new Date(editingPayment.payment_date).toISOString().split('T')[0]} type="date" className={inputClasses} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Payment Amount</label>
                    <div className="px-4 py-2.5 bg-emerald-50 rounded-xl text-base font-black text-emerald-700 border border-emerald-200">
                      +{formatCurrency(editingPayment.amount)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Mode *</label>
                  <select name="payment_mode" defaultValue={editingPayment.payment_mode} className={inputClasses}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Notes</label>
                  <textarea name="notes" defaultValue={editingPayment.notes} rows={2} className={inputClasses} placeholder="Optional notes..."></textarea>
                </div>
                <div className="text-[11px] font-medium text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  💡 Note: To alter amount or reassign party, delete this payment and record a new one to preserve accounting allocations.
                </div>
                <div className="mt-6 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditingPayment(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex-1 sm:flex-none transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none transition-colors shadow-md">
                    Update Payment
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
