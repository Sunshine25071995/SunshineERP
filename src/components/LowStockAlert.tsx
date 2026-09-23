import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Chemical, ChemicalPurchase, ChemicalUsage } from '../types';

interface LowStockAlertProps {
  chemicals: Chemical[];
  purchases: ChemicalPurchase[];
  usages: ChemicalUsage[];
}

export function LowStockAlert({ chemicals, purchases, usages }: LowStockAlertProps) {
  const lowStockChemicals = chemicals.map(c => {
    const totalPurchased = purchases.filter(p => p.chemicalId === c.id).reduce((s, p) => s + (p.quantity || 0), 0);
    const totalUsed = usages.filter(u => u.chemicalId === c.id).reduce((s, u) => s + (u.quantityUsed || 0), 0);
    const stock = totalPurchased - totalUsed;
    return { ...c, stock };
  }).filter(c => c.stock < 10);

  if (lowStockChemicals.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-[28px] p-5 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-6 h-6 text-amber-600" />
        <h3 className="text-lg font-bold text-amber-900">Low Stock Alert</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {lowStockChemicals.map(chem => (
          <div key={chem.id} className="bg-white/60 rounded-xl p-3 flex items-center justify-between">
            <span className="font-semibold text-amber-900">{chem.name}</span>
            <span className="font-bold font-mono text-amber-700">
              {chem.stock.toFixed(2)} {chem.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
