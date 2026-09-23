import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Payment, Party } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, Search, Trash2, Edit, CreditCard } from 'lucide-react';
import { useAuth } from '../auth';
import toast from 'react-hot-toast';

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
      const dateStr = formData.get('payment_date') as string;
      
      const newPayment = {
        party_id: formData.get('party_id') as string,
        payment_date: new Date(dateStr).getTime(),
        amount: Number(formData.get('amount')),
        payment_mode: formData.get('payment_mode') as string,
        reference_number: '',
        notes: formData.get('notes') as string,
        created_by: profile?.name || 'User',
      };
      
      await dbService.addPayment(newPayment);
      toast.success('Payment added successfully');
      setIsAddModalOpen(false);
      loadData();
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

  if (loading) return <div className="w-full flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  const inputClasses = "w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50 px-4 py-3 text-sm focus:outline-none transition-colors";

  return (
    <div className="w-full space-y-6 pb-[100px] font-sans">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payments</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="hidden md:inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Payment
        </button>
      </div>

      <div className="w-full">
        <div className="pb-4">
          <div className="relative w-full sm:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by party name..."
              className="w-full border-none rounded-full bg-slate-100 focus:ring-2 focus:ring-indigo-500 py-3 pl-12 pr-4 text-base font-medium outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {/* Mobile List View (Transaction style) */}
        <div className="md:hidden flex flex-col bg-white rounded-[28px] p-2 shadow-sm">
          {filteredPayments.map((payment, index) => {
            const party = parties.find(p => p.id === payment.party_id);
            return (
              <React.Fragment key={payment.id}>
                <div className="flex items-center p-3 hover:bg-slate-50 transition-colors rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mr-4">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-base font-bold text-slate-900 truncate">{party?.party_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-medium text-slate-500 truncate capitalize">{payment.payment_mode.replace('_', ' ')}</p>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <p className="text-xs font-medium text-slate-400">{formatDate(payment.payment_date)}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3 flex flex-col items-end justify-center">
                    <p className="text-base font-black text-emerald-600">+{formatCurrency(payment.amount)}</p>
                    
                    {profile?.role === 'admin' && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setEditingPayment(payment)} className="text-slate-400 hover:text-indigo-600">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeletePayment(payment.id)} className="text-slate-400 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {index < filteredPayments.length - 1 && (
                  <div className="mx-4 border-b border-slate-100"></div>
                )}
              </React.Fragment>
            );
          })}
          {filteredPayments.length === 0 && (
            <div className="text-center text-sm font-medium text-slate-500 py-8">
              No payments found.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block w-full overflow-x-auto bg-white rounded-[28px] shadow-sm p-4">
          <table className="w-full divide-y divide-slate-100 whitespace-nowrap">
            <thead className="text-slate-500 text-xs uppercase tracking-wider text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Date</th>
                <th scope="col" className="px-4 py-3 font-bold">Party Name</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Amount</th>
                <th scope="col" className="px-4 py-3 font-bold text-center">Mode</th>
                {profile?.role === 'admin' && <th scope="col" className="px-4 py-3 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map((payment) => {
                const party = parties.find(p => p.id === payment.party_id);
                return (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-sm text-slate-600 font-medium">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-900">
                      {party?.party_name}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-black text-emerald-600">
                      +{formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 capitalize">
                        {payment.payment_mode.replace('_', ' ')}
                      </span>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="px-4 py-4 text-right text-sm">
                        <button onClick={() => setEditingPayment(payment)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 mr-1 transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeletePayment(payment.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 5 : 4} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="md:hidden fab-btn fixed bottom-24 right-5 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl z-40 flex items-center justify-center hover:bg-indigo-700 transition-colors"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Payment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/40 sm:p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl w-full sm:max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col pb-safe">
            <div className="px-6 py-5 flex justify-between items-center bg-white relative">
              <h3 className="text-xl font-black text-slate-900">Add Payment</h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full bg-slate-50">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-6">
              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Party *</label>
                  <select required name="party_id" className={inputClasses}>
                    <option value="">Select Party</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.party_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Date *</label>
                    <input required name="payment_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inputClasses} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Amount (₹) *</label>
                    <input required name="amount" type="number" min="1" step="0.01" className={inputClasses} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Mode *</label>
                  <select required name="payment_mode" className={inputClasses}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Notes</label>
                  <textarea name="notes" rows={2} className={inputClasses}></textarea>
                </div>
                
                <div className="mt-8 flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-full px-6 py-3.5 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 w-full sm:w-auto transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-full px-6 py-3.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto transition-colors shadow-md">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/40 sm:p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl w-full sm:max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col pb-safe">
            <div className="px-6 py-5 flex justify-between items-center bg-white relative">
              <h3 className="text-xl font-black text-slate-900">Edit Payment</h3>
              <button type="button" onClick={() => setEditingPayment(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full bg-slate-50">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-6">
              <form onSubmit={handleEditPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Date *</label>
                  <input required name="payment_date" defaultValue={new Date(editingPayment.payment_date).toISOString().split('T')[0]} type="date" className={inputClasses} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Mode *</label>
                  <select required name="payment_mode" defaultValue={editingPayment.payment_mode} className={inputClasses}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Notes</label>
                  <textarea name="notes" defaultValue={editingPayment.notes} rows={2} className={inputClasses}></textarea>
                </div>
                <div className="text-xs font-medium text-slate-500 bg-slate-50 p-4 rounded-2xl border-none">
                  Note: Amount and party cannot be edited. To change these, delete and recreate the payment.
                </div>
                <div className="mt-8 flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setEditingPayment(null)} className="rounded-full px-6 py-3.5 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 w-full sm:w-auto transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-full px-6 py-3.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto transition-colors shadow-md">
                    Update
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
