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
    <div className="flex flex-col items-center justify-center bg-slate-50 px-5 py-12 h-full" style={{ minHeight: 'calc(100vh - 80px)' }}>
      {/* Brand / Splash style */}
      <div className="flex flex-col items-center mb-10 animate-fade-in text-center">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-xl mb-6">
          <svg viewBox="0 0 24 24" className="w-12 h-12" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">Sunshine ERP</h1>
        <p className="text-base text-slate-500 font-medium">Factory Management System</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm animate-slide-up bg-white rounded-[2rem] shadow-sm p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h2>
        <p className="text-sm text-slate-500 mb-6">Enter your assigned Login ID to continue</p>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Login ID
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Enter your Login ID"
              className="w-full bg-slate-100 rounded-t-lg border-b-2 border-slate-400 focus:border-indigo-600 focus:bg-indigo-50/50 px-4 py-3.5 text-lg font-mono font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none transition-all"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              id="login-id-input"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center gap-2 transition-all text-base disabled:opacity-60 disabled:cursor-not-allowed"
            id="login-submit-btn"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-sm font-medium text-slate-400 mt-10">
        Sunshine Industries · All rights reserved
      </p>
    </div>
  );
};
