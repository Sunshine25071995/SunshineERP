import { JobCard, SlittingRoll } from '../types';
import React, { useState, useEffect } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Parties } from './pages/Parties';
import { PartyLedger } from './pages/PartyLedger';
import { Bills } from './pages/Bills';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { LayoutDashboard, Users, Receipt, CreditCard, FileText } from 'lucide-react';
import { cn } from './utils';

interface PaymentTrackerModuleProps {
  jobCards?: JobCard[];
  slitRolls?: SlittingRoll[];
}

export function PaymentTrackerModule({ jobCards = [], slitRolls = [] }: PaymentTrackerModuleProps = {}) {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>();

  useEffect(() => {
    window.history.replaceState({ paymentView: 'dashboard' }, '');
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.paymentView) {
        setCurrentView(e.state.paymentView);
        if (e.state.partyId) setSelectedPartyId(e.state.partyId);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (view: string, id?: string) => {
    setCurrentView(view);
    if (id) setSelectedPartyId(id);
    window.history.pushState({ paymentView: view, partyId: id }, '');
  };

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'parties', name: 'Parties', icon: Users },
    { id: 'bills', name: 'Bills', icon: Receipt },
    { id: 'payments', name: 'Payments', icon: CreditCard },
    { id: 'reports', name: 'Reports', icon: FileText },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-0 md:h-[calc(100vh-140px)] bg-slate-50 md:overflow-hidden w-full">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white shadow-xl z-20 border-r border-slate-100">
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = currentView === item.id || (item.id === 'parties' && currentView === 'partyLedger');
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center py-3 px-4 font-bold rounded-xl transition-all text-left",
                    isActive 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 flex-shrink-0 mr-3", isActive ? "text-white" : "text-slate-400")} />
                  <span className="whitespace-nowrap">{item.name}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Top Navigation (Sticky & Touch-Friendly Pill Bar) */}
      <div className="md:hidden sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md overflow-x-auto hide-scrollbar shrink-0 px-2 sm:px-4 py-2.5 border-b border-slate-200/80 w-full shadow-xs">
        <nav className="flex space-x-2">
          {navigation.map((item) => {
            const isActive = currentView === item.id || (item.id === 'parties' && currentView === 'partyLedger');
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={cn(
                  "flex items-center whitespace-nowrap px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all active:scale-95",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25" 
                    : "bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-100 shadow-xs"
                )}
              >
                <item.icon className={cn("h-4 w-4 mr-1.5", isActive ? "text-white" : "text-slate-500")} />
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-h-0 relative w-full md:overflow-hidden">
        <main className="flex-1 p-2.5 sm:p-4 md:p-6 lg:p-8 pb-[100px] md:pb-8 w-full md:overflow-y-auto">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'parties' && <Parties onNavigate={handleNavigate} jobCards={jobCards} slitRolls={slitRolls} />}
          {currentView === 'partyLedger' && <PartyLedger id={selectedPartyId} onNavigate={handleNavigate} />}
          {currentView === 'bills' && <Bills />}
          {currentView === 'payments' && <Payments />}
          {currentView === 'reports' && <Reports />}
        </main>
      </div>
    </div>
  );
}
