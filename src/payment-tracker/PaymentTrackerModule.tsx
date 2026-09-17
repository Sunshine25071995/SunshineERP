import React, { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Parties } from './pages/Parties';
import { PartyLedger } from './pages/PartyLedger';
import { Bills } from './pages/Bills';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { LayoutDashboard, Users, Receipt, CreditCard, FileText } from 'lucide-react';
import { cn } from './utils';

export function PaymentTrackerModule() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>();

  const handleNavigate = (view: string, id?: string) => {
    setCurrentView(view);
    if (id) setSelectedPartyId(id);
  };

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'parties', name: 'Parties', icon: Users },
    { id: 'bills', name: 'Bills', icon: Receipt },
    { id: 'payments', name: 'Payments', icon: CreditCard },
    { id: 'reports', name: 'Reports', icon: FileText },
  ];

  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-50 overflow-hidden rounded-xl shadow-inner border border-slate-200">
      {/* Sidebar */}
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
                    "w-full flex items-center py-3 px-4 font-medium rounded-xl transition-colors text-left",
                    isActive 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 flex-shrink-0 mr-3", isActive ? "text-indigo-700" : "text-slate-400")} />
                  <span className="whitespace-nowrap">{item.name}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'parties' && <Parties onNavigate={handleNavigate} />}
          {currentView === 'partyLedger' && <PartyLedger id={selectedPartyId} onNavigate={handleNavigate} />}
          {currentView === 'bills' && <Bills />}
          {currentView === 'payments' && <Payments />}
          {currentView === 'reports' && <Reports />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
        <nav className="flex justify-around items-center h-16 px-1">
          {navigation.map((item) => {
            const isActive = currentView === item.id || (item.id === 'parties' && currentView === 'partyLedger');
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative",
                  isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 bg-indigo-600 rounded-b-full"></span>
                )}
                <item.icon className={cn("h-5 w-5", isActive && "text-indigo-600")} />
                <span className="text-[10px] font-medium leading-none">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
