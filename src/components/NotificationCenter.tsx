import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, TrendingUp, FlaskConical, ReceiptText, CheckCircle2 } from 'lucide-react';
import { JobCard, Chemical, ChemicalPurchase, ChemicalUsage } from '../types';
import { dbService } from '../payment-tracker/db';
import { Bill, Payment, Party } from '../payment-tracker/types';
import { formatCurrency } from '../payment-tracker/utils';

interface NotificationCenterProps {
  jobCards: JobCard[];
  chemicals: Chemical[];
  purchases: ChemicalPurchase[];
  usages: ChemicalUsage[];
}

interface AppNotification {
  id: string;
  type: 'jobcard' | 'payment' | 'low_stock' | 'overdue_bill';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  icon: React.ReactNode;
}

export function NotificationCenter({ jobCards, chemicals, purchases, usages }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function generateNotifications() {
      const newNotifications: AppNotification[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayStr = today.toISOString().split('T')[0];

      // 1. Job cards created today
      jobCards.forEach(jc => {
        let isToday = false;
        if (jc.createdAt?.toDate) {
           const d = jc.createdAt.toDate();
           if (d >= today) isToday = true;
        } else if (jc.date && jc.date.startsWith(todayStr)) {
           isToday = true;
        }
        
        if (isToday) {
          newNotifications.push({
            id: `jc-${jc.id}`,
            type: 'jobcard',
            title: 'New Job Card',
            message: `New job card created: ${jc.jobCode}`,
            timestamp: jc.createdAt?.toMillis ? jc.createdAt.toMillis() : Date.now(),
            read: false,
            icon: <TrendingUp className="w-5 h-5 text-indigo-600" />
          });
        }
      });

      // 2. Low chemical stock
      chemicals.forEach(c => {
        const totalPurchased = purchases.filter(p => p.chemicalId === c.id).reduce((s, p) => s + (p.quantity || 0), 0);
        const totalUsed = usages.filter(u => u.chemicalId === c.id).reduce((s, u) => s + (u.quantityUsed || 0), 0);
        const stock = totalPurchased - totalUsed;
        
        if (stock < 10) {
          newNotifications.push({
            id: `chem-${c.id}`,
            type: 'low_stock',
            title: 'Low Chemical Stock',
            message: `Low chemical stock: ${c.name} (${stock.toFixed(2)} ${c.unit} remaining)`,
            timestamp: Date.now(),
            read: false,
            icon: <FlaskConical className="w-5 h-5 text-amber-600" />
          });
        }
      });

      // Fetch payment data
      try {
        const [bills, payments, parties] = await Promise.all([
          dbService.getBills(),
          dbService.getPayments(),
          dbService.getParties()
        ]);

        const partyMap = parties.reduce((acc, p) => { acc[p.id] = p.party_name; return acc; }, {} as Record<string, string>);

        // 3. Payment received today
        payments.forEach(p => {
          if (p.payment_date >= today.getTime()) {
            newNotifications.push({
              id: `pay-${p.id}`,
              type: 'payment',
              title: 'Payment Received',
              message: `Payment received: ${formatCurrency(p.amount)} from ${partyMap[p.party_id] || 'Unknown'}`,
              timestamp: p.payment_date,
              read: false,
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            });
          }
        });

        // 4. Overdue bill > 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        bills.forEach(b => {
          if (b.outstanding_amount > 0 && b.bill_date < thirtyDaysAgo) {
            const days = Math.floor((Date.now() - b.bill_date) / (24 * 60 * 60 * 1000));
            newNotifications.push({
              id: `bill-${b.id}`,
              type: 'overdue_bill',
              title: 'Overdue Bill',
              message: `Overdue bill: ${b.bill_number} from ${partyMap[b.party_id] || 'Unknown'} (${days} days)`,
              timestamp: b.bill_date,
              read: false,
              icon: <AlertCircle className="w-5 h-5 text-rose-600" />
            });
          }
        });
      } catch (error) {
        console.error("Error fetching payment data for notifications", error);
      }

      // Merge with read state from localStorage
      const readState = JSON.parse(localStorage.getItem('sunshine_notifications_read') || '{}');
      
      const finalNotifications = newNotifications.map(n => ({
        ...n,
        read: readState[n.id] || false
      })).sort((a, b) => b.timestamp - a.timestamp);

      setNotifications(finalNotifications);
    }

    generateNotifications();
  }, [jobCards, chemicals, purchases, usages]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    const newReadState = JSON.parse(localStorage.getItem('sunshine_notifications_read') || '{}');
    notifications.forEach(n => {
      newReadState[n.id] = true;
    });
    localStorage.setItem('sunshine_notifications_read', JSON.stringify(newReadState));
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    const newReadState = JSON.parse(localStorage.getItem('sunshine_notifications_read') || '{}');
    newReadState[id] = true;
    localStorage.setItem('sunshine_notifications_read', JSON.stringify(newReadState));
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-rose-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-[28px] shadow-lg border border-slate-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto p-2">
            {notifications.length > 0 ? (
              <div className="space-y-1">
                {notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => markAsRead(notif.id)}
                    className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${notif.read ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}
                  >
                    <div className={`p-2 rounded-full shrink-0 ${notif.read ? 'bg-slate-100' : 'bg-white shadow-sm'}`}>
                      {notif.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notif.read ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-2"></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">
                No notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
