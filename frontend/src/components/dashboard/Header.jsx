import React from 'react';
import { HiOutlineLogout, HiShieldCheck } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';

export default function Header() {
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const handleLogout = () => {
    setToken(null);
    navigate('/', { replace: true });
  };

  return (
    <header className='h-16 px-6 flex items-center justify-between border-b border-slate-200 bg-white'>
      <div>
        <p className='text-sm text-slate-500'>Security Dashboard</p>
        <h1 className='text-lg font-semibold text-slate-900'>Realtime Blacklist Monitoring</h1>
      </div>
      <div className='flex items-center gap-4'>
        <div className='hidden md:flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 text-xs font-semibold'>
          <HiShieldCheck className='text-sm' /> API Connected
        </div>
        <button
          onClick={handleLogout}
          className='inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors'
        >
          <HiOutlineLogout /> Sign out
        </button>
      </div>
    </header>
  );
}
