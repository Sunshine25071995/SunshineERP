import React, { useState } from 'react';
import { User } from '../types';
import { LogIn, KeyRound, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ users, onLogin }) => {
  const [loginId, setLoginId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanId = loginId.trim();
    if (!cleanId) {
      setError('Please enter a Login ID.');
      return;
    }

    const matchedUser = users.find((u) => u.loginId === cleanId);
    if (!matchedUser) {
      setError(`Login ID "${cleanId}" not found in database.`);
      return;
    }

    if (!matchedUser.active) {
      setError(`User ID "${cleanId}" is currently deactivated.`);
      return;
    }

    onLogin(matchedUser);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-6 text-slate-900">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-xl">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Login</h2>
            <p className="text-xs text-slate-500">Enter your assigned Login ID to continue</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Login ID
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Enter Login ID"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              autoFocus
              id="login-id-input"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-sm"
            id="login-submit-btn"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In</span>
          </button>
        </form>
      </div>
    </div>
  );
};
