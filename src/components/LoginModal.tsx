import React, { useState } from 'react';
import { User } from '../types';
import { LogIn, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ users, onLogin }) => {
  const [loginId, setLoginId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    await new Promise(r => setTimeout(r, 300)); // Brief visual feedback

    const cleanId = loginId.trim();
    if (!cleanId) {
      setError('Please enter your Login ID.');
      setIsLoading(false);
      return;
    }

    const matchedUser = users.find((u) => u.loginId === cleanId);
    if (!matchedUser) {
      setError(`Login ID "${cleanId}" not found.`);
      setIsLoading(false);
      return;
    }

    if (!matchedUser.active) {
      setError(`User "${cleanId}" is deactivated. Contact admin.`);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    onLogin(matchedUser);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-5 py-12" style={{ paddingBottom: 'max(48px, var(--safe-bottom))' }}>

      {/* Brand */}
      <div className="flex flex-col items-center mb-10 animate-fade-in">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl mb-4">
          <svg viewBox="0 0 24 24" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Sunshine ERP</h1>
        <p className="text-sm text-gray-500 mt-1">Factory Management System</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm animate-slide-up">
        <div className="app-card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Sign In</h2>
          <p className="text-sm text-gray-500 mb-5">Enter your assigned Login ID to continue</p>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Login ID
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter your Login ID"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-base font-mono font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-sans placeholder:font-normal focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                id="login-id-input"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-sm btn-press disabled:opacity-60"
              id="login-submit-btn"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Sunshine Industries · All rights reserved
        </p>
      </div>
    </div>
  );
};
