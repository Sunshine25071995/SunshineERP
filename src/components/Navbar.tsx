import React from 'react';
import { User } from '../types';
import { LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
  isLive: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onLogout, isLive }) => {
  const deptColor: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    production: 'bg-emerald-100 text-emerald-800',
    slitting: 'bg-blue-100 text-blue-800',
    chemical: 'bg-amber-100 text-amber-800',
  };

  const dept = currentUser?.department || '';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-black text-gray-900 tracking-tight">Sunshine</div>
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest -mt-0.5">ERP System</div>
          </div>
        </div>

        {/* Live dot */}
        {isLive && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot"></div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live</span>
          </div>
        )}

        {/* Right: user + logout */}
        {currentUser && (
          <div className="flex items-center gap-2 ml-auto">
            {/* User chip — hidden on very small screens */}
            <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider ${deptColor[dept] || 'bg-gray-100 text-gray-700'}`}>
                {dept}
              </div>
              <span className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">{currentUser.name}</span>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 border border-gray-200 transition-colors btn-press"
              title="Log Out"
              id="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
