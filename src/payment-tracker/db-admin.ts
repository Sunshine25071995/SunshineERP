import { doc, getDoc, collection, query, where, getDocs, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { Party, Bill, Payment, PaymentAllocation } from './types';

export const adminDbService = {
  async deleteParty(partyId: string) {
    // Basic delete party
    await deleteDoc(doc(db, 'parties', partyId));
  },
  async deletePayment(paymentId: string) {
    await runTransaction(db, async (transaction) => {
      // 1. READ ALL DATA FIRST
      const paymentRef = doc(db, 'payments', paymentId);
      const paymentSnap = await transaction.get(paymentRef);
      if (!paymentSnap.exists()) throw new Error("Payment not found");
      const payment = paymentSnap.data() as Payment;

      const allocQuery = query(collection(db, 'allocations'), where('payment_id', '==', paymentId));
      const allocSnap = await getDocs(allocQuery);
      
      const billSnaps = {};
      let totalAllocated = 0;

      for (const allocDoc of allocSnap.docs) {
        const alloc = allocDoc.data() as PaymentAllocation;
        totalAllocated += alloc.allocated_amount;
        
        const billRef = doc(db, 'bills', alloc.bill_id);
        const bSnap = await transaction.get(billRef);
        if (bSnap.exists()) {
          billSnaps[alloc.bill_id] = bSnap.data();
        }
      }

      const advanceUsed = payment.amount - totalAllocated;
      let partyData = null;
      const partyRef = doc(db, 'parties', payment.party_id);
      if (advanceUsed > 0) {
        const partySnap = await transaction.get(partyRef);
        if (partySnap.exists()) {
          partyData = partySnap.data() as Party;
        }
      }

      // 2. PERFORM ALL WRITES
      for (const allocDoc of allocSnap.docs) {
        const alloc = allocDoc.data() as PaymentAllocation;
        const bill = billSnaps[alloc.bill_id];
        
        if (bill) {
          const newPaid = Math.max(0, bill.paid_amount - alloc.allocated_amount);
          const newOutstanding = bill.bill_amount - newPaid;
          let newStatus = 'DUE';
          if (newPaid > 0 && newPaid < bill.bill_amount) newStatus = 'PARTIALLY PAID';
          else if (newPaid >= bill.bill_amount) newStatus = 'PAID';
          
          let newFullyPaidDate = bill.fully_paid_date;
          if (newStatus !== 'PAID') newFullyPaidDate = null;

          transaction.update(doc(db, 'bills', alloc.bill_id), {
            paid_amount: newPaid,
            outstanding_amount: newOutstanding,
            status: newStatus,
            fully_paid_date: newFullyPaidDate
          });
        }
        transaction.delete(doc(db, 'allocations', allocDoc.id));
      }

      if (partyData) {
        transaction.update(partyRef, {
          advance_balance: Math.max(0, (partyData.advance_balance || 0) - advanceUsed)
        });
      }

      transaction.delete(paymentRef);
    });
  },

  async deleteBill(billId: string) {
    await runTransaction(db, async (transaction) => {
      // 1. READ ALL DATA FIRST
      const billRef = doc(db, 'bills', billId);
      const billSnap = await transaction.get(billRef);
      if (!billSnap.exists()) throw new Error("Bill not found");
      const bill = billSnap.data() as Bill;

      const allocQuery = query(collection(db, 'allocations'), where('bill_id', '==', billId));
      const allocSnap = await getDocs(allocQuery);

      let returnedToAdvance = 0;
      for (const allocDoc of allocSnap.docs) {
        const alloc = allocDoc.data() as PaymentAllocation;
        returnedToAdvance += alloc.allocated_amount;
      }

      const totalFromAllocations = returnedToAdvance;
      const appliedFromAdvance = bill.paid_amount - totalFromAllocations;
      const totalRefund = returnedToAdvance + appliedFromAdvance;

      let partyData = null;
      const partyRef = doc(db, 'parties', bill.party_id);
      if (totalRefund > 0) {
        const partySnap = await transaction.get(partyRef);
        if (partySnap.exists()) {
          partyData = partySnap.data() as Party;
        }
      }

      // 2. PERFORM ALL WRITES
      for (const allocDoc of allocSnap.docs) {
        transaction.delete(doc(db, 'allocations', allocDoc.id));
      }

      if (partyData) {
        transaction.update(partyRef, {
          advance_balance: (partyData.advance_balance || 0) + totalRefund
        });
      }

      transaction.delete(billRef);
    });
  }
};
