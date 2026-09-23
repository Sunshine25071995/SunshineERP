import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../db';
import { Bill, Party, Payment } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Printer, Download, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

export function Reports() {
  const [reportType, setReportType] = useState('outstanding');
  const [parties, setParties] = useState<Party[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [pt, b, p] = await Promise.all([
          dbService.getParties(),
          dbService.getBills(),
          dbService.getPayments()
        ]);
        setParties(pt);
        setBills(b);
        setPayments(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="w-full flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  // ── Build report data ──────────────────────────────────────────────────────
  type ReportRow = Record<string, any>;
  let reportRows: ReportRow[] = [];
  let tableHeaders: string[] = [];

  const totalBills = bills.reduce((s, b) => s + b.bill_amount, 0);
  const totalReceived = bills.reduce((s, b) => s + b.paid_amount, 0);
  const totalOutstanding = bills.reduce((s, b) => s + b.outstanding_amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

  if (reportType === 'outstanding') {
    tableHeaders = ['Party Name', 'Total Bills', 'Received', 'Outstanding'];
    reportRows = parties.map(party => {
      const pBills = bills.filter(b => b.party_id === party.id);
      const outstanding = pBills.reduce((sum, b) => sum + b.outstanding_amount, 0);
      const totalSales = pBills.reduce((sum, b) => sum + b.bill_amount, 0);
      const received = pBills.reduce((sum, b) => sum + b.paid_amount, 0);
      return { party_name: party.party_name, totalSales, received, outstanding };
    }).filter(p => p.outstanding > 0 || p.received > 0);
  } else if (reportType === 'sales') {
    tableHeaders = ['Date', 'Bill No', 'Party', 'Amount', 'Paid', 'Outstanding', 'Status'];
    reportRows = bills.map(b => ({
      date: new Date(b.bill_date),
      billNo: b.bill_number,
      party: parties.find(p => p.id === b.party_id)?.party_name || '-',
      amount: b.bill_amount,
      paid: b.paid_amount,
      outstanding: b.outstanding_amount,
      status: b.status,
    }));
  } else if (reportType === 'collections') {
    tableHeaders = ['Date', 'Party', 'Amount', 'Mode', 'Ref No'];
    reportRows = payments.map(p => ({
      date: new Date(p.payment_date),
      party: parties.find(pt => pt.id === p.party_id)?.party_name || '-',
      amount: p.amount,
      mode: p.payment_mode,
      ref: p.reference_number || '-',
    }));
  }

  // ── Professional PDF ───────────────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    const generated = format(new Date(), 'dd/MM/yyyy HH:mm');

    // Header bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SUNSHINE POLYFILM INDUSTRIES', pageW / 2, 8, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const reportLabel =
      reportType === 'outstanding' ? 'Party Outstanding Report' :
      reportType === 'sales' ? 'Sales Register' : 'Collection Register';
    doc.text(`${reportLabel} | Generated: ${generated}`, pageW / 2, 14, { align: 'center' });

    // Summary bar
    doc.setTextColor(30, 41, 59);
    const sumY = 24;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, sumY, pageW - margin * 2, 10, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    if (reportType === 'outstanding') {
      doc.setTextColor(67, 56, 202);
      doc.text(`Total Bills: ${formatCurrency(totalBills)}`, margin + 4, sumY + 6);
      doc.setTextColor(5, 150, 105);
      doc.text(`Total Received: ${formatCurrency(totalReceived)}`, margin + 80, sumY + 6);
      doc.setTextColor(220, 38, 38);
      doc.text(`Total Outstanding: ${formatCurrency(totalOutstanding)}`, margin + 170, sumY + 6);
    } else if (reportType === 'sales') {
      doc.setTextColor(67, 56, 202);
      doc.text(`Total Bills: ${bills.length}`, margin + 4, sumY + 6);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total Amount: ${formatCurrency(totalBills)}`, margin + 60, sumY + 6);
      doc.setTextColor(220, 38, 38);
      doc.text(`Outstanding: ${formatCurrency(totalOutstanding)}`, margin + 150, sumY + 6);
    } else {
      doc.setTextColor(5, 150, 105);
      doc.text(`Total Collections: ${payments.length} payments`, margin + 4, sumY + 6);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total Amount: ${formatCurrency(totalPayments)}`, margin + 100, sumY + 6);
    }

    doc.setTextColor(30, 41, 59);
    const tableStartY = sumY + 14;

    if (reportType === 'outstanding') {
      // Two-column layout: LEFT = Payments summary, RIGHT = Bills/Outstanding
      const colW = (pageW - margin * 3) / 2;

      // LEFT: Payments summary per party
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, tableStartY - 5, colW, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('PAYMENTS RECEIVED (Party-wise)', margin + 3, tableStartY - 1);

      const payRows = reportRows.map(r => [
        r.party_name,
        formatCurrency(r.received),
      ]);
      payRows.push(['TOTAL', formatCurrency(totalReceived)]);

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin + colW + margin },
        tableWidth: colW,
        head: [['Party', 'Received']],
        body: payRows.slice(0, -1),
        foot: [payRows[payRows.length - 1]],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: [240, 253, 250] },
      });

      // RIGHT: Bills outstanding
      const rightX = margin + colW + margin;
      doc.setFillColor(99, 102, 241);
      doc.rect(rightX, tableStartY - 5, colW, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('BILLS & OUTSTANDING (Party-wise)', rightX + 3, tableStartY - 1);

      const billRows = reportRows.map(r => [
        r.party_name,
        formatCurrency(r.totalSales),
        formatCurrency(r.outstanding),
      ]);

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: rightX, right: margin },
        tableWidth: colW,
        head: [['Party', 'Total Bills', 'Outstanding']],
        body: billRows,
        foot: [['TOTAL', formatCurrency(totalBills), formatCurrency(totalOutstanding)]],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [238, 242, 255], textColor: [67, 56, 202], fontStyle: 'bold' },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
        },
        alternateRowStyles: { fillColor: [245, 243, 255] },
      });
    } else if (reportType === 'sales') {
      const rows = reportRows.map(row => {
        const b = row as any;
        return [
          format(b.date, 'dd/MM/yy') || '',
          b.billNo || '',
          b.party || '',
          formatCurrency(b.amount) || '',
          formatCurrency(b.paid) || '',
          formatCurrency(b.outstanding) || '',
          b.status || ''
        ];
      });
      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin },
        head: [['Date', 'Bill No', 'Party', 'Amount', 'Paid', 'Outstanding', 'Status']],
        body: rows,
        foot: [['', '', 'TOTAL', formatCurrency(totalBills), formatCurrency(totalReceived), formatCurrency(totalOutstanding), '']],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right', textColor: [5, 150, 105] },
          5: { halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const s = data.cell.raw as string;
            if (s === 'PAID') data.cell.styles.textColor = [5, 150, 105];
            else if (s === 'DUE' || s === 'OVERDUE') data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [99, 102, 241];
          }
        }
      });
    } else {
      const rows = reportRows.map(r => [
        format(r.date, 'dd/MM/yy'),
        r.party,
        formatCurrency(r.amount),
        r.mode,
        r.ref,
      ]);
      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin },
        head: [['Date', 'Party', 'Amount', 'Mode', 'Reference']],
        body: rows,
        foot: [['', 'TOTAL', formatCurrency(totalPayments), '', '']],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontStyle: 'bold' },
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] } },
        alternateRowStyles: { fillColor: [240, 253, 250] },
      });
    }

    doc.save(`${reportType}-report-${format(new Date(), 'ddMMyyyy')}.pdf`);
  };

  // ── WhatsApp via html2canvas ────────────────────────────────────────────────
  const shareWhatsApp = async () => {
    if (!tableRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false
      });

      let text = `📊 *${
        reportType === 'outstanding' ? 'PARTY OUTSTANDING REPORT' :
        reportType === 'sales' ? 'SALES REGISTER' : 'COLLECTION REGISTER'
      }*\n`;
      text += `🏭 *Sunshine Polyfilm Industries*\n`;
      text += `📅 *Generated:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (reportType === 'outstanding') {
        reportRows.slice(0, 8).forEach(r => {
          text += `• *${r.party_name}*\n  Bills: ${formatCurrency(r.totalSales)} | Rcvd: ${formatCurrency(r.received)} | 🚨 Due: ${formatCurrency(r.outstanding)}\n\n`;
        });
        text += `━━━━━━━━━━━━━━━━━━━━\n`;
        text += `💰 *Total Bills:* ${formatCurrency(totalBills)}\n`;
        text += `✅ *Total Received:* ${formatCurrency(totalReceived)}\n`;
        text += `🚨 *Total Outstanding:* ${formatCurrency(totalOutstanding)}\n`;
      } else if (reportType === 'sales') {
        text += `📋 *Total Bills:* ${bills.length} | 💰 ${formatCurrency(totalBills)}\n`;
        text += `✅ *Received:* ${formatCurrency(totalReceived)}\n`;
        text += `🚨 *Outstanding:* ${formatCurrency(totalOutstanding)}\n`;
      } else {
        text += `💸 *Total Payments:* ${payments.length}\n`;
        text += `✅ *Total Collected:* ${formatCurrency(totalPayments)}\n`;
      }
      text += `\n_Generated via Sunshine ERP_`;

      // Try native share with image on mobile
      if (navigator.canShare && navigator.canShare({ files: [] })) {
        canvas.toBlob(async (blob) => {
          if (!blob) throw new Error('blob fail');
          const file = new File([blob], `${reportType}-report.png`, { type: 'image/png' });
          try {
            await navigator.share({ files: [file], title: 'Sunshine ERP Report', text });
          } catch {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }
        }, 'image/png');
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    } catch (err) {
      console.error('Share failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const printReport = () => window.print();

  // ── Status badge helper ───────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    const cls =
      status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
      status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
      status === 'PARTIALLY PAID' ? 'bg-blue-100 text-blue-800' :
      'bg-amber-100 text-amber-800';
    return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{status}</span>;
  };

  return (
    <div className="w-full space-y-4 pb-[80px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={printReport} className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 shadow-sm">
            <Printer className="h-4 w-4" />Print
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm">
            <Download className="h-4 w-4" />PDF
          </button>
          <button onClick={shareWhatsApp} disabled={isExporting} className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-emerald-600 shadow-sm disabled:opacity-50">
            <Share2 className="h-4 w-4" />{isExporting ? 'Generating...' : 'WhatsApp'}
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'outstanding', label: '📊 Outstanding' },
            { value: 'sales', label: '🧾 Sales Register' },
            { value: 'collections', label: '💰 Collections' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setReportType(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                reportType === opt.value
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table — also captured by html2canvas */}
      <div ref={tableRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 px-5 py-3">
          <h2 className="text-sm font-black text-white uppercase tracking-wide">
            {reportType === 'outstanding' ? '📊 Party Outstanding Report' :
             reportType === 'sales' ? '🧾 Sales Register' : '💰 Collection Register'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Generated: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {tableHeaders.map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {reportType === 'outstanding' && <>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900">{row.party_name}</td>
                    <td className="px-5 py-3 text-sm text-right text-slate-700 font-bold">{formatCurrency(row.totalSales)}</td>
                    <td className="px-5 py-3 text-sm text-right text-emerald-600 font-bold">{formatCurrency(row.received)}</td>
                    <td className="px-5 py-3 text-sm text-right font-black text-red-600">{formatCurrency(row.outstanding)}</td>
                  </>}
                  {reportType === 'sales' && <>
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium">{format(row.date, 'dd/MM/yy')}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{row.billNo}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{row.party}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(row.amount)}</td>
                    <td className="px-5 py-3 text-sm text-emerald-600 font-bold text-right">{formatCurrency(row.paid)}</td>
                    <td className="px-5 py-3 text-sm font-black text-red-600 text-right">{formatCurrency(row.outstanding)}</td>
                    <td className="px-5 py-3 text-right">{statusBadge(row.status)}</td>
                  </>}
                  {reportType === 'collections' && <>
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium">{format(row.date, 'dd/MM/yy')}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{row.party}</td>
                    <td className="px-5 py-3 text-sm font-black text-emerald-600 text-right">+{formatCurrency(row.amount)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 text-right capitalize">{row.mode}</td>
                    <td className="px-5 py-3 text-sm text-slate-500 text-right">{row.ref}</td>
                  </>}
                </tr>
              ))}
              {reportRows.length === 0 && (
                <tr><td colSpan={tableHeaders.length} className="px-2 py-6 text-center text-slate-500 text-sm font-medium">No data available.</td></tr>
              )}
            </tbody>
            {reportRows.length > 0 && (
              <tfoot className="bg-slate-800">
                <tr>
                  {reportType === 'outstanding' && <>
                    <td className="px-5 py-3 text-xs font-black text-white uppercase">TOTAL</td>
                    <td className="px-5 py-3 text-xs font-black text-indigo-300 text-right">{formatCurrency(totalBills)}</td>
                    <td className="px-5 py-3 text-xs font-black text-emerald-400 text-right">{formatCurrency(totalReceived)}</td>
                    <td className="px-5 py-3 text-xs font-black text-red-400 text-right">{formatCurrency(totalOutstanding)}</td>
                  </>}
                  {reportType === 'sales' && <>
                    <td className="px-5 py-3 text-xs font-black text-white uppercase" colSpan={3}>TOTAL ({bills.length} bills)</td>
                    <td className="px-5 py-3 text-xs font-black text-indigo-300 text-right">{formatCurrency(totalBills)}</td>
                    <td className="px-5 py-3 text-xs font-black text-emerald-400 text-right">{formatCurrency(totalReceived)}</td>
                    <td className="px-5 py-3 text-xs font-black text-red-400 text-right">{formatCurrency(totalOutstanding)}</td>
                    <td></td>
                  </>}
                  {reportType === 'collections' && <>
                    <td className="px-5 py-3 text-xs font-black text-white uppercase" colSpan={2}>TOTAL ({payments.length} payments)</td>
                    <td className="px-5 py-3 text-xs font-black text-emerald-400 text-right">{formatCurrency(totalPayments)}</td>
                    <td colSpan={2}></td>
                  </>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden flex flex-col gap-3 ">
          {reportRows.map((row, idx) => (
            <div key={idx} className="app-card p-4 rounded-2xl bg-white flex flex-col gap-2">
              {reportType === 'outstanding' && (
                <>
                  <p className="font-bold text-slate-900 text-lg mb-1">{row.party_name}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-xl p-2 flex flex-col justify-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Bills</p>
                      <p className="font-bold text-slate-900 text-sm">{formatCurrency(row.totalSales)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-2 flex flex-col justify-center">
                      <p className="text-[10px] text-emerald-600 font-bold uppercase mb-0.5">Received</p>
                      <p className="font-bold text-emerald-700 text-sm">{formatCurrency(row.received)}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-2 flex flex-col justify-center">
                      <p className="text-[10px] text-red-500 font-bold uppercase mb-0.5">Due</p>
                      <p className="font-black text-red-600 text-sm">{formatCurrency(row.outstanding)}</p>
                    </div>
                  </div>
                </>
              )}
              {reportType === 'sales' && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-bold text-slate-900 text-lg">{row.party}</span>
                      <p className="text-xs text-slate-500 font-medium">{row.billNo} · {format(row.date, 'dd/MM/yy')}</p>
                    </div>
                    {statusBadge(row.status)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-2">
                    <div className="bg-slate-50 rounded-xl p-2 flex flex-col justify-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Amount</p>
                      <p className="font-bold text-slate-900 text-sm">{formatCurrency(row.amount)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-2 flex flex-col justify-center">
                      <p className="text-[10px] text-emerald-600 font-bold uppercase mb-0.5">Paid</p>
                      <p className="font-bold text-emerald-700 text-sm">{formatCurrency(row.paid)}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-2 flex flex-col justify-center">
                      <p className="text-[10px] text-red-500 font-bold uppercase mb-0.5">Due</p>
                      <p className="font-black text-red-600 text-sm">{formatCurrency(row.outstanding)}</p>
                    </div>
                  </div>
                </>
              )}
              {reportType === 'collections' && (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{row.party}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">{format(row.date, 'dd/MM/yy')} · {row.mode} {row.ref !== '-' ? `· ${row.ref}` : ''}</p>
                    </div>
                    <p className="font-black text-emerald-600 text-base bg-emerald-50 px-3 py-1.5 rounded-lg">+{formatCurrency(row.amount)}</p>
                  </div>
                </>
              )}
            </div>
          ))}
          {reportRows.length === 0 && <div className="p-8 text-center text-sm text-slate-500 font-medium">No data available.</div>}
        </div>
        
        {/* Mobile Total Bar */}
        {reportRows.length > 0 && (
          <div className="md:hidden px-4 py-3 bg-slate-800 flex justify-between items-center rounded-b-2xl">
            <span className="text-xs font-black text-white uppercase tracking-wider">Total</span>
            {reportType === 'outstanding' && <span className="text-sm font-black text-red-400">{formatCurrency(totalOutstanding)}</span>}
            {reportType === 'sales' && <span className="text-sm font-black text-indigo-300">{formatCurrency(totalBills)}</span>}
            {reportType === 'collections' && <span className="text-sm font-black text-emerald-400">{formatCurrency(totalPayments)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
