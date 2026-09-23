import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Bill, Party } from '../payment-tracker/types';
import { formatCurrency } from '../payment-tracker/utils';

interface PaymentDueAlertProps {
  bills: Bill[];
  parties: Party[];
}

export function PaymentDueAlert({ bills, parties }: PaymentDueAlertProps) {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const overdueBills = bills.filter(b => b.outstanding_amount > 0 && b.bill_date < thirtyDaysAgo);

  if (overdueBills.length === 0) return null;

  const partyMap = parties.reduce((acc, p) => { acc[p.id] = p.party_name; return acc; }, {} as Record<string, string>);

  return (
    <div className="bg-red-50 rounded-[28px] p-5 mt-6 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <h3 className="text-lg font-bold text-red-900">Overdue Payments ({'>'} 30 Days)</h3>
      </div>
      <div className="space-y-3">
        {overdueBills.map(bill => {
          const daysOverdue = Math.floor((Date.now() - bill.bill_date) / (24 * 60 * 60 * 1000));
          return (
            <div key={bill.id} className="bg-white/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{partyMap[bill.party_id] || 'Unknown Party'}</p>
                <p className="text-sm text-slate-500">Bill: {bill.bill_number} • Overdue by {daysOverdue} days</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-black text-red-600">{formatCurrency(bill.outstanding_amount)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
