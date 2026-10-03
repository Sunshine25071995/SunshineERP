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
    <div className="w-full flex flex-col space-y-6 pb-[100px] overflow-x-hidden font-sans animate-slide-up" ref={dashboardRef}>
      {isPulling && (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      )}
      
      {/* Header */}
      <div className="w-full flex items-center justify-between shrink-0 bg-transparent py-2 border-none">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Overview</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Payment Tracker Analytics</p>
        </div>
        <button 
          onClick={handleWhatsApp}
          disabled={isExporting}
          className="flex items-center gap-2 bg-slate-900 text-white rounded-full px-5 py-2.5 font-bold hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" /> 
          <span className="hidden sm:inline">{isExporting ? 'Sharing...' : 'Share Report'}</span>
        </button>
      </div>

      {/* Hero Metric - Outstanding */}
      <div className="w-full bg-gradient-to-br from-rose-500 to-rose-600 rounded-[32px] p-6 sm:p-8 text-white shadow-xl shadow-rose-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-rose-400 opacity-30 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm sm:text-base font-bold uppercase tracking-wider">Total Outstanding</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter drop-shadow-sm break-all">
            {formatCurrency(totalOutstanding)}
          </h2>
          <div className="mt-6 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-xs sm:text-sm font-bold">Top Defaulter:</span>
            <span className="text-xs sm:text-sm font-black truncate max-w-[150px]">{partyOutstanding[0]?.name || 'None'}</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="w-full grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-indigo-50 w-10 h-10 rounded-full flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md">This Month</span>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-500 mb-1">Total Sales</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(totalSales)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-50 w-10 h-10 rounded-full flex items-center justify-center">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md">All Time</span>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-500 mb-1">Total Received</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(totalReceived)}</p>
          </div>
        </div>
      </div>

      <PaymentDueAlert bills={bills} parties={parties} />

      {/* Main Content Area: Chart and Top Receivables */}
      <div className="w-full flex flex-col lg:flex-row gap-6 mt-4">
        
        {/* Chart Section */}
        <div className="flex-1 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Sales & Collections</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-200"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Sales</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-500"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Received</span></div>
            </div>
          </div>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} tickFormatter={(val) => `₹${val/1000}k`} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} formatter={(value: number) => formatCurrency(value)} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 'bold', padding: '12px'}} />
                <Bar dataKey="sales" name="Sales" fill="#e2e8f0" radius={[8, 8, 8, 8]} maxBarSize={30} />
                <Bar dataKey="collection" name="Collection" fill="#6366f1" radius={[8, 8, 8, 8]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Receivables Section */}
        <div className="lg:w-96 flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Top Receivables</h3>
            <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">High Priority</span>
          </div>
          <div className="flex flex-col gap-3">
            {partyOutstanding.length > 0 ? (
              partyOutstanding.map((party, idx) => (
                <div key={idx} className="flex items-center bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 transition-transform hover:-translate-y-0.5">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-black text-lg shrink-0 mr-4 border border-rose-100">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{party.name}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">Outstanding Balance</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-base font-black text-rose-600">{formatCurrency(party.outstanding)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center bg-slate-50 rounded-[28px] border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-slate-900">All Clear!</p>
                <p className="text-xs font-medium text-slate-500 mt-1">No outstanding receivables found.</p>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
