import React, { useState } from 'react';
import { Mail, Lock, Compass, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { fetchApi } from '../lib/api';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetchApi('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          isRegister: false
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Successful Auth
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col justify-between p-6 overflow-y-auto">
      {/* Top Brand Header */}
      <div className="flex flex-col items-center mt-6 mb-4">
        <div className="bg-blue-600 text-white p-3.5 rounded-[18px] shadow-md mb-3 flex items-center justify-center">
          <Compass size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">DN GPS Tracker</h2>
        <p className="text-slate-400 text-xs mt-1">Professional Fleet Tracking & Telemetry</p>
      </div>

      {/* Auth Box */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-5 mb-6">
        <div className="text-center mb-5">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Account Sign In</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Enter credentials to access your dashboard</p>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 bg-red-50 text-red-600 p-3 rounded-lg text-xs mb-4 border border-red-100"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Core Fields: Email & Password */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm disabled:bg-blue-400 mt-6 cursor-pointer"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              'Access Dashboard'
            )}
          </button>
        </form>
      </div>

      {/* Bottom Footer Info */}
      <div className="text-center text-[10px] text-slate-400 tracking-wide font-medium mt-auto">
        SECURED BY DN ENTERPRISE TRACKING NETWORK
      </div>
    </div>
  );
}
