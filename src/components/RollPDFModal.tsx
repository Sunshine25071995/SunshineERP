import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { JobCard, ProductionRoll, SlittingRoll } from '../types';
import { formatWeight } from '../utils/formatters';
import { X, FileDown, Share2, Check } from 'lucide-react';
import { format } from 'date-fns';

interface RollPDFModalProps {
  jobCard: JobCard;
  prodRolls: ProductionRoll[];
  slitRolls: SlittingRoll[];
  onClose: () => void;
}

export const RollPDFModal: React.FC<RollPDFModalProps> = ({ jobCard, prodRolls, slitRolls, onClose }) => {
  const jcProdRolls = prodRolls.filter(r => r.jobCardId === jobCard.id);
  const jcSlitRolls = slitRolls.filter(r => r.jobCardId === jobCard.id);

  const [activeType, setActiveType] = useState<'production' | 'slitting'>('production');
  const [selectedProd, setSelectedProd] = useState<Set<string>>(new Set(jcProdRolls.map(r => r.id)));
  const [selectedSlit, setSelectedSlit] = useState<Set<string>>(new Set(jcSlitRolls.map(r => r.id)));

  const toggleProd = (id: string) => {
    const next = new Set(selectedProd);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedProd(next);
  };

  const toggleSlit = (id: string) => {
    const next = new Set(selectedSlit);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSlit(next);
  };

  const selectAllProd = () => setSelectedProd(new Set(jcProdRolls.map(r => r.id)));
  const selectNoneProd = () => setSelectedProd(new Set());
  const selectAllSlit = () => setSelectedSlit(new Set(jcSlitRolls.map(r => r.id)));
  const selectNoneSlit = () => setSelectedSlit(new Set());

  const buildProdPDF = () => {
    const filtered = jcProdRolls.filter(r => selectedProd.has(r.id));
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('SUNSHINE POLYFILM INDUSTRIES', pageW / 2, 9, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Production Roll Report', pageW / 2, 15, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, 20, { align: 'center' });

    // Job card info bar
    doc.setTextColor(30, 41, 59);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, 28, pageW - margin * 2, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Job Code: ${jobCard.jobCode}`, margin + 4, 35);
    doc.text(`Party: ${jobCard.partyCode}`, margin + 60, 35);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Size: ${jobCard.size}  |  Micron: ${jobCard.micron} Mic  |  Target: ${formatWeight(jobCard.totalQuantity)} kg`, margin + 4, 41);

    const totalGross = filtered.reduce((s, r) => s + (r.grossWeight || 0), 0);
    const totalCore = filtered.reduce((s, r) => s + (r.coreWeight || 0), 0);
    const totalNet = filtered.reduce((s, r) => s + (r.netWeight || 0), 0);

    autoTable(doc, {
      startY: 50,
      margin: { left: margin, right: margin },
      head: [['Sr. No.', 'Size', 'Micron', 'Gross Wt. (kg)', 'Core Wt. (kg)', 'Net Wt. (kg)']],
      body: filtered.map(r => [
        String(r.rollNo),
        jobCard.size || '',
        `${jobCard.micron || ''} Mic`,
        formatWeight(r.grossWeight),
        formatWeight(r.coreWeight),
        formatWeight(r.netWeight),
      ]),
      foot: [[
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatWeight(totalGross), styles: { fontStyle: 'bold' } },
        { content: formatWeight(totalCore), styles: { fontStyle: 'bold' } },
        { content: formatWeight(totalNet), styles: { fontStyle: 'bold', textColor: [5, 150, 105] } },
      ]],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.5, font: 'helvetica', textColor: 0, lineColor: 200, lineWidth: 0.1 },
      headStyles: { fillColor: [255, 217, 102], textColor: 0, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });

    return doc;
  };

  const buildSlitPDF = () => {
    const filtered = jcSlitRolls.filter(r => selectedSlit.has(r.id));
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('SUNSHINE POLYFILM INDUSTRIES', pageW / 2, 9, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Slitting Output Report', pageW / 2, 15, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, 20, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, 28, pageW - margin * 2, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Job Code: ${jobCard.jobCode}`, margin + 4, 35);
    doc.text(`Party: ${jobCard.partyCode}`, margin + 60, 35);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Size: ${jobCard.size}  |  Micron: ${jobCard.micron} Mic  |  Target: ${formatWeight(jobCard.totalQuantity)} kg`, margin + 4, 41);

    const totalGross = filtered.reduce((s, r) => s + (r.grossWeight || 0), 0);
    const totalCore = filtered.reduce((s, r) => s + (r.coreWeight || 0), 0);
    const totalNet = filtered.reduce((s, r) => s + (r.netWeight || 0), 0);

    autoTable(doc, {
      startY: 50,
      margin: { left: margin, right: margin },
      head: [['Sr. No.', 'Coil Size', 'Micron', 'Gross Wt. (kg)', 'Core Wt. (kg)', 'Net Wt. (kg)']],
      body: filtered.map(r => [
        String(r.rollNo),
        r.coilSize || '',
        `${jobCard.micron || ''} Mic`,
        formatWeight(r.grossWeight),
        formatWeight(r.coreWeight),
        formatWeight(r.netWeight),
      ]),
      foot: [[
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatWeight(totalGross), styles: { fontStyle: 'bold' } },
        { content: formatWeight(totalCore), styles: { fontStyle: 'bold' } },
        { content: formatWeight(totalNet), styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
      ]],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.5, font: 'helvetica', textColor: 0, lineColor: 200, lineWidth: 0.1 },
      headStyles: { fillColor: [255, 217, 102], textColor: 0, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });

    return doc;
  };

  const handleDownload = () => {
    const doc = activeType === 'production' ? buildProdPDF() : buildSlitPDF();
    const filename = activeType === 'production'
      ? `${jobCard.jobCode}-production-rolls.pdf`
      : `${jobCard.jobCode}-slitting-rolls.pdf`;
    doc.save(filename);
  };

  const handleWhatsApp = async () => {
    const doc = activeType === 'production' ? buildProdPDF() : buildSlitPDF();
    const filtered = activeType === 'production'
      ? jcProdRolls.filter(r => selectedProd.has(r.id))
      : jcSlitRolls.filter(r => selectedSlit.has(r.id));

    const totalNet = filtered.reduce((s, r) => s + (r.netWeight || 0), 0);
    const label = activeType === 'production' ? 'Production Roll' : 'Slitting Output';

    const groups: Record<string, { weight: number; count: number }> = {};
    
    filtered.forEach(r => {
      const size = activeType === 'slitting' ? (r as SlittingRoll).coilSize || jobCard.size : jobCard.size;
      const key = `${size} x ${jobCard.micron} Mic`;
      if (!groups[key]) groups[key] = { weight: 0, count: 0 };
      groups[key].weight += (r.netWeight || 0);
      groups[key].count += 1;
    });

    let msg = `📄 *${label.toUpperCase()} SUMMARY*\n`;
    msg += `🏷️ *Job Code:* ${jobCard.jobCode}\n`;
    msg += `👤 *Party:* ${jobCard.partyCode}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    Object.entries(groups).forEach(([key, data]) => {
      msg += `📐 *${key}*\n`;
      msg += `⚖️ *${formatWeight(data.weight)} Kg*\n`;
      msg += `📦 *${data.count} Rolls*\n`;
      msg += `----------------------------\n`;
    });
    
    msg += `\n🌟 *TOTAL OVERALL*\n`;
    msg += `📦 *${filtered.length} Rolls*\n`;
    msg += `⚖️ *${formatWeight(totalNet)} Kg*\n`;
    msg += `\n_Generated via Sunshine ERP_`;

    // Try file share on mobile
    const blob = doc.output('blob');
    const filename = activeType === 'production'
      ? `${jobCard.jobCode}-production-rolls.pdf`
      : `${jobCard.jobCode}-slitting-rolls.pdf`;
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename, text: msg });
        return;
      } catch { /* fall through to WhatsApp text */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const currentRolls = activeType === 'production' ? jcProdRolls : jcSlitRolls;
  const currentSelected = activeType === 'production' ? selectedProd : selectedSlit;
  const toggleFn = activeType === 'production' ? toggleProd : toggleSlit;
  const selectAll = activeType === 'production' ? selectAllProd : selectAllSlit;
  const selectNone = activeType === 'production' ? selectNoneProd : selectNoneSlit;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">Download Rolls PDF</h2>
            <p className="text-xs text-gray-400 mt-0.5">Job: <span className="font-bold text-gray-600">{jobCard.jobCode}</span> · {jobCard.partyCode}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="px-5 pt-4 shrink-0">
          <div className="bg-gray-100 p-1 rounded-2xl flex gap-1">
            <button onClick={() => setActiveType('production')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeType === 'production' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}>
              🟢 Production ({jcProdRolls.length})
            </button>
            <button onClick={() => setActiveType('slitting')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeType === 'slitting' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}>
              ✂️ Slitting ({jcSlitRolls.length})
            </button>
          </div>
        </div>

        {/* Select Controls */}
        <div className="px-5 pt-3 pb-1 flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-gray-500">{currentSelected.size} of {currentRolls.length} selected</span>
          <button onClick={selectAll} className="text-xs font-bold text-blue-600 hover:underline">Select All</button>
          <button onClick={selectNone} className="text-xs font-bold text-gray-400 hover:underline">None</button>
        </div>

        {/* Roll List */}
        <div className="overflow-y-auto flex-1 px-5 pb-3">
          {currentRolls.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No rolls for this job card.</div>
          ) : (
            <div className="space-y-2">
              {currentRolls.map(roll => {
                const isSelected = currentSelected.has(roll.id);
                const sr = roll as SlittingRoll;
                return (
                  <div key={roll.id} onClick={() => toggleFn(roll.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-all ${
                      isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-gray-900">#{roll.rollNo}</span>
                        {activeType === 'slitting' && sr.coilSize && (
                          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{sr.coilSize}</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                        <span>Gross: <span className="font-mono font-bold text-gray-700">{formatWeight(roll.grossWeight)}</span></span>
                        <span>Core: <span className="font-mono font-bold text-gray-700">{formatWeight(roll.coreWeight)}</span></span>
                        <span>Net: <span className="font-mono font-black text-emerald-700">{formatWeight(roll.netWeight)}</span></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Total Bar */}
        {currentSelected.size > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
            {(() => {
              const filteredRolls = currentRolls.filter(r => currentSelected.has(r.id));
              const tGross = filteredRolls.reduce((s, r) => s + (r.grossWeight || 0), 0);
              const tCore = filteredRolls.reduce((s, r) => s + (r.coreWeight || 0), 0);
              const tNet = filteredRolls.reduce((s, r) => s + (r.netWeight || 0), 0);
              return (
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-bold text-gray-500 uppercase tracking-wide">Total ({filteredRolls.length} rolls)</span>
                  <span className="text-gray-600">Gross: <span className="font-mono font-bold">{formatWeight(tGross)}</span></span>
                  <span className="text-gray-600">Core: <span className="font-mono font-bold">{formatWeight(tCore)}</span></span>
                  <span className="text-emerald-700 font-bold">Net: <span className="font-mono font-black">{formatWeight(tNet)}</span></span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={handleWhatsApp} disabled={currentSelected.size === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm btn-press shadow-sm transition-colors">
            <Share2 className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={handleDownload} disabled={currentSelected.size === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm btn-press shadow-sm transition-colors">
            <FileDown className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};
