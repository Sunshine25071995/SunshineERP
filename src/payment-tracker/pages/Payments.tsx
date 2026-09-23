import React, { useEffect, useState } from 'react';
import { dbService } from '../db';
import { adminDbService } from '../db-admin';
import { Payment, Party } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, Search, Trash2, Edit } from 'lucide-react';
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

  return (
    <div className="w-full space-y-4">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-lg font-black text-slate-900">Received Payments</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Payment
        </button>
      </div>

      <div className="w-full bg-white shadow-sm rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative w-full sm:max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by party name..."
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full divide-y divide-slate-200 whitespace-nowrap">
            <thead className="bg-slate-800 text-white text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-1 py-1.5 text-[9px] md:text-xs text-left font-bold">Date</th>
                <th scope="col" className="px-1 py-1.5 text-[9px] md:text-xs text-left font-bold">Party Name</th>
                <th scope="col" className="px-1 py-1.5 text-[9px] md:text-xs text-right font-bold">Amount</th>
                <th scope="col" className="px-1 py-1.5 text-[9px] md:text-xs text-center font-bold">Mode</th>
                {profile?.role === 'admin' && <th scope="col" className="px-1 py-1.5 text-[9px] md:text-xs text-right font-bold">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPayments.map((payment) => {
                const party = parties.find(p => p.id === payment.party_id);
                return (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-1 py-1.5 text-[9px] md:text-xs text-slate-700 font-medium">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-1 py-1.5 text-[9px] md:text-xs font-bold text-slate-900">
                      {party?.party_name}
                    </td>
                    <td className="px-1 py-1.5 text-right text-[9px] md:text-xs font-black text-emerald-600">
                      +{formatCurrency(payment.amount)}
                    </td>
                    <td className="px-1 py-1.5 text-center text-[9px] md:text-xs">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-800 capitalize">
                        {payment.payment_mode}
                      </span>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="px-1 py-1.5 text-right text-[9px] md:text-xs">
                        <button onClick={() => setEditingPayment(payment)} className="p-0.5 md:p-2 text-slate-600 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 mr-2">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeletePayment(payment.id)} className="p-0.5 md:p-2 text-slate-600 hover:text-red-600 rounded-xl hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 5 : 4} className="px-2 py-6 text-center text-sm font-medium text-slate-500">
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/50 sm:p-4 transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">Add Collection Entry</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto">
              <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Party *</label>
                  <select required name="party_id" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="">Select Party</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.party_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Date *</label>
                    <input required name="payment_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount Received (₹) *</label>
                    <input required name="amount" type="number" min="1" step="0.01" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Mode *</label>
                  <select required name="payment_mode" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
                  <textarea name="notes" rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3 pt-4 pb-4">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-xl px-4 py-2 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700">
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
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center bg-slate-900/50 sm:p-4 transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">Edit Payment</h3>
              <button onClick={() => setEditingPayment(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                &times;
              </button>
            </div>
            <div className="overflow-y-auto">
              <form onSubmit={handleEditPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Date *</label>
                  <input required name="payment_date" defaultValue={new Date(editingPayment.payment_date).toISOString().split('T')[0]} type="date" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Mode *</label>
                  <select required name="payment_mode" defaultValue={editingPayment.payment_mode} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
                  <textarea name="notes" defaultValue={editingPayment.notes} rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                </div>
                <div className="text-xs font-medium text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  Note: Amount and party cannot be edited after creation. To change these, delete the payment and recreate it.
                </div>
                <div className="mt-6 flex justify-end space-x-3 pt-4 pb-4">
                  <button type="button" onClick={() => setEditingPayment(null)} className="rounded-xl px-4 py-2 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700">
                    Save Changes
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
