import React, { useEffect, useState, useRef } from 'react';
import { dbService } from '../db';
import { Bill, Party, Payment } from '../types';
import { formatCurrency } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, AlertCircle, Share2, ReceiptText, TrendingUp, Users } from 'lucide-react';
import { format, isThisMonth } from 'date-fns';

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
    return <div className="w-full flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
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

  const handleWhatsApp = () => {
    let msg = `📊 *BUSINESS DASHBOARD SUMMARY* 📊\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `📈 *Total Sales:* ₹${totalSales.toLocaleString('en-IN')}\n`;
    msg += `💰 *Total Collection:* ₹${totalReceived.toLocaleString('en-IN')}\n`;
    msg += `🚨 *Total Outstanding:* ₹${totalOutstanding.toLocaleString('en-IN')}\n`;
    msg += `📅 *This Month Sales:* ₹${monthSales.toLocaleString('en-IN')}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (partyOutstanding.length > 0) {
      msg += `\n⚠️ *TOP 3 RECEIVABLES:* ⚠️\n`;
      partyOutstanding.forEach((p, i) => {
        msg += `${i+1}. *${p.name}:* ₹${p.outstanding.toLocaleString('en-IN')}\n`;
      });
    }
    msg += `\n_Generated via Sunshine ERP_`;
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-5rem)] space-y-4 sm:space-y-5 pb-[80px] md:pb-4 overflow-x-hidden" ref={dashboardRef}>
      {/* Header */}
      <div className="w-full flex items-center justify-between shrink-0 bg-white p-4 rounded-3xl shadow-sm border-none">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-indigo-500" />
          Dashboard Overview
        </h1>
        <div className="action-buttons-container">
          <button 
            onClick={handleWhatsApp}
            disabled={isExporting}
            className="flex items-center gap-1.5 bg-emerald-500 text-white rounded-2xl px-5 py-2.5 font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
          >
            <Share2 className="h-5 w-5" /> 
            <span className="hidden sm:inline">{isExporting ? 'Sharing...' : 'WhatsApp'}</span>
            <span className="sm:hidden">{isExporting ? '...' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* 4 Main Metrics in a compact grid */}
      <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 shrink-0">
        <div className="bg-[#FDE047] text-black p-6 rounded-[32px] border-none flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3 opacity-80">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-sm sm:text-base font-bold">Receivable</span>
          </div>
          <span className="text-3xl lg:text-4xl font-black tracking-tighter break-all">{formatCurrency(totalOutstanding)}</span>
        </div>
        
        <div className="bg-[#818CF8] text-white p-6 rounded-[32px] border-none flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3 opacity-90">
            <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-sm sm:text-base font-bold">Received</span>
          </div>
          <span className="text-3xl lg:text-4xl font-black tracking-tighter break-all">{formatCurrency(totalReceived)}</span>
        </div>

        <div className="bg-[#FCA5A5] text-black p-6 rounded-[32px] border-none flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3 opacity-80">
            <ReceiptText className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-sm sm:text-base font-bold">Total Sales</span>
          </div>
          <span className="text-3xl lg:text-4xl font-black tracking-tighter break-all">{formatCurrency(totalSales)}</span>
        </div>

        <div className="bg-[#6EE7B7] text-black p-6 rounded-[32px] border-none flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3 opacity-80">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-sm sm:text-base font-bold">Month Sales</span>
          </div>
          <span className="text-3xl lg:text-4xl font-black tracking-tighter break-all">{formatCurrency(monthSales)}</span>
        </div>
      </div>

      {/* Main Content Area: Chart and Top Receivables */}
      <div className="w-full flex flex-col lg:flex-row gap-4 sm:gap-5 flex-1 min-h-0">
        
        {/* Chart Section */}
        <div className="flex-1 bg-white p-6 rounded-3xl shadow-sm border-none flex flex-col min-h-[240px]">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-4 shrink-0">Sales vs Collection (Last 6 Months)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} tickFormatter={(val) => `₹${val/1000}k`} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} formatter={(value: number) => formatCurrency(value)} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                <Bar dataKey="sales" name="Sales" fill="#FCA5A5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="collection" name="Collection" fill="#818CF8" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Receivables Section */}
        <div className="lg:w-80 bg-white p-6 rounded-3xl shadow-sm border-none flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Users className="h-6 w-6 text-rose-500" />
            <h3 className="text-lg sm:text-xl font-black text-slate-900">Top Receivables</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-2 scrollbar-hide">
            {partyOutstanding.length > 0 ? (
              partyOutstanding.map((party, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border-none shadow-sm">
                  <span className="text-sm font-bold text-slate-800 truncate pr-2">{party.name}</span>
                  <span className="text-base font-black text-rose-600 shrink-0">{formatCurrency(party.outstanding)}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-sm font-bold text-slate-400">
                No receivables found
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
