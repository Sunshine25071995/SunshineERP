import { Bill, PaymentAllocation } from './types';

export interface AllocationResult {
  updatedBills: (Bill & { _allocAmount: number })[];
  remainingAdvance: number;
}

/**
 * Distributes a payment amount across a party's unpaid bills based on the FIFO rule.
 * 
 * @param paymentAmount The total payment amount received
 * @param unpaidBills Array of unpaid bills for the party
 * @param paymentDate The date of the payment (used for fully_paid_date)
 * @returns Object containing updated bills and any remaining advance balance
 */
export function allocatePaymentFIFO(
  paymentAmount: number,
  unpaidBills: Bill[],
  paymentDate: number
): AllocationResult {
  let remainingPayment = paymentAmount;
  const updatedBills: (Bill & { _allocAmount: number })[] = [];

  // FIFO order: sort by bill date ascending
  const sortedBills = [...unpaidBills].sort((a, b) => a.bill_date - b.bill_date);

  for (const bill of sortedBills) {
    if (remainingPayment <= 0) break;
    if (bill.status === 'PAID') continue;

    const allocAmount = Math.min(bill.outstanding_amount, remainingPayment);

    const newPaid = bill.paid_amount + allocAmount;
    const newOut = bill.outstanding_amount - allocAmount;
    const newStatus = newOut === 0 ? 'PAID' : 'PARTIALLY PAID';

    updatedBills.push({
      ...bill,
      paid_amount: newPaid,
      outstanding_amount: newOut,
      status: newStatus,
      fully_paid_date: newOut === 0 ? paymentDate : bill.fully_paid_date || null,
      _allocAmount: allocAmount,
    });

    remainingPayment -= allocAmount;
  }

  return {
    updatedBills,
    remainingAdvance: remainingPayment,
  };
}

/**
 * Allocates an existing advance balance to a newly created bill.
 * 
 * @param bill The newly created bill
 * @param advanceBalance The party's current advance balance
 * @returns Object containing the updated bill and the remaining advance balance
 */
export function allocateAdvanceToNewBill(
  bill: Bill,
  advanceBalance: number
): { updatedBill: Bill; remainingAdvance: number } {
  let advance = advanceBalance || 0;
  let paid_amount = bill.paid_amount || 0;
  let outstanding = bill.outstanding_amount ?? bill.bill_amount;
  let status = bill.status || 'DUE';
  let fully_paid_date = bill.fully_paid_date || null;

  if (advance > 0) {
    const allocationAmount = Math.min(outstanding, advance);
    paid_amount += allocationAmount;
    outstanding -= allocationAmount;
    advance -= allocationAmount;
    
    status = outstanding === 0 ? 'PAID' : 'PARTIALLY PAID';
    if (outstanding === 0) fully_paid_date = Date.now();
  }

  return {
    updatedBill: {
      ...bill,
      paid_amount,
      outstanding_amount: outstanding,
      status: status as 'PAID' | 'PARTIALLY PAID' | 'DUE' | 'OVERDUE',
      fully_paid_date,
    },
    remainingAdvance: advance,
  };
}
