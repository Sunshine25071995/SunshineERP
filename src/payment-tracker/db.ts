import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, writeBatch, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { Party, Bill, Payment, PaymentAllocation } from './types';
import { allocatePaymentFIFO, allocateAdvanceToNewBill } from './logic';

export const dbService = {
  // Parties
  async getParties() {
    const q = query(collection(db, 'parties'), orderBy('party_name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Party));
  },
  
  async addParty(party: Omit<Party, 'id' | 'created_at' | 'advance_balance'>) {
    const newRef = doc(collection(db, 'parties'));
    const newParty: Party = {
      ...party,
      id: newRef.id,
      advance_balance: party.opening_balance > 0 ? party.opening_balance : 0, // treating opening credit as advance, or handle as separate
      created_at: Date.now()
    };
    await setDoc(newRef, newParty);
    return newParty;
  },

  async updateParty(id: string, data: Partial<Party>) {
    const ref = doc(db, 'parties', id);
    await updateDoc(ref, data);
  },

  // Bills
  async getBills() {
    const q = query(collection(db, 'bills'), orderBy('bill_date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Bill));
  },

  async addBill(bill: Omit<Bill, 'id' | 'created_at' | 'paid_amount' | 'outstanding_amount' | 'status'>) {
    // If the party has an advance balance, we should auto-apply it. We need a transaction.
    const newRef = doc(collection(db, 'bills'));
    const billId = newRef.id;
    
    await runTransaction(db, async (transaction) => {
      const partyRef = doc(db, 'parties', bill.party_id);
      const partySnap = await transaction.get(partyRef);
      if (!partySnap.exists()) throw new Error("Party not found");
      const party = partySnap.data() as Party;

      const initialBill: Bill = {
        ...bill,
        id: billId,
        paid_amount: 0,
        outstanding_amount: bill.bill_amount,
        status: 'DUE',
        fully_paid_date: null,
        created_at: Date.now()
      };

      const { updatedBill, remainingAdvance } = allocateAdvanceToNewBill(initialBill, party.advance_balance || 0);

      transaction.set(newRef, updatedBill);
      transaction.update(partyRef, { advance_balance: remainingAdvance });
    });
  },

  // FIFO Payment Processing
    // FIFO Payment Processing
  async addPayment(paymentData: Omit<Payment, 'id' | 'created_at'>) {
    const newPaymentRef = doc(collection(db, 'payments'));
    const paymentId = newPaymentRef.id;
    
    // 1. Fetch all unpaid bills for this party BEFORE transaction
    const partyBillsQuery = query(collection(db, 'bills'), where('party_id', '==', paymentData.party_id));
    const partyBillsSnap = await getDocs(partyBillsQuery); 
    
    let bills = partyBillsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Bill))
      .filter(b => b.status !== 'PAID');
    
    // Perform allocation logic
    const { updatedBills, remainingAdvance } = allocatePaymentFIFO(
      paymentData.amount,
      bills,
      paymentData.payment_date
    );

    await runTransaction(db, async (transaction) => {

      // --- 1. PERFORM ALL READS ---
      // Read all bills involved
      const currentBillsData: Record<string, Bill> = {};
      for (const updatedBill of updatedBills) {
        const billRef = doc(db, 'bills', updatedBill.id);
        const billSnap = await transaction.get(billRef);
        currentBillsData[updatedBill.id] = billSnap.data() as Bill;
      }

      // Read party if we have remaining advance
      let currentPartyData: Party | null = null;
      const partyRef = doc(db, 'parties', paymentData.party_id);
      if (remainingAdvance > 0) {
        const partySnap = await transaction.get(partyRef);
        currentPartyData = partySnap.data() as Party;
      }

      // --- 2. PERFORM ALL WRITES ---
      for (const updatedBill of updatedBills) {
        const currentBill = currentBillsData[updatedBill.id];
        
        // Safety check if the bill was paid while we were allocating
        if (currentBill && currentBill.status === 'PAID') {
           throw new Error(`Bill ${updatedBill.bill_number} was modified concurrently.`);
        }
        
        const { _allocAmount, ...billDataToSave } = updatedBill;
        const billRef = doc(db, 'bills', updatedBill.id);
        
        transaction.update(billRef, {
          paid_amount: billDataToSave.paid_amount,
          outstanding_amount: billDataToSave.outstanding_amount,
          status: billDataToSave.status,
          fully_paid_date: billDataToSave.fully_paid_date
        });

        const allocRef = doc(collection(db, 'allocations'));
        transaction.set(allocRef, {
          id: allocRef.id,
          payment_id: paymentId,
          bill_id: updatedBill.id,
          allocated_amount: _allocAmount,
          allocation_date: paymentData.payment_date
        } as PaymentAllocation);
      }

      // If remaining payment, add to party advance
      if (remainingAdvance > 0 && currentPartyData) {
        transaction.update(partyRef, {
          advance_balance: (currentPartyData.advance_balance || 0) + remainingAdvance
        });
      }

      // Save payment record
      const payment: Payment = {
        ...paymentData,
        id: paymentId,
        created_at: Date.now()
      };
      transaction.set(newPaymentRef, payment);
    });
  },

  async getPayments() {
    const q = query(collection(db, 'payments'), orderBy('payment_date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment));
  },
  
    async getAllocations() {
    const q = query(collection(db, 'allocations'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PaymentAllocation));
  },

  async updateBillDetails(id: string, data: Partial<Bill>) {
    const ref = doc(db, 'bills', id);
    // Only allow updating safe fields without breaking allocations
    await updateDoc(ref, {
      ...(data.bill_number && { bill_number: data.bill_number }),
      ...(data.bill_date && { bill_date: data.bill_date }),
      ...(data.job_card_ids !== undefined && { job_card_ids: data.job_card_ids }),
      ...(data.notes !== undefined && { notes: data.notes })
    });
  },

  async updatePaymentDetails(id: string, data: Partial<Payment>) {
    const ref = doc(db, 'payments', id);
    await updateDoc(ref, {
      ...(data.payment_date && { payment_date: data.payment_date }),
      ...(data.payment_mode && { payment_mode: data.payment_mode }),
      ...(data.notes !== undefined && { notes: data.notes })
    });
  }
};
