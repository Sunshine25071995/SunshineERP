import React, { useEffect, useState, useRef } from 'react';
import { dbService } from '../db';
import { Bill, Party, Payment } from '../types';
import { formatCurrency } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, AlertCircle, Share2, ReceiptText, TrendingUp, Users } from 'lucide-react';
import { format, isThisMonth } from 'date-fns';
import html2canvas from 'html2canvas';

export function Dashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [b, p, pt] = await Promise.all([
          dbService.getBills(),
          dbService.getPayments(),
          dbService.getParties()
        ]);
        setBills(b);
        setPayments(p);
        setParties(pt);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  const totalSales = bills.reduce((sum, b) => sum + b.bill_amount, 0);
  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = bills.reduce((sum, b) => sum + b.outstanding_amount, 0);
  const monthSales = bills.filter(b => isThisMonth(new Date(b.bill_date))).reduce((sum, b) => sum + b.bill_amount, 0);

  // Top 3 Receivables
  const partyOutstanding = parties.map(party => {
    const partyBills = bills.filter(b => b.party_id === party.id);
    const outstanding = partyBills.reduce((sum, b) => sum + b.outstanding_amount, 0);
    return { name: party.party_name, outstanding };
  }).filter(p => p.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 3);

  // Chart data: Monthly Sales vs Collection
  const monthlyDataMap = new Map<string, { name: string, sales: number, collection: number }>();
  
  bills.forEach(b => {
    const month = format(new Date(b.bill_date), 'MMM yy');
    if (!monthlyDataMap.has(month)) monthlyDataMap.set(month, { name: month, sales: 0, collection: 0 });
    monthlyDataMap.get(month)!.sales += b.bill_amount;
  });

  payments.forEach(p => {
    const month = format(new Date(p.payment_date), 'MMM yy');
    if (!monthlyDataMap.has(month)) monthlyDataMap.set(month, { name: month, sales: 0, collection: 0 });
    monthlyDataMap.get(month)!.collection += p.amount;
  });

  const chartData = Array.from(monthlyDataMap.values()).slice(-6);

  const handleWhatsApp = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    
    const actionButtons = dashboardRef.current.querySelector('.action-buttons-container');
    if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false,
        allowTaint: true,
      });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      
      if (blob) {
        const file = new File([blob], `Dashboard_Report.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Business Dashboard`,
            text: `Please find the latest dashboard report attached.`,
            files: [file]
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Dashboard_Report.png`;
          a.click();
          URL.revokeObjectURL(url);

          let text = `*📊 Business Dashboard Report*\n\n`;
          text += `*Receivable (Outstanding):* ${formatCurrency(totalOutstanding)}\n`;
          text += `*Total Received:* ${formatCurrency(totalReceived)}\n`;
          text += `*Total Sales:* ${formatCurrency(totalSales)}\n`;
          text += `*This Month Sales:* ${formatCurrency(monthSales)}\n\n`;
          
          if (partyOutstanding.length > 0) {
            text += `*Top Receivables:*\n`;
            partyOutstanding.forEach((p, i) => {
              text += `${i+1}. ${p.name}: ${formatCurrency(p.outstanding)}\n`;
            });
          }

          const encoded = encodeURIComponent(text);
          window.open(`https://wa.me/?text=${encoded}`, '_blank');
        }
      }
    } catch (error) {
      console.error("Export failed", error);
      let text = `*📊 Business Dashboard Report*\n\n`;
      text += `*Receivable (Outstanding):* ${formatCurrency(totalOutstanding)}\n`;
      text += `*Total Received:* ${formatCurrency(totalReceived)}\n`;
      text += `*Total Sales:* ${formatCurrency(totalSales)}\n`;
      const encoded = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    } finally {
      if (actionButtons) (actionButtons as HTMLElement).style.display = 'flex';
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto space-y-3 sm:space-y-4" ref={dashboardRef}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-500" />
          Dashboard Overview
        </h1>
        <div className="action-buttons-container">
          <button 
            onClick={handleWhatsApp}
            disabled={isExporting}
            className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" /> 
            <span className="hidden sm:inline">{isExporting ? 'Sharing...' : 'WhatsApp'}</span>
            <span className="sm:hidden">{isExporting ? '...' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* 4 Main Metrics in a compact grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-3 sm:p-4 rounded-2xl border border-rose-100 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-rose-600 mb-1 sm:mb-2">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-semibold">Receivable</span>
          </div>
          <span className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{formatCurrency(totalOutstanding)}</span>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-3 sm:p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-emerald-600 mb-1 sm:mb-2">
            <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-semibold">Received</span>
          </div>
          <span className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{formatCurrency(totalReceived)}</span>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-3 sm:p-4 rounded-2xl border border-indigo-100 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-indigo-600 mb-1 sm:mb-2">
            <ReceiptText className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-semibold">Total Sales</span>
          </div>
          <span className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{formatCurrency(totalSales)}</span>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 sm:p-4 rounded-2xl border border-blue-100 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-blue-600 mb-1 sm:mb-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-semibold">Month Sales</span>
          </div>
          <span className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{formatCurrency(monthSales)}</span>
        </div>
      </div>

      {/* Main Content Area: Chart and Top Receivables */}
      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
        
        {/* Chart Section */}
        <div className="flex-1 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[180px]">
          <h3 className="text-sm font-bold text-slate-700 mb-2 sm:mb-4 shrink-0">Sales vs Collection (Last 6 Months)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(val) => `₹${val/1000}k`} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} formatter={(value: number) => formatCurrency(value)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="sales" name="Sales" fill="#818CF8" radius={[3, 3, 0, 0]} maxBarSize={40} />
                <Bar dataKey="collection" name="Collection" fill="#34D399" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Receivables Section */}
        <div className="lg:w-80 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-2 sm:mb-4 shrink-0">
            <Users className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-700">Top Receivables</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {partyOutstanding.length > 0 ? (
              partyOutstanding.map((party, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs sm:text-sm font-medium text-slate-700 truncate pr-2">{party.name}</span>
                  <span className="text-xs sm:text-sm font-bold text-rose-600 shrink-0">{formatCurrency(party.outstanding)}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No receivables found
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
