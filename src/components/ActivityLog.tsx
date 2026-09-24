import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';
import { ensureInitialActivityLog } from '../services/activityLog';

interface ActivityLogEntry {
  id: string;
  action: string;
  details: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        await ensureInitialActivityLog();
        let fetchedLogs: ActivityLogEntry[] = [];
        try {
          const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(50));
          const snapshot = await getDocs(q);
          snapshot.forEach((doc) => {
            fetchedLogs.push({ id: doc.id, ...doc.data() } as ActivityLogEntry);
          });
        } catch (err1) {
          console.warn('Ordered query failed, falling back to unordered fetch:', err1);
          const snapshot = await getDocs(collection(db, 'activityLogs'));
          snapshot.forEach((doc) => {
            fetchedLogs.push({ id: doc.id, ...doc.data() } as ActivityLogEntry);
          });
          fetchedLogs.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
          fetchedLogs = fetchedLogs.slice(0, 50);
        }
        setLogs(fetchedLogs);
      } catch (error) {
        console.error('Error fetching activity logs:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in w-full">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="app-card p-4 flex items-center gap-4 bg-white rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 animate-pulse"></div>
            </div>
            <div className="h-3 bg-slate-200 rounded w-20 animate-pulse shrink-0"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in w-full">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-black text-gray-900">Recent Activity</h2>
      </div>
      
      {logs.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400 bg-slate-50 rounded-2xl">
          No activity recorded yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => (
            <div key={log.id} className="app-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-black text-indigo-700">
                    {log.userName ? log.userName.charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0 ml-14 sm:ml-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  {log.userName}
                </p>
                <p className="text-[11px] text-gray-400">
                  {log.timestamp ? format(new Date(log.timestamp), 'dd MMM, hh:mm a') : 'Unknown'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
