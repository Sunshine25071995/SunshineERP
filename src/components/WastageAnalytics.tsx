import React, { useMemo } from 'react';
import { ProductionWastage, JobCard } from '../types';
import { getPartyName } from '../utils/parties';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';
import { formatWeight } from '../utils/formatters';

interface WastageAnalyticsProps {
  wastages: ProductionWastage[];
  jobCards: JobCard[];
}

export const WastageAnalytics: React.FC<WastageAnalyticsProps> = ({ wastages, jobCards }) => {
  const { totalWastage, avgWastage, highestWastageJob, jobWastageData, dailyWastageData } = useMemo(() => {
    let totalWastage = 0;
    const jobWastageMap = new Map<string, number>();
    const dailyWastageMap = new Map<string, number>();
    let highestJob = { jobCode: '-', amount: 0 };

    wastages.forEach(w => {
      totalWastage += w.wastageWeight;
      
      const currentJobWastage = (jobWastageMap.get(w.jobCardId) || 0) + w.wastageWeight;
      jobWastageMap.set(w.jobCardId, currentJobWastage);
      
      const currentDaily = (dailyWastageMap.get(w.date) || 0) + w.wastageWeight;
      dailyWastageMap.set(w.date, currentDaily);
    });

    const jobWastageData = Array.from(jobWastageMap.entries()).map(([jobId, amount]) => {
      const jc = jobCards.find(j => j.id === jobId);
      if (amount > highestJob.amount) {
        highestJob = { jobCode: jc?.jobCode || '-', amount };
      }
      return {
        name: jc?.jobCode || 'Unknown',
        amount,
        party: jc ? getPartyName(jc.partyCode) : '-'
      };
    }).sort((a, b) => b.amount - a.amount).slice(0, 10);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyWastageData = Array.from(dailyWastageMap.entries())
      .filter(([date]) => new Date(date) >= thirtyDaysAgo)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, amount]) => {
        const d = new Date(date);
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
        return { date: dateStr, amount };
      });

    const avgWastage = jobWastageMap.size > 0 ? totalWastage / jobWastageMap.size : 0;

    return { totalWastage, avgWastage, highestWastageJob: highestJob, jobWastageData, dailyWastageData };
  }, [wastages, jobCards]);

  return (
    <div className="space-y-4 animate-fade-in w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="app-card rounded-[28px] shadow-sm border-none p-5 bg-gradient-to-br from-red-500 to-red-600 text-white flex flex-col justify-center">
          <span className="text-sm font-semibold opacity-90 uppercase tracking-wider">Total Wastage</span>
          <span className="text-3xl font-black mt-1">{formatWeight(totalWastage)} <span className="text-lg font-medium opacity-80">kg</span></span>
        </div>
        <div className="app-card rounded-[28px] shadow-sm border-none p-5 bg-white flex flex-col justify-center">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Avg per Job</span>
          <span className="text-3xl font-black text-gray-900 mt-1">{formatWeight(avgWastage)} <span className="text-lg font-medium text-gray-400">kg</span></span>
        </div>
        <div className="app-card rounded-[28px] shadow-sm border-none p-5 bg-white flex flex-col justify-center">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Highest Wastage Job</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-amber-600">{highestWastageJob.jobCode}</span>
            <span className="text-sm font-bold text-gray-400">({formatWeight(highestWastageJob.amount)} kg)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="app-card rounded-[28px] shadow-sm border-none p-5 bg-white">
          <h3 className="text-base font-bold text-gray-900 mb-4">Top 10 Jobs by Wastage</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jobWastageData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} name="Wastage (kg)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="app-card rounded-[28px] shadow-sm border-none p-5 bg-white">
          <h3 className="text-base font-bold text-gray-900 mb-4">Daily Wastage Trend (Last 30 Days)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyWastageData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} name="Wastage (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
