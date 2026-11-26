import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from 'jspdf';
import { JobCard, SlittingRoll } from '../types';
import { useBackButton } from '../utils/useBackButton';
import { X, Printer, FileDown, ChevronLeft, ChevronRight, Settings2, Tag, Check } from 'lucide-react';

interface LabelPrintModalProps {
  jobCard: JobCard;
  slitRolls: SlittingRoll[];
  onClose: () => void;
}

export interface LabelData {
  rollId: string;
  rollNo: number;
  rollNoText: string;
  partyCode: string;
  dateStr: string;
  size: string;
  meter: string;
  micron: string;
  grossWeight: string;
  coreWeight: string;
  netWeight: string;
}

const DEFAULT_WIDTH_MM = 100;
const DEFAULT_HEIGHT_MM = 65;
const STORAGE_KEY_SIZE = 'sunshine_label_dimensions_v2';

function formatDDMMYYYY(dateStr?: string): string {
  if (!dateStr) {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }
  const parts = dateStr.trim().split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function cleanSizeValue(raw: string): string {
  return raw.replace(/\s*mm$/i, '').trim() || raw.trim() || '—';
}

function cleanMicronValue(raw?: string): string {
  if (!raw) return '—';
  return raw.replace(/\s*(mic(ron)?|μ)$/i, '').trim() || raw.trim();
}

function computeMeterValue(roll: SlittingRoll, cleanSize: string, cleanMicron: string): string {
  if (roll.meter && Number(roll.meter) > 0) {
    return String(Math.round(Number(roll.meter)));
  }
  const net = Number(roll.netWeight || 0);
  const mic = parseFloat(cleanMicron) || 0;
  const sz = parseFloat(cleanSize) || 0;
  if (net > 0 && mic > 0 && sz > 0) {
    return String(Math.round((net / mic / 0.00139 / sz) * 1000));
  }
  return '0';
}

export function buildLabelData(roll: SlittingRoll, jobCard: JobCard, partyCodeOverride?: string): LabelData {
  const size = cleanSizeValue(roll.coilSize || jobCard.size || '');
  const micron = cleanMicronValue(jobCard.micron);
  const rawParty = (partyCodeOverride !== undefined ? partyCodeOverride : jobCard.partyCode || '').trim();
  const partyCode = rawParty
    ? (/^\d+$/.test(rawParty) ? rawParty.padStart(3, '0') : rawParty)
    : '---';

  return {
    rollId: roll.id,
    rollNo: Number(roll.rollNo) || 0,
    rollNoText: String(roll.rollNo ?? ''),
    partyCode,
    dateStr: formatDDMMYYYY(roll.date),
    size,
    meter: computeMeterValue(roll, size, micron),
    micron,
    grossWeight: Number(roll.grossWeight || 0).toFixed(3),
    coreWeight: Number(roll.coreWeight || 0).toFixed(3),
    netWeight: Number(roll.netWeight || 0).toFixed(3),
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getHeaderFontPt(text: string, basePt: number): number {
  if (text.length <= 3) return basePt;
  if (text.length === 4) return basePt * 0.78;
  if (text.length <= 6) return basePt * 0.62;
  return basePt * 0.48;
}

function printLabelsDirect(labels: LabelData[], jobCode: string, widthMm: number, heightMm: number) {
  const existingFrame = document.getElementById('sunshine-label-print-frame');
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'sunshine-label-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) return;

  const padX = Math.max(2, +(widthMm * 0.038).toFixed(2));
  const padY = Math.max(2, +(heightMm * 0.038).toFixed(2));
  const boxW = +(widthMm - padX * 2).toFixed(2);
  const boxH = +(heightMm - padY * 2).toFixed(2);
  const topH = +(boxH * 0.275).toFixed(2);
  const rowH = +((boxH - topH) / 7).toFixed(2);
  const baseHeaderPt = Math.max(20, Math.round(heightMm * 0.56));
  const rowFontPt = Math.max(8.5, +(heightMm * 0.175).toFixed(1));

  const pagesHtml = labels.map((lbl) => {
    const rollPt = getHeaderFontPt(lbl.rollNoText, baseHeaderPt);
    const partyPt = getHeaderFontPt(lbl.partyCode, baseHeaderPt);
    const specRows = [
      ['DATE', lbl.dateStr],
      ['SIZE', lbl.size],
      ['METER', lbl.meter],
      ['MICRON', lbl.micron],
      ['GROSS WT', lbl.grossWeight],
      ['CORE WT', lbl.coreWeight],
      ['NET WT', lbl.netWeight],
    ];

    return `
      <div class="label-page">
        <table class="label-table" cellspacing="0" cellpadding="0">
          <tbody>
            <tr class="header-row">
              <td class="header-left" style="font-size:${rollPt}pt;">${escapeHtml(lbl.rollNoText)}</td>
              <td class="header-right" style="font-size:${partyPt}pt;">${escapeHtml(lbl.partyCode)}</td>
            </tr>
            ${specRows.map(([k, v], idx) => `
              <tr class="data-row ${idx === specRows.length - 1 ? 'last-row' : ''}">
                <td class="cell-key" style="font-size:${rowFontPt}pt;">${escapeHtml(k)}</td>
                <td class="cell-val" style="font-size:${rowFontPt}pt;">${escapeHtml(v)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Labels - ${escapeHtml(jobCode)}</title>
  <style>
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${widthMm}mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: Calibri, 'Segoe UI', Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-page {
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      padding: ${padY}mm ${padX}mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .label-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .label-table {
      width: ${boxW}mm;
      height: ${boxH}mm;
      border-collapse: collapse;
      table-layout: fixed;
      border: 2.2pt solid #000000;
    }
    .header-row {
      height: ${topH}mm;
    }
    .header-left, .header-right {
      width: 50%;
      height: ${topH}mm;
      text-align: center;
      vertical-align: middle;
      font-weight: 800;
      line-height: 1;
      border-bottom: 2.2pt solid #000000;
      color: #000000;
    }
    .header-left {
      border-right: 1.5pt solid #000000;
    }
    .data-row {
      height: ${rowH}mm;
    }
    .cell-key {
      width: 50%;
      text-align: left;
      vertical-align: middle;
      padding-left: 5mm;
      font-weight: 700;
      border-right: 1.5pt solid #000000;
      border-bottom: 1.1pt solid #000000;
      color: #000000;
      letter-spacing: 0.2pt;
    }
    .cell-val {
      width: 50%;
      text-align: center;
      vertical-align: middle;
      font-weight: 700;
      border-bottom: 1.1pt solid #000000;
      color: #000000;
    }
    .last-row .cell-key,
    .last-row .cell-val {
      border-bottom: none;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`);
  iframeDoc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 180);
}

function downloadLabelsPdf(labels: LabelData[], jobCode: string, widthMm: number, heightMm: number) {
  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: [widthMm, heightMm] });

  const padX = Math.max(2, widthMm * 0.038);
  const padY = Math.max(2, heightMm * 0.038);
  const x0 = padX;
  const y0 = padY;
  const boxW = widthMm - padX * 2;
  const boxH = heightMm - padY * 2;
  const topH = boxH * 0.275;
  const rowsH = boxH - topH;
  const rowH = rowsH / 7;
  const midX = x0 + boxW * 0.5;
  const keyX = x0 + Math.max(3.5, boxW * 0.055);
  const valX = x0 + boxW * 0.75;
  const leftCenterX = x0 + boxW * 0.25;
  const baseHeaderPt = Math.max(20, topH * 2.15);
  const rowFontPt = Math.max(8.5, Math.min(12.5, rowH * 1.8));

  labels.forEach((lbl, idx) => {
    if (idx > 0) doc.addPage([widthMm, heightMm], orientation);

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    // Outer thick border
    doc.setLineWidth(0.75);
    doc.rect(x0, y0, boxW, boxH);

    // Header bottom thick divider
    doc.line(x0, y0 + topH, x0 + boxW, y0 + topH);

    // Vertical center divider (top to bottom)
    doc.setLineWidth(0.5);
    doc.line(midX, y0, midX, y0 + boxH);

    // Horizontal dividers for 7 data rows
    doc.setLineWidth(0.35);
    for (let r = 1; r < 7; r++) {
      const yLine = y0 + topH + r * rowH;
      doc.line(x0, yLine, x0 + boxW, yLine);
    }

    // Top Header Text (Roll No. & Party Code)
    doc.setFont('helvetica', 'bold');
    const topMidY = y0 + topH / 2 + 0.5;
    doc.setFontSize(getHeaderFontPt(lbl.rollNoText, baseHeaderPt));
    doc.text(lbl.rollNoText, leftCenterX, topMidY, { align: 'center', baseline: 'middle' });

    doc.setFontSize(getHeaderFontPt(lbl.partyCode, baseHeaderPt));
    doc.text(lbl.partyCode, valX, topMidY, { align: 'center', baseline: 'middle' });

    // 7 Data Rows
    const specRows: [string, string][] = [
      ['DATE', lbl.dateStr],
      ['SIZE', lbl.size],
      ['METER', lbl.meter],
      ['MICRON', lbl.micron],
      ['GROSS WT', lbl.grossWeight],
      ['CORE WT', lbl.coreWeight],
      ['NET WT', lbl.netWeight],
    ];

    doc.setFontSize(rowFontPt);
    specRows.forEach(([k, v], rIdx) => {
      const cy = y0 + topH + (rIdx + 0.5) * rowH + 0.2;
      doc.text(k, keyX, cy, { align: 'left', baseline: 'middle' });
      doc.text(v, valX, cy, { align: 'center', baseline: 'middle' });
    });
  });

  const firstNo = labels[0]?.rollNoText || '1';
  const lastNo = labels[labels.length - 1]?.rollNoText || firstNo;
  doc.save(`${jobCode}-labels-${firstNo}-to-${lastNo}.pdf`);
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ jobCard, slitRolls, onClose }) => {
  useBackButton(true, onClose);

  const sortedRolls = useMemo(
    () =>
      slitRolls
        .filter((r) => r.jobCardId === jobCard.id)
        .sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0)),
    [slitRolls, jobCard.id]
  );

  const uniqueCoilSizes = useMemo(() => {
    const set = new Set<string>();
    sortedRolls.forEach((r) => {
      if (r.coilSize) set.add(r.coilSize);
    });
    return Array.from(set);
  }, [sortedRolls]);

  const [coilFilter, setCoilFilter] = useState<string>('ALL');

  const filteredByCoil = useMemo(() => {
    if (coilFilter === 'ALL') return sortedRolls;
    return sortedRolls.filter((r) => r.coilSize === coilFilter);
  }, [sortedRolls, coilFilter]);

  const minRollNo = filteredByCoil.length > 0 ? Number(filteredByCoil[0].rollNo) || 1 : 1;
  const maxRollNo = filteredByCoil.length > 0 ? Number(filteredByCoil[filteredByCoil.length - 1].rollNo) || 1 : 1;

  const [startRollInput, setStartRollInput] = useState<string>(String(minRollNo));
  const [endRollInput, setEndRollInput] = useState<string>(String(maxRollNo));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(filteredByCoil.map((r) => r.id)));
  const [previewIdx, setPreviewIdx] = useState(0);

  // Label dimensions (defaults to TSC TE244 exact Excel size: 102.5 x 67.0 mm)
  const [showSizeSettings, setShowSizeSettings] = useState(false);
  const [labelWidthMm, setLabelWidthMm] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_SIZE) || '{}');
      return Number(saved.width) > 20 ? Number(saved.width) : DEFAULT_WIDTH_MM;
    } catch {
      return DEFAULT_WIDTH_MM;
    }
  });
  const [labelHeightMm, setLabelHeightMm] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_SIZE) || '{}');
      return Number(saved.height) > 20 ? Number(saved.height) : DEFAULT_HEIGHT_MM;
    } catch {
      return DEFAULT_HEIGHT_MM;
    }
  });
  const [partyCodeOverride, setPartyCodeOverride] = useState<string>(
    jobCard.partyCode ? String(jobCard.partyCode).trim().padStart(3, '0') : ''
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify({ width: labelWidthMm, height: labelHeightMm }));
    } catch { /* ignore storage errors */ }
  }, [labelWidthMm, labelHeightMm]);

  // Helper to apply start-end range selection whenever range inputs or coil filter change
  const applyRange = (startStr: string, endStr: string, pool: SlittingRoll[]) => {
    const s = parseInt(startStr, 10);
    const e = parseInt(endStr, 10);
    if (isNaN(s) || isNaN(e)) {
      setSelectedIds(new Set());
      return;
    }
    const low = Math.min(s, e);
    const high = Math.max(s, e);
    setSelectedIds(new Set(pool.filter((r) => {
      const n = Number(r.rollNo) || 0;
      return n >= low && n <= high;
    }).map((r) => r.id)));
    setPreviewIdx(0);
  };

  const handleCoilFilterChange = (nextCoil: string) => {
    setCoilFilter(nextCoil);
    const pool = nextCoil === 'ALL' ? sortedRolls : sortedRolls.filter((r) => r.coilSize === nextCoil);
    if (pool.length === 0) {
      setStartRollInput('');
      setEndRollInput('');
      setSelectedIds(new Set());
      return;
    }
    const lo = String(Number(pool[0].rollNo) || 1);
    const hi = String(Number(pool[pool.length - 1].rollNo) || 1);
    setStartRollInput(lo);
    setEndRollInput(hi);
    setSelectedIds(new Set(pool.map((r) => r.id)));
    setPreviewIdx(0);
  };

  const handleStartChange = (val: string) => {
    setStartRollInput(val);
    applyRange(val, endRollInput, filteredByCoil);
  };

  const handleEndChange = (val: string) => {
    setEndRollInput(val);
    applyRange(startRollInput, val, filteredByCoil);
  };

  const selectAll = () => {
    setStartRollInput(String(minRollNo));
    setEndRollInput(String(maxRollNo));
    setSelectedIds(new Set(filteredByCoil.map((r) => r.id)));
    setPreviewIdx(0);
  };

  const selectLastOne = () => {
    if (filteredByCoil.length === 0) return;
    const last = filteredByCoil[filteredByCoil.length - 1];
    const n = String(last.rollNo);
    setStartRollInput(n);
    setEndRollInput(n);
    setSelectedIds(new Set([last.id]));
    setPreviewIdx(0);
  };

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const todayRolls = useMemo(
    () => filteredByCoil.filter((r) => r.date === todayStr),
    [filteredByCoil, todayStr]
  );

  const selectToday = () => {
    if (todayRolls.length === 0) return;
    setStartRollInput(String(todayRolls[0].rollNo));
    setEndRollInput(String(todayRolls[todayRolls.length - 1].rollNo));
    setSelectedIds(new Set(todayRolls.map((r) => r.id)));
    setPreviewIdx(0);
  };

  const toggleSingleRoll = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    setPreviewIdx(0);
  };

  const selectedLabels = useMemo(
    () =>
      filteredByCoil
        .filter((r) => selectedIds.has(r.id))
        .map((r) => buildLabelData(r, jobCard, partyCodeOverride)),
    [filteredByCoil, selectedIds, jobCard, partyCodeOverride]
  );

  const safePreviewIdx = Math.min(previewIdx, Math.max(0, selectedLabels.length - 1));
  const activePreview = selectedLabels[safePreviewIdx] || null;

  const handlePrint = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (selectedLabels.length === 0) return;
    printLabelsDirect(selectedLabels, jobCard.jobCode, labelWidthMm, labelHeightMm);
  };

  const handleDownloadPdf = () => {
    if (selectedLabels.length === 0) return;
    downloadLabelsPdf(selectedLabels, jobCard.jobCode, labelWidthMm, labelHeightMm);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-gray-900/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-2xl shadow-2xl animate-slide-up z-50 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-0">
        {/* Mobile Drag Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-black text-gray-900">Print Slitting Roll Labels</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Job: <span className="font-mono font-bold text-gray-800">{jobCard.jobCode}</span> · Total {sortedRolls.length} rolls
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSizeSettings((s) => !s)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition-colors ${
                showSizeSettings
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
              title="Sticker Size & Party Code Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{labelWidthMm}×{labelHeightMm}mm</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sortedRolls.length === 0 ? (
            <div className="py-12 text-center">
              <Printer className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No Slitting Rolls Recorded Yet</p>
              <p className="text-xs text-gray-400 mt-1">Slitting output rolls will appear here once added.</p>
            </div>
          ) : (
            <>
              {/* Collapsible Sticker Dimension / Override Bar */}
              {showSizeSettings && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Label Setup (TSC TE244)</span>
                    <button
                      type="button"
                      onClick={() => { setLabelWidthMm(DEFAULT_WIDTH_MM); setLabelHeightMm(DEFAULT_HEIGHT_MM); }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Reset (100 × 65 mm)
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Width (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={labelWidthMm}
                        onChange={(e) => setLabelWidthMm(Math.max(30, parseFloat(e.target.value) || DEFAULT_WIDTH_MM))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Height (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={labelHeightMm}
                        onChange={(e) => setLabelHeightMm(Math.max(20, parseFloat(e.target.value) || DEFAULT_HEIGHT_MM))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Party Code</label>
                      <input
                        type="text"
                        value={partyCodeOverride}
                        onChange={(e) => setPartyCodeOverride(e.target.value)}
                        placeholder="009"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-center"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Coil Size Filter (shown if multiple sizes exist) */}
              {uniqueCoilSizes.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-400 uppercase mr-1">Coil:</span>
                  <button
                    type="button"
                    onClick={() => handleCoilFilterChange('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      coilFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    All ({sortedRolls.length})
                  </button>
                  {uniqueCoilSizes.map((cs) => (
                    <button
                      key={cs}
                      type="button"
                      onClick={() => handleCoilFilterChange(cs)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        coilFilter === cs ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {cs}
                    </button>
                  ))}
                </div>
              )}

              {/* Range Inputs — mirrors Excel StartRow -> EndRow */}
              <form onSubmit={handlePrint} className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                    Roll Number Range (Sr. No.)
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={selectAll} className="text-[11px] font-bold text-indigo-700 hover:underline">
                      All ({filteredByCoil.length})
                    </button>
                    {todayRolls.length > 0 && (
                      <button type="button" onClick={selectToday} className="text-[11px] font-bold text-emerald-700 hover:underline">
                        Today ({todayRolls.length})
                      </button>
                    )}
                    <button type="button" onClick={selectLastOne} className="text-[11px] font-bold text-amber-700 hover:underline">
                      Last
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">
                      Start Roll No.
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={startRollInput}
                      onChange={(e) => handleStartChange(e.target.value)}
                      placeholder={String(minRollNo)}
                      className="w-full bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-lg font-mono font-black text-center text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">
                      End Roll No.
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={endRollInput}
                      onChange={(e) => handleEndChange(e.target.value)}
                      placeholder={String(maxRollNo)}
                      className="w-full bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-lg font-mono font-black text-center text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick clickable chips for individual roll fine-tuning */}
                <div className="max-h-24 overflow-y-auto pt-1 flex flex-wrap gap-1.5">
                  {filteredByCoil.map((r) => {
                    const checked = selectedIds.has(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleSingleRoll(r.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                          checked
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                        <span>#{r.rollNo}</span>
                      </button>
                    );
                  })}
                </div>
              </form>

              {/* Live Sticker Preview matching Sheet3 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Label Preview ({selectedLabels.length} {selectedLabels.length === 1 ? 'label' : 'labels'})
                  </span>
                  {selectedLabels.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewIdx((i) => (i > 0 ? i - 1 : selectedLabels.length - 1))}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-gray-700">
                        {safePreviewIdx + 1} / {selectedLabels.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewIdx((i) => (i < selectedLabels.length - 1 ? i + 1 : 0))}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {activePreview ? (
                  <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 flex justify-center">
                    <div
                      className="bg-white shadow-md w-full max-w-[360px] p-2.5"
                      style={{ aspectRatio: `${labelWidthMm} / ${labelHeightMm}` }}
                    >
                      <table className="w-full h-full border-collapse table-fixed border-[2.5px] border-black text-black">
                        <tbody>
                          <tr className="h-[27.5%]">
                            <td className={`w-1/2 border-r-[2px] border-b-[2.5px] border-black text-center align-middle font-black leading-none ${activePreview.rollNoText.length > 3 ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl'}`}>
                              {activePreview.rollNoText}
                            </td>
                            <td className={`w-1/2 border-b-[2.5px] border-black text-center align-middle font-black leading-none ${activePreview.partyCode.length > 3 ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl'}`}>
                              {activePreview.partyCode}
                            </td>
                          </tr>
                          {[
                            ['DATE', activePreview.dateStr],
                            ['SIZE', activePreview.size],
                            ['METER', activePreview.meter],
                            ['MICRON', activePreview.micron],
                            ['GROSS WT', activePreview.grossWeight],
                            ['CORE WT', activePreview.coreWeight],
                            ['NET WT', activePreview.netWeight],
                          ].map(([k, v], i, arr) => (
                            <tr key={k} className="h-[10.35%]">
                              <td
                                className={`w-1/2 border-r-[2px] border-black ${i < arr.length - 1 ? 'border-b-[1.5px]' : ''} pl-3 sm:pl-4 text-left align-middle font-bold text-[11px] sm:text-xs leading-none`}
                              >
                                {k}
                              </td>
                              <td
                                className={`w-1/2 border-black ${i < arr.length - 1 ? 'border-b-[1.5px]' : ''} text-center align-middle font-bold text-[11px] sm:text-xs leading-none`}
                              >
                                {v}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-6 text-center text-xs text-gray-400">
                    Enter a valid Roll No. range or tap rolls above to preview labels.
                  </div>
                )}
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-900 leading-snug">
                <span className="font-bold">TSC Printer Setup:</span> Print popup me Printer <span className="font-semibold">TSC</span> select karein · Paper <span className="font-mono font-bold">{labelWidthMm}×{labelHeightMm}mm</span> · Margins <span className="font-bold">None</span> · Scale <span className="font-bold">100%</span>.
              </div>
            </>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={selectedLabels.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold py-3 rounded-xl text-sm btn-press transition-colors border border-slate-200"
          >
            <FileDown className="w-4 h-4" />
            <span>Label PDF</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrint()}
            disabled={selectedLabels.length === 0}
            className="flex-[1.5] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm btn-press shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Labels ({selectedLabels.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
