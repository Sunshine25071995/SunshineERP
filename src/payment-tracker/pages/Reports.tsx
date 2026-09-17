import { useState, useEffect } from 'react';
import { dbService } from '../db';
import { Bill, Party, Payment } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Printer, Download, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export function Reports() {
  const [reportType, setReportType] = useState('outstanding');
  const [parties, setParties] = useState<Party[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  // Generate data based on report type
  let reportData: any[] = [];
  let tableHeaders: string[] = [];
  
  if (reportType === 'outstanding') {
    tableHeaders = ['Party Name', 'Total Sales', 'Received', 'Outstanding', 'Advance'];
    reportData = parties.map(party => {
      const pBills = bills.filter(b => b.party_id === party.id);
      const outstanding = pBills.reduce((sum, b) => sum + b.outstanding_amount, 0);
      const totalSales = pBills.reduce((sum, b) => sum + b.bill_amount, 0);
      const received = pBills.reduce((sum, b) => sum + b.paid_amount, 0);
      return {
        party_name: party.party_name,
        totalSales: formatCurrency(totalSales),
        received: formatCurrency(received),
        outstanding: formatCurrency(outstanding),
        advance: formatCurrency(party.advance_balance || 0),
        rawOut: outstanding
      };
    }).filter(p => p.rawOut > 0 || p.advance !== '₹0.00'); // only show those with balance
  } else if (reportType === 'sales') {
    tableHeaders = ['Date', 'Bill No', 'Party', 'Amount', 'Status'];
    reportData = bills.map(b => ({
      date: formatDate(b.bill_date),
      billNo: b.bill_number,
      party: parties.find(p => p.id === b.party_id)?.party_name || '-',
      amount: formatCurrency(b.bill_amount),
      status: b.status
    }));
  } else if (reportType === 'collections') {
    tableHeaders = ['Date', 'Party', 'Amount', 'Mode', 'Ref No'];
    reportData = payments.map(p => ({
      date: formatDate(p.payment_date),
      party: parties.find(pt => pt.id === p.party_id)?.party_name || '-',
      amount: formatCurrency(p.amount),
      mode: p.payment_mode,
      ref: p.reference_number || '-'
    }));
  }

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Payment & Sales Tracker - ${reportType.toUpperCase()} REPORT`, 14, 15);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);
    
    // Only include visible columns (exclude internal fields like rawOut)
    const visibleKeys = tableHeaders.length;
    autoTable(doc, {
      startY: 30,
      head: [tableHeaders],
      body: reportData.map(row => {
        const values = Object.values(row);
        return values.slice(0, visibleKeys);
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] } // indigo-600
    });
    
    doc.save(`${reportType}-report.pdf`);
  };

  const printReport = () => {
    window.print();
  };

  const shareWhatsApp = () => {
    let text = `*Payment & Sales Tracker - ${reportType.toUpperCase()} REPORT*\n`;
    text += `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\n`;

    // Add header row
    text += tableHeaders.join(' | ') + '\n';
    text += '─'.repeat(40) + '\n';

    reportData.forEach(row => {
      const values = Object.values(row).slice(0, tableHeaders.length);
      text += values.join(' | ') + '\n';
    });

    if (reportData.length === 0) {
      text += 'No data available.\n';
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        
        <div className="flex space-x-2">
          <button onClick={printReport} className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50">
            <Printer className="mr-2 h-4 w-4" /> Print
          </button>
          <button onClick={exportPDF} className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50">
            <Download className="mr-2 h-4 w-4" /> PDF
          </button>
          <button onClick={shareWhatsApp} className="inline-flex items-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700">
            <Share2 className="mr-2 h-4 w-4" /> WhatsApp Share
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div className="flex space-x-4">
          <select 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
            className="block w-64 rounded-lg border-slate-300 py-2 px-3 text-sm border focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="outstanding">Party Outstanding Report</option>
            <option value="sales">Sales Register</option>
            <option value="collections">Collection Report</option>
          </select>
        </div>
      </div>

      {/* Printable Area */}
      <div className="bg-white shadow-sm rounded-2xl border border-slate-100 overflow-hidden" id="printable-area">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {tableHeaders.map((h, i) => (
                  <th key={i} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {reportData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {Object.values(row).slice(0, tableHeaders.length).map((val: any, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={tableHeaders.length} className="px-6 py-12 text-center text-sm text-slate-500">
                    No data available for this report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {reportData.map((row, idx) => {
            const values = Object.values(row).slice(0, tableHeaders.length);
            return (
              <div key={idx} className="p-4 bg-white hover:bg-slate-50 transition-colors space-y-2">
                {tableHeaders.map((h, j) => (
                  <div key={j} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">{h}</span>
                    <span className="font-semibold text-slate-900 text-sm text-right">{values[j] as string}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {reportData.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No data available for this report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
