export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: number;
}

export interface Party {
  id: string;
  party_name: string;
  mobile: string;
  email: string;
  address: string;
  gst_number: string;
  opening_balance: number;
  advance_balance: number;
  created_at: number;
}

export interface Bill {
  id: string;
  bill_number: string;
  party_id: string;
  bill_date: number;
  bill_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: 'PAID' | 'PARTIALLY PAID' | 'DUE' | 'OVERDUE';
  fully_paid_date?: number | null;
  notes: string;
  job_card_ids?: string[];
  created_by: string;
  created_at: number;
}

export interface Payment {
  id: string;
  party_id: string;
  payment_date: number;
  amount: number;
  payment_mode: string;
  reference_number: string;
  notes: string;
  job_card_ids?: string[];
  created_by: string;
  created_at: number;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  bill_id: string;
  allocated_amount: number;
  allocation_date: number;
}
