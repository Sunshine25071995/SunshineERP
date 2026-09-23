import React, { useEffect, useState, useRef } from 'react';
import { dbService } from '../db';
import { Bill, Party, Payment } from '../types';
import { formatCurrency } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, AlertCircle, Share2, ReceiptText, TrendingUp, Users } from 'lucide-react';
import { format, isThisMonth } from 'date-fns';
import { PaymentDueAlert } from '../../components/PaymentDueAlert';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export function Dashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const dashboardRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, []);

  const { isPulling } = usePullToRefresh(loadData);

  if (loading) {
    return <SkeletonLoader variant="metric" />;
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
    <div className="w-full flex flex-col space-y-4 pb-[100px] overflow-x-hidden font-sans animate-slide-up" ref={dashboardRef}>
      {isPulling && (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      )}
      {/* Header */}
      <div className="w-full flex items-center justify-between shrink-0 bg-transparent py-2 border-none">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Dashboard
        </h1>
        <button 
          onClick={handleWhatsApp}
          disabled={isExporting}
          className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-full px-5 py-2.5 font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
        >
          <Share2 className="h-5 w-5" /> 
          <span className="hidden sm:inline">{isExporting ? 'Sharing...' : 'Share'}</span>
        </button>
      </div>

      {/* 4 Main Metrics in a compact grid */}
      <div className="w-full grid grid-cols-2 gap-4 shrink-0">
        <div className="bg-[#FDE047] text-black p-5 rounded-[28px] border-none flex flex-col justify-between shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <span className="text-sm font-bold">Outstanding</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black tracking-tighter break-all">{formatCurrency(totalOutstanding)}</span>
        </div>
        
        <div className="bg-[#818CF8] text-white p-5 rounded-[28px] border-none flex flex-col justify-between shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <span className="text-sm font-bold">Received</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black tracking-tighter break-all">{formatCurrency(totalReceived)}</span>
        </div>

        <div className="bg-[#FCA5A5] text-black p-5 rounded-[28px] border-none flex flex-col justify-between shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <span className="text-sm font-bold">Total Sales</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black tracking-tighter break-all">{formatCurrency(totalSales)}</span>
        </div>

        <div className="bg-[#6EE7B7] text-black p-5 rounded-[28px] border-none flex flex-col justify-between shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <span className="text-sm font-bold">Month Sales</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black tracking-tighter break-all">{formatCurrency(monthSales)}</span>
        </div>
      </div>

      <PaymentDueAlert bills={bills} parties={parties} />

      {/* Main Content Area: Chart and Top Receivables */}
      <div className="w-full flex flex-col lg:flex-row gap-4 flex-1 mt-2">
        
        {/* Chart Section */}
        <div className="flex-1 bg-white p-5 rounded-[28px] shadow-sm border-none flex flex-col min-h-[300px]">
          <h3 className="text-lg font-bold text-slate-900 mb-4 shrink-0 tracking-tight">Sales vs Collection</h3>
          <div className="flex-1 min-h-[200px]">
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
        <div className="lg:w-80 flex flex-col shrink-0 gap-3">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight px-1 mt-2">Top Receivables</h3>
          <div className="flex flex-col gap-2">
            {partyOutstanding.length > 0 ? (
              partyOutstanding.map((party, idx) => (
                <div key={idx} className="flex items-center bg-white p-4 rounded-[24px] shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0 mr-4">
                    {party.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 truncate">{party.name}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-base font-black text-rose-600">{formatCurrency(party.outstanding)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-sm font-bold text-slate-400 bg-white rounded-[24px]">
                No receivables found
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
