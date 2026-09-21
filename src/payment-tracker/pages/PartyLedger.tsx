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

  // ── Professional PDF: Left = Payments, Right = Bills ──────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth(); // 297mm
    const margin = 10;
    const colW = (pageW - margin * 3) / 2; // two equal columns

    // ── Header ──
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('SUNSHINE POLYFILM INDUSTRIES', pageW / 2, 8, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Party Ledger Statement`, pageW / 2, 14, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, 19, { align: 'center' });

    // Party info
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(party.party_name, margin, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (party.mobile) doc.text(`Mobile: ${party.mobile}`, margin, 36);

    // Summary bar
    const summaryY = 42;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, summaryY, pageW - margin * 2, 12, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Bills: ${formatCurrency(totalBillsAmount)}`, margin + 4, summaryY + 5);
    doc.text(`Total Received: ${formatCurrency(totalReceivedAmount)}`, margin + 80, summaryY + 5);
    doc.setTextColor(220, 38, 38);
    doc.text(`Outstanding: ${formatCurrency(totalPendingAmount)}`, margin + 170, summaryY + 5);
    doc.setTextColor(30, 41, 59);

    const tableStartY = summaryY + 17;

    // ── LEFT SIDE: PAYMENTS ────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(margin, tableStartY - 6, colW, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('PAYMENTS RECEIVED', margin + 4, tableStartY - 1.5);

    const paymentRows = payments.map(p => [
      format(new Date(p.payment_date), 'dd/MM/yy') || '',
      p.payment_mode || '',
      p.reference_number || '-',
      formatCurrency(p.amount) || '',
    ]);
    const paymentTotal = formatCurrency(totalReceivedAmount) || '';

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: margin, right: margin + colW + margin },
      tableWidth: colW,
      head: [['Date', 'Mode', 'Reference', 'Amount']],
      body: paymentRows,
      foot: [['', '', 'TOTAL', paymentTotal]],
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: [240, 253, 250] },
    });

    // ── RIGHT SIDE: BILLS ──────────────────────────────────────────────
    const rightX = margin + colW + margin;
    doc.setFillColor(99, 102, 241); // indigo-500
    doc.rect(rightX, tableStartY - 6, colW, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('BILLS ISSUED', rightX + 4, tableStartY - 1.5);

    const billRows = bills.map(b => {
      const dueDays = calculateDueDays(b.bill_date, b.fully_paid_date);
      const isCleared = b.outstanding_amount <= 0;
      return [
        format(new Date(b.bill_date), 'dd/MM/yy') || '',
        b.bill_number || '',
        formatCurrency(b.bill_amount) || '',
        formatCurrency(b.outstanding_amount) || '',
        `${dueDays}d${isCleared ? ' ✓' : ''}` || '',
        b.status || '',
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: rightX, right: margin },
      tableWidth: colW,
      head: [['Date', 'Bill No', 'Amount', 'Outstanding', 'Due Days', 'Status']],
      body: billRows,
      foot: [['', 'TOTAL', formatCurrency(totalBillsAmount) || '', formatCurrency(totalPendingAmount) || '', '', '']],
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [238, 242, 255], textColor: [67, 56, 202], fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
      },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const status = (data.cell.raw || '') as string;
          if (status === 'PAID') data.cell.styles.textColor = [5, 150, 105];
          else if (status === 'OVERDUE' || status === 'DUE') data.cell.styles.textColor = [220, 38, 38];
          else data.cell.styles.textColor = [99, 102, 241];
        }
      }
    });

    doc.save(`${party.party_name}-ledger-${format(new Date(), 'ddMMyyyy')}.pdf`);
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
          <button onClick={() => onNavigate('parties')} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">No entries recorded.</td>
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
