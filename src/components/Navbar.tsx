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
    <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white border-b border-blue-950 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between min-h-[56px]">
        
        {/* App Branding */}
        <div className="flex items-center gap-2">
          <div className="bg-amber-400 p-1.5 rounded-lg shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-900" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 4.22a1 1 0 011.415 0l.708.708a1 1 0 01-1.414 1.414l-.708-.708a1 1 0 010-1.414zM16 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zm-4.22 4.22a1 1 0 010 1.415l-.708.708a1 1 0 01-1.414-1.414l.708-.708a1 1 0 011.414 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-4.22a1 1 0 01-1.415 0l-.708-.708a1 1 0 011.414-1.414l.708.708a1 1 0 010 1.414zM4 10a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm4.22-4.22a1 1 0 010-1.415l.708-.708a1 1 0 011.414 1.414l-.708.708a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide leading-tight text-white drop-shadow-sm">SUNSHINE</h1>
            <p className="text-[10px] font-bold text-blue-200 tracking-widest uppercase">ERP System</p>
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-1 pr-3 border border-white/20 backdrop-blur-sm shadow-inner hidden sm:flex">
               <div className="bg-blue-800 text-blue-100 font-bold px-2 py-1 rounded-xl text-xs uppercase tracking-wider">
                 {currentUser.department}
               </div>
               <span className="text-sm font-semibold text-white drop-shadow-sm">{currentUser.name}</span>
            </div>
          )}
          
          {currentUser && (
            <button
              onClick={onLogout}
              className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl border border-white/20 transition-all flex items-center justify-center shadow-sm backdrop-blur-sm"
              title="Log Out"
              id="logout-btn"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

