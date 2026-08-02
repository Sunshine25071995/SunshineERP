export type Department = 'admin' | 'chemical' | 'production' | 'slitting';
export type Shift = 'A' | 'B' | null;
export type JobCardStatus = 'pending' | 'running' | 'completed' | 'dispatched';

export interface User {
  id: string; // doc id
  loginId: string;
  name: string;
  department: Department;
  shift: Shift;
  active: boolean;
}

export interface JobCard {
  id: string;
  jobCode: string;
  date: string; // ISO format or date string YYYY-MM-DD
  partyCode: string;
  size: string; // e.g. "500mm"
  micron: string; // e.g. "12"
  coilSizes: string[]; // e.g. ["230mm", "250mm"]
  totalQuantity: number; // in kg or meters
  status: JobCardStatus;
  createdBy: string; // user loginId
  createdAt?: any;
}

export interface Chemical {
  id: string;
  name: string;
  unit: string; // e.g. "kg", "liters"
}

export interface ChemicalPurchase {
  id: string;
  chemicalId: string;
  quantity: number;
  date: string;
  addedBy: string; // loginId
}

export interface ChemicalUsage {
  id: string;
  chemicalId: string;
  quantityUsed: number;
  date: string;
  usedBy: string; // loginId
}

export interface ProductionRoll {
  id: string;
  jobCardId: string;
  rollNo: number;
  shift: 'A' | 'B';
  date: string;
  grossWeight: number;
  coreWeight: number;
  netWeight: number; // grossWeight - coreWeight
  joints: number;
  takenBySlitting: boolean;
  createdBy: string; // loginId
}

export interface SlittingRoll {
  id: string;
  jobCardId: string;
  coilSize: string;
  rollNo: number;
  shift: 'A' | 'B';
  date: string;
  grossWeight: number;
  coreWeight: number;
  netWeight: number; // grossWeight - coreWeight
  productionRollId?: string; // linked production roll doc id or rollNo
  createdBy: string; // loginId
}

export interface ProductionWastage {
  id: string;
  jobCardId: string;
  shift: 'A' | 'B';
  date: string;
  wastageWeight: number;
  createdBy: string; // loginId
}

export interface JobCardWastageSummary {
  productionWastage: number;
  slittingWastage: number;
  finalWastage: number;
  takenProdWeight: number;
  slittingOutputWeight: number;
  totalProdOutputWeight: number;
}
