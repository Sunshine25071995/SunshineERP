import React from 'react';
import { User } from '../types';
import { LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
  isLive: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onLogout }) => {
  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-end min-h-[44px]">
        {currentUser && (
          <button
            onClick={onLogout}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl border border-slate-300 transition-colors flex items-center justify-center"
            title="Log Out"
            id="logout-btn"
          >
            <LogOut className="w-5 h-5 text-slate-700" />
          </button>
        )}
      </div>
    </header>
  );
};

