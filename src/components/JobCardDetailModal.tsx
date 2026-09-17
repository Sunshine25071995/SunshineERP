import React from 'react';
import { JobCard, ProductionRoll, SlittingRoll, ProductionWastage } from '../types';
import { formatWeight, calculateJobCardWastage } from '../utils/formatters';
import { getPartyName } from '../utils/parties';
import { X, Layers, Scissors, Scale, Trash2 } from 'lucide-react';

const formatToDDMM = (dateStr: string) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
  return dateStr;
};

interface JobCardDetailModalProps {
  jobCard: JobCard;
  prodRolls: ProductionRoll[];
  slitRolls: SlittingRoll[];
  prodWastages: ProductionWastage[];
  onClose: () => void;
  onDelete?: (jobCard: JobCard) => void;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    running: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
    dispatched: 'bg-purple-100 text-purple-800 border-purple-200',
  };
  const emoji: Record<string, string> = { running: '🔥', pending: '⏳', completed: '✅', dispatched: '🚚' };
  const s = status?.toLowerCase() || 'pending';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${map[s] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      <span>{emoji[s] || ''}</span><span className="capitalize">{status}</span>
    </span>
  );
};

export const JobCardDetailModal: React.FC<JobCardDetailModalProps> = ({
  jobCard,
  prodRolls,
  slitRolls,
  prodWastages,
  onClose,
  onDelete,
}) => {
  const wastageSummary = calculateJobCardWastage(jobCard.id, prodRolls, slitRolls, prodWastages);
  const jcProdRolls = prodRolls.filter((r) => r.jobCardId === jobCard.id);
  const jcSlitRolls = slitRolls.filter((r) => r.jobCardId === jobCard.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Sheet */}
      <div className="relative bg-white w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <span className="font-mono text-3xl font-black text-amber-900 bg-amber-100 px-4 py-1.5 rounded-xl border border-amber-300 shadow-sm">
                {jobCard.jobCode}
              </span>
              <StatusBadge status={jobCard.status} />
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{getPartyName(jobCard.partyCode)}</span> · Size {jobCard.size} · {jobCard.micron}μ
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDelete && (
              <button
                onClick={() => onDelete(jobCard)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition-colors btn-press"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Party', value: getPartyName(jobCard.partyCode) },
              { label: 'Size / Micron', value: `${jobCard.size} (${jobCard.micron}μ)` },
              { label: 'Target Qty', value: `${formatWeight(jobCard.totalQuantity)} kg` },
              { label: 'Date', value: jobCard.date || '—' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Coil Sizes */}
          {jobCard.coilSizes && jobCard.coilSizes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Coil Sizes</p>
              <div className="flex flex-wrap gap-2">
                {jobCard.coilSizes.map((c, i) => (
                  <span key={i} className="font-mono text-xs font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Wastage Summary */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Output & Wastage
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Prod Output', value: formatWeight(wastageSummary.totalProdOutputWeight), color: 'emerald' },
                { label: 'Slit Output', value: formatWeight(wastageSummary.slittingOutputWeight), color: 'blue' },
                { label: 'Prod Wastage', value: formatWeight(wastageSummary.productionWastage), color: 'amber' },
                { label: 'Slit Wastage', value: formatWeight(wastageSummary.slittingWastage), color: 'purple' },
                { label: 'Final Wastage', value: formatWeight(wastageSummary.finalWastage), color: 'red', wide: true },
              ].map(item => (
                <div key={item.label} className={`bg-${item.color}-50 border border-${item.color}-200 rounded-xl p-3 text-center ${(item as any).wide ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <p className={`text-[10px] font-semibold text-${item.color}-600 uppercase`}>{item.label}</p>
                  <p className={`text-base font-black font-mono text-${item.color}-900 mt-0.5`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Production Rolls */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" /> Production Rolls ({jcProdRolls.length})
            </p>
            {jcProdRolls.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-400">
                No production rolls recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-400/60 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#FFD966] text-black font-black text-center">
                    <tr>
                      {['Date', 'Sr. No.', 'Gross Wt.', 'Core Wt.', 'Net Wt.', 'Joints', 'Slitting'].map(h => (
                        <th key={h} className="px-1.5 py-[3px] border border-gray-400/60 whitespace-nowrap text-xs sm:text-sm">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jcProdRolls.map((roll) => (
                      <tr key={roll.id} className="text-center">
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono text-xs sm:text-sm whitespace-nowrap">{formatToDDMM(roll.date)}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{roll.rollNo}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(roll.grossWeight)}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(roll.coreWeight)}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono text-xs sm:text-sm font-bold">{formatWeight(roll.netWeight)}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{roll.joints}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 text-xs sm:text-sm">
                          {roll.takenBySlitting ? 'Taken' : 'Pending'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#C6E0B4] text-black font-black text-center">
                      <td colSpan={2} className="px-1.5 py-[3px] border border-gray-400/60 text-xs sm:text-sm">TOTAL</td>
                      <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(jcProdRolls.reduce((sum, r) => sum + (r.grossWeight || 0), 0))}</td>
                      <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(jcProdRolls.reduce((sum, r) => sum + (r.coreWeight || 0), 0))}</td>
                      <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(jcProdRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0))}</td>
                      <td colSpan={2} className="px-1.5 py-[3px] border border-gray-400/60 text-xs sm:text-sm"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Slitting Rolls */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-blue-600" /> Slitting Output ({jcSlitRolls.length})
            </p>
            {jcSlitRolls.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-400">
                No slitting rolls recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-400/60 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#FFD966] text-black font-black text-center">
                    <tr>
                      {['Date', 'Sr. No.', 'Size', 'Meter', 'Micron', 'Gross Wt.', 'Core Wt.', 'Net Wt.'].map(h => (
                        <th key={h} className="px-1.5 py-[3px] border border-gray-400/60 whitespace-nowrap text-xs sm:text-sm">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jcSlitRolls.map((roll) => (
                      <tr key={roll.id} className="text-center">
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono text-xs sm:text-sm whitespace-nowrap">{formatToDDMM(roll.date)}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{roll.rollNo}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{roll.coilSize}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{roll.meter || '—'}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{jobCard.micron}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(roll.grossWeight)}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(roll.coreWeight)}</td>
                        <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono text-xs sm:text-sm font-bold">{formatWeight(roll.netWeight)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#C6E0B4] text-black font-black text-center">
                      <td colSpan={5} className="px-1.5 py-[3px] border border-gray-400/60 text-xs sm:text-sm">TOTAL</td>
                      <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(jcSlitRolls.reduce((sum, r) => sum + (r.grossWeight || 0), 0))}</td>
                      <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(jcSlitRolls.reduce((sum, r) => sum + (r.coreWeight || 0), 0))}</td>
                      <td className="px-1.5 py-[3px] border border-gray-400/60 font-mono font-semibold text-xs sm:text-sm">{formatWeight(jcSlitRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end shrink-0" style={{ paddingBottom: 'max(16px, var(--safe-bottom))' }}>
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-6 py-2.5 rounded-xl border border-gray-200 transition-colors btn-press"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
