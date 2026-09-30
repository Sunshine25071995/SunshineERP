import React, { useEffect, useState, useRef } from 'react';
import { dbService } from '../db';
import { Party, Bill, Payment } from '../types';
import { formatCurrency, formatDate, calculateDueDays, cn } from '../utils';
import { ArrowLeft, Share2, ReceiptText, Banknote, UserRound, Clock, CheckCircle2, FileText, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

type LedgerEntry = {
  id: string;
  date: number;
  type: 'bill' | 'payment';
  ref: string;
  billAmount: number;
  receivedAmount: number;
  balance: number;
  dueDays?: number;
  isCleared?: boolean;
};

export function PartyLedger({ id, onNavigate }: { id?: string, onNavigate: (view: string) => void }) {
  const [party, setParty] = useState<Party | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const ledgerTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      try {
        const [allParties, allBills, allPayments] = await Promise.all([
          dbService.getParties(),
          dbService.getBills(),
          dbService.getPayments()
        ]);
        const currentParty = allParties.find(p => p.id === id);
        if (currentParty) {
          setParty(currentParty);
          const partyBills = allBills.filter(b => b.party_id === id);
          const partyPayments = allPayments.filter(p => p.party_id === id);
          setBills(partyBills.sort((a, b) => a.bill_date - b.bill_date));
          setPayments(partyPayments.sort((a, b) => a.payment_date - b.payment_date));

          const combined = [
            ...partyBills.map(b => ({
              id: b.id, date: b.bill_date, type: 'bill' as const,
              ref: b.bill_number, billAmount: b.bill_amount, receivedAmount: 0,
              dueDays: calculateDueDays(b.bill_date, b.fully_paid_date),
              isCleared: b.outstanding_amount <= 0
            })),
            ...partyPayments.map(p => ({
              id: p.id, date: p.payment_date, type: 'payment' as const,
              ref: p.reference_number ? `${p.payment_mode} - ${p.reference_number}` : p.payment_mode,
              billAmount: 0, receivedAmount: p.amount,
            }))
          ].sort((a, b) => a.date - b.date);

          let runningBalance = 0;
          const entriesWithBalance = combined.map(entry => {
            runningBalance += entry.billAmount;
            runningBalance -= entry.receivedAmount;
            return { ...entry, balance: runningBalance };
          });
          setLedgerEntries(entriesWithBalance);
        }
      } catch (error) {
        console.error('Failed to load ledger data', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
    </div>
  );
  if (!party) return <div className="p-8 text-lg font-medium text-center text-red-500">Party not found</div>;

  const totalBillsAmount = bills.reduce((sum, b) => sum + b.bill_amount, 0);
  const totalReceivedAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingAmount = bills.reduce((sum, b) => sum + b.outstanding_amount, 0);

  // ── Professional Tally-style PDF ──────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth(); // 210mm
    const pageH = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 10;
    
    // Sort bills and payments to get date range
    const sortedCombined = [...bills.map(b => ({ date: b.bill_date })), ...payments.map(p => ({ date: p.payment_date }))].sort((a, b) => a.date - b.date);
    const fromDate = sortedCombined.length > 0 ? format(new Date(sortedCombined[0].date), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy');
    const toDate = sortedCombined.length > 0 ? format(new Date(sortedCombined[sortedCombined.length - 1].date), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy');

    function printHeader(pageNum: number) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('SUNSHINE POLYFILMS', pageW / 2, 15, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('PLOT NO.4, SUR.NO.712,JUNAGADH RAJKOT HIGHWAY,', pageW / 2, 21, { align: 'center' });
      doc.text('GITANJALI INDUSTRIAL ESTATE,KATHROTA-JUNAGADH 362315', pageW / 2, 26, { align: 'center' });
      doc.text('GSTIN No:24AFQFS0867J1ZG', margin, 32);
      doc.text('PAN No.:AFQFS0867J', pageW - margin, 32, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Account Statement For ${party?.party_name.toUpperCase()}`, margin, 38);

      doc.setFontSize(9);
      doc.text(`From ${fromDate} To ${toDate}`, margin, 44);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page : ${pageNum}`, pageW - margin, 44, { align: 'right' });

      doc.setLineWidth(0.5);
      doc.line(margin, 46, pageW - margin, 46);

      doc.text('Credit Particulars', margin + 20, 50);
      doc.text('Debit Particulars', pageW / 2 + 20, 50);

      doc.line(margin, 52, pageW - margin, 52);
    }

    const creditLines: { amount: string; particulars: string; rawAmount: number }[] = [];
    payments.forEach(p => {
      creditLines.push({
        amount: p.amount.toFixed(2),
        particulars: `${format(new Date(p.payment_date), 'dd/MM/yyyy')} BRct`,
        rawAmount: p.amount
      });
      creditLines.push({
        amount: '',
        particulars: p.payment_mode + (p.reference_number ? ` - ${p.reference_number}` : ''),
        rawAmount: 0
      });
    });

    const debitLines: { amount: string; particulars: string; rawAmount: number }[] = [];
    bills.forEach(b => {
      debitLines.push({
        amount: b.bill_amount.toFixed(2),
        particulars: `${format(new Date(b.bill_date), 'dd/MM/yyyy')} Sale`,
        rawAmount: b.bill_amount
      });
      debitLines.push({ amount: '', particulars: `Sales A/c.`, rawAmount: 0 });
      debitLines.push({ amount: '', particulars: `Bill No ${b.bill_number}`, rawAmount: 0 });
    });

    let currentY = 58;
    const lineH = 4.5;
    const marginBottom = 20;

    let cIdx = 0;
    let dIdx = 0;
    let pageNum = 1;
    let runningCredit = 0;
    let runningDebit = 0;

    printHeader(pageNum);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    while (cIdx < creditLines.length || dIdx < debitLines.length) {
      if (currentY > pageH - marginBottom) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${runningCredit.toFixed(2)} C/F -> On Page ${pageNum + 1}`, margin + 28, currentY, { align: 'right' });
        doc.text(`${runningDebit.toFixed(2)} C/F -> On Page ${pageNum + 1}`, pageW / 2 + 28, currentY, { align: 'right' });
        
        doc.addPage();
        pageNum++;
        printHeader(pageNum);
        currentY = 58;
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${runningCredit.toFixed(2)} B/F -> From Page ${pageNum - 1}`, margin + 28, currentY, { align: 'right' });
        doc.text(`${runningDebit.toFixed(2)} B/F -> From Page ${pageNum - 1}`, pageW / 2 + 28, currentY, { align: 'right' });
        currentY += lineH + 2;
        doc.setFont('helvetica', 'normal');
      }

      const cLine = creditLines[cIdx];
      const dLine = debitLines[dIdx];

      if (cLine) {
        if (cLine.amount) {
          doc.text(cLine.amount, margin + 28, currentY, { align: 'right' });
          runningCredit += cLine.rawAmount;
        }
        doc.text(cLine.particulars, margin + 30, currentY);
        cIdx++;
      }

      if (dLine) {
        if (dLine.amount) {
          doc.text(dLine.amount, pageW / 2 + 28, currentY, { align: 'right' });
          runningDebit += dLine.rawAmount;
        }
        doc.text(dLine.particulars, pageW / 2 + 30, currentY);
        dIdx++;
      }

      currentY += lineH;
    }

    const diff = Math.abs(runningDebit - runningCredit);
    const isDbBalance = runningDebit > runningCredit;

    currentY += 2;
    if (currentY > pageH - marginBottom - 15) {
      doc.addPage();
      pageNum++;
      printHeader(pageNum);
      currentY = 58;
    }

    doc.setFont('helvetica', 'bold');
    if (isDbBalance) {
       doc.text(runningCredit.toFixed(2), margin + 28, currentY, { align: 'right' });
       currentY += lineH;
       doc.text(diff.toFixed(2), margin + 28, currentY, { align: 'right' });
       doc.text('DB Closing Balance', margin + 30, currentY);
    } else if (diff > 0) {
       doc.text(runningDebit.toFixed(2), pageW / 2 + 28, currentY, { align: 'right' });
       currentY += lineH;
       doc.text(diff.toFixed(2), pageW / 2 + 28, currentY, { align: 'right' });
       doc.text('CR Closing Balance', pageW / 2 + 30, currentY);
    }

    currentY += 4;
    doc.line(margin, currentY, pageW / 2 - 5, currentY);
    doc.line(pageW / 2 + 5, currentY, pageW - margin, currentY);

    currentY += lineH + 1;
    const maxTotal = Math.max(runningCredit, runningDebit);
    doc.text(maxTotal.toFixed(2), margin + 28, currentY, { align: 'right' });
    doc.text(maxTotal.toFixed(2), pageW / 2 + 28, currentY, { align: 'right' });

    currentY += 2;
    doc.line(margin, currentY, pageW / 2 - 5, currentY);
    doc.line(pageW / 2 + 5, currentY, pageW - margin, currentY);

    doc.save(`${party?.party_name}-ledger-${format(new Date(), 'ddMMyyyy')}.pdf`);
  };

  // ── WhatsApp via html2canvas ────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    if (!ledgerTableRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(ledgerTableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgDataUrl = canvas.toDataURL('image/png');

      // Fallback text summary for WhatsApp
      let msg = `📄 *LEDGER STATEMENT*\n`;
      msg += `👤 *Party:* ${party.party_name}\n`;
      msg += `📅 *Date:* ${format(new Date(), 'dd/MM/yyyy')}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      msg += `💰 *Total Bills:* ${formatCurrency(totalBillsAmount)}\n`;
      msg += `✅ *Received:* ${formatCurrency(totalReceivedAmount)}\n`;
      msg += `🚨 *Outstanding:* ${formatCurrency(totalPendingAmount)}\n\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📋 *Recent Bills:*\n`;
      bills.slice(-5).forEach(b => {
        const due = calculateDueDays(b.bill_date, b.fully_paid_date);
        msg += `• ${b.bill_number} — ${formatCurrency(b.bill_amount)} | Due: ${due} days | ${b.status}\n`;
      });
      msg += `\n_Generated via Sunshine ERP_`;

      // Try native share with canvas blob (mobile)
      if (navigator.canShare && navigator.canShare({ files: [] })) {
        canvas.toBlob(async (blob) => {
          if (!blob) throw new Error('Canvas blob failed');
          const file = new File([blob], `${party.party_name}-ledger.png`, { type: 'image/png' });
          try {
            await navigator.share({ files: [file], title: `${party.party_name} Ledger`, text: msg });
          } catch {
            // user cancelled or share not supported
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
          }
        }, 'image/png');
      } else {
        // Desktop: open WhatsApp with text
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }
    } catch (err) {
      console.error('WhatsApp export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full space-y-5 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <UserRound className="h-6 w-6 text-indigo-500" />
              {party.party_name}
            </h1>
            {party.mobile && <p className="text-slate-500 text-sm ml-8">{party.mobile}</p>}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleWhatsApp} disabled={isExporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 text-sm">
            <Share2 className="h-4 w-4" />{isExporting ? 'Generating...' : 'WhatsApp'}
          </button>
          <button onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm text-sm">
            <Download className="h-4 w-4" />PDF
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <ReceiptText className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Bills</span>
          </div>
          <span className="text-2xl font-black text-slate-900">{formatCurrency(totalBillsAmount)}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Banknote className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wide">Received</span>
          </div>
          <span className="text-2xl font-black text-emerald-600">{formatCurrency(totalReceivedAmount)}</span>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-red-50 rounded-2xl p-4 border border-red-200 shadow-sm">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Outstanding</span>
          </div>
          <span className="text-3xl font-black text-red-600">{formatCurrency(totalPendingAmount)}</span>
        </div>
      </div>

      {/* LEDGER TABLE — rendered for html2canvas */}
      <div ref={ledgerTableRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 px-5 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-black text-white tracking-wide uppercase">Account Ledger — {party.party_name}</h2>
          <span className="ml-auto text-xs text-slate-400">{format(new Date(), 'dd/MM/yyyy')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">Reference</th>
                <th className="px-4 py-2.5 text-xs font-bold text-indigo-600 uppercase tracking-wider text-right">Bill (Dr)</th>
                <th className="px-4 py-2.5 text-xs font-bold text-emerald-600 uppercase tracking-wider text-right">Received (Cr)</th>
                <th className="px-4 py-2.5 text-xs font-bold text-rose-600 uppercase tracking-wider text-right">Balance</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Due Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerEntries.map((entry, i) => {
                const isBill = entry.type === 'bill';
                return (
                  <tr key={entry.id} className={cn('transition-colors', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[140px] truncate">
                      <div className="flex items-center gap-1.5">
                        {isBill
                          ? <ReceiptText className="h-3 w-3 text-indigo-400 shrink-0" />
                          : <Banknote className="h-3 w-3 text-emerald-400 shrink-0" />
                        }
                        <span>{entry.ref}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-indigo-700">
                      {isBill ? formatCurrency(entry.billAmount) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-emerald-600">
                      {!isBill ? formatCurrency(entry.receivedAmount) : '—'}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right text-xs font-black', entry.balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {formatCurrency(Math.abs(entry.balance))}{entry.balance < 0 ? ' Adv' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isBill ? (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                          entry.isCleared
                            ? 'bg-slate-100 text-slate-500'
                            : entry.dueDays! > 30
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        )}>
                          {entry.dueDays}d{entry.isCleared ? ' ✓' : ''}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
              {ledgerEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-slate-400 text-sm">No entries recorded.</td>
                </tr>
              )}
            </tbody>
            {ledgerEntries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800">
                  <td colSpan={2} className="px-4 py-3 text-xs font-black text-white uppercase tracking-wider">TOTAL</td>
                  <td className="px-4 py-3 text-right text-xs font-black text-indigo-300">{formatCurrency(totalBillsAmount)}</td>
                  <td className="px-4 py-3 text-right text-xs font-black text-emerald-400">{formatCurrency(totalReceivedAmount)}</td>
                  <td className="px-4 py-3 text-right text-xs font-black text-red-400">{formatCurrency(totalPendingAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
