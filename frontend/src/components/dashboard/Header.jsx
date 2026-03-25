import React from 'react';
import { HiOutlineLogout, HiShieldCheck, HiMoon, HiSun, HiMenu } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';
import { useTheme } from '../../services/theme/themeProvider';

export default function Header({ onMenuToggle }) {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const { dark, toggleTheme } = useTheme();

  const handleLogout = () => {
    setToken(null, null);
    navigate('/', { replace: true });
  };

  return (
    <header className='h-16 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'>
      <div className='flex items-center gap-3'>
        <button
          onClick={onMenuToggle}
          className='lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'
        >
          <HiMenu className='text-xl' />
        </button>
        <div>
          <p className='text-sm text-slate-500 dark:text-slate-400'>Security Dashboard</p>
          <h1 className='text-lg font-semibold text-slate-900 dark:text-white'>Realtime Blacklist Monitoring</h1>
        </div>
      </div>
      <div className='flex items-center gap-3'>
        <div className='hidden md:flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-full px-3 py-1.5 text-xs font-semibold'>
          <HiShieldCheck className='text-sm' /> API Connected
        </div>
        <button
          onClick={toggleTheme}
          className='p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors'
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <HiSun className="text-lg" /> : <HiMoon className="text-lg" />}
        </button>
        <button
          onClick={handleLogout}
          className='inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors'
        >
          <HiOutlineLogout /> <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
