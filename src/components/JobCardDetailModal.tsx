import React from 'react';
import { JobCard, ProductionRoll, SlittingRoll, ProductionWastage } from '../types';
import { formatWeight, calculateJobCardWastage } from '../utils/formatters';
import { X, Layers, Scissors, Flame, Scale, CheckCircle2, Trash2 } from 'lucide-react';

interface JobCardDetailModalProps {
  jobCard: JobCard;
  prodRolls: ProductionRoll[];
  slitRolls: SlittingRoll[];
  prodWastages: ProductionWastage[];
  onClose: () => void;
  onDelete?: (jobCard: JobCard) => void;
}

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'running':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'dispatched':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col text-slate-900 my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-xl border border-amber-200">
              {jobCard.jobCode}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${getStatusColor(
                jobCard.status
              )}`}
            >
              {jobCard.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => onDelete(jobCard)}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                title="Delete this Job Card"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Job Card</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <div className="text-slate-500 font-medium">Party Code</div>
              <div className="font-bold text-slate-900 text-sm">{jobCard.partyCode}</div>
            </div>
            <div>
              <div className="text-slate-500 font-medium">Size / Micron</div>
              <div className="font-bold text-slate-900 text-sm">
                {jobCard.size} ({jobCard.micron} μ)
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-medium">Coil Sizes</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {jobCard.coilSizes.map((c, i) => (
                  <span
                    key={i}
                    className="bg-amber-50 text-amber-900 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border border-amber-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-medium">Total Quantity</div>
              <div className="font-mono font-extrabold text-slate-900 text-sm">
                {formatWeight(jobCard.totalQuantity)} kg
              </div>
            </div>
          </div>

          {/* Wastage Summary Bar (0.000 format) */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600" />
              <span>Job Card Output & Wastage Breakdown</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                <div className="text-[11px] text-emerald-700 font-medium">Total Prod Output</div>
                <div className="font-mono font-extrabold text-emerald-800 text-base mt-1">
                  {formatWeight(wastageSummary.totalProdOutputWeight)}
                </div>
              </div>

              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                <div className="text-[11px] text-blue-700 font-medium">Total Slit Output</div>
                <div className="font-mono font-extrabold text-blue-800 text-base mt-1">
                  {formatWeight(wastageSummary.slittingOutputWeight)}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Production Wastage</div>
                <div className="font-mono font-bold text-amber-800 text-base mt-1">
                  {formatWeight(wastageSummary.productionWastage)}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Slitting Wastage</div>
                <div className="font-mono font-bold text-purple-800 text-base mt-1">
                  {formatWeight(wastageSummary.slittingWastage)}
                </div>
              </div>

              <div className="bg-amber-100/70 p-3 rounded-xl border border-amber-300 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-amber-900 font-bold">Final Wastage</div>
                <div className="font-mono font-black text-amber-950 text-lg mt-0.5">
                  {formatWeight(wastageSummary.finalWastage)}
                </div>
              </div>
            </div>
          </div>

          {/* Production Rolls Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Production Rolls ({jcProdRolls.length})</span>
            </h4>

            {jcProdRolls.length === 0 ? (
              <div className="bg-slate-50 p-4 text-center text-xs text-slate-500 rounded-xl border border-slate-200">
                No production rolls recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Roll No</th>
                      <th className="p-2">Shift</th>
                      <th className="p-2">Gross (kg)</th>
                      <th className="p-2">Core (kg)</th>
                      <th className="p-2">Net (kg)</th>
                      <th className="p-2">Joints</th>
                      <th className="p-2">Slitting Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {jcProdRolls.map((roll) => (
                      <tr key={roll.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {roll.date || 'N/A'}
                        </td>
                        <td className="p-2 font-mono font-bold text-emerald-700">{roll.rollNo}</td>
                        <td className="p-2 font-semibold">Shift {roll.shift}</td>
                        <td className="p-2 font-mono">{formatWeight(roll.grossWeight)}</td>
                        <td className="p-2 font-mono">{formatWeight(roll.coreWeight)}</td>
                        <td className="p-2 font-mono font-extrabold text-emerald-800">
                          {formatWeight(roll.netWeight)}
                        </td>
                        <td className="p-2 font-mono">{roll.joints}</td>
                        <td className="p-2">
                          {roll.takenBySlitting ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded border border-purple-200">
                              <CheckCircle2 className="w-3 h-3 text-purple-600" />
                              Taken
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic font-mono">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Slitting Rolls Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-blue-600" />
              <span>Slitting Output Rolls ({jcSlitRolls.length})</span>
            </h4>

            {jcSlitRolls.length === 0 ? (
              <div className="bg-slate-50 p-4 text-center text-xs text-slate-500 rounded-xl border border-slate-200">
                No slitting rolls recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Roll No</th>
                      <th className="p-2">Coil Size</th>
                      <th className="p-2">Shift</th>
                      <th className="p-2">Gross (kg)</th>
                      <th className="p-2">Core (kg)</th>
                      <th className="p-2">Net (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {jcSlitRolls.map((roll) => (
                      <tr key={roll.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {roll.date || 'N/A'}
                        </td>
                        <td className="p-2 font-mono font-bold text-blue-700">{roll.rollNo}</td>
                        <td className="p-2 font-mono text-amber-800 font-bold">{roll.coilSize}</td>
                        <td className="p-2 font-semibold">Shift {roll.shift}</td>
                        <td className="p-2 font-mono">{formatWeight(roll.grossWeight)}</td>
                        <td className="p-2 font-mono">{formatWeight(roll.coreWeight)}</td>
                        <td className="p-2 font-mono font-extrabold text-blue-800">
                          {formatWeight(roll.netWeight)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl border border-slate-300 transition-colors"
          >
            Close Detail View
          </button>
        </div>
      </div>
    </div>
  );
};
