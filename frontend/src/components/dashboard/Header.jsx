import { useEffect, useState } from 'react';
import axios from 'axios';
import { HiOutlineLogout, HiMoon, HiSun, HiMenu, HiSearch } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';
import { useTheme } from '../../services/theme/themeProvider';

const iconButton =
  'inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors';

// Polls the API health endpoint so the badge reflects reality.
function useApiStatus() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      axios.get('/api/health', { timeout: 8000 })
        .then(() => !cancelled && setStatus('up'))
        .catch(() => !cancelled && setStatus('down'));
    };
    check();
    const timer = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  return status;
}

const STATUS_STYLES = {
  up: { label: 'API connected', dot: 'bg-emerald-500', box: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800' },
  down: { label: 'API unreachable', dot: 'bg-rose-500', box: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800' },
  checking: { label: 'Checking API', dot: 'bg-slate-400', box: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600' },
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export default function Header({ onMenuToggle, onSearch }) {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const apiStatus = STATUS_STYLES[useApiStatus()];

  const handleLogout = () => {
    setToken(null, null);
    navigate('/', { replace: true });
  };

  return (
    <header className='sticky top-0 z-30 h-16 px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur'>
      <div className='flex items-center gap-3 min-w-0'>
        <button type='button' onClick={onMenuToggle} className={`lg:hidden ${iconButton} border-transparent`} aria-label='Open navigation'>
          <HiMenu className='text-xl' aria-hidden='true' />
        </button>
        <div className='min-w-0'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>Security dashboard</p>
          <p className='text-lg font-semibold text-slate-900 dark:text-white truncate'>Blacklist monitoring</p>
        </div>
      </div>
      <div className='flex items-center gap-2 sm:gap-3'>
        <button
          type='button'
          onClick={onSearch}
          className='inline-flex items-center gap-2 h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors'
          aria-label='Search assets and pages'
          aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        >
          <HiSearch aria-hidden='true' />
          <span className='hidden lg:inline'>Search</span>
          <kbd className='hidden lg:inline rounded border border-slate-300 dark:border-slate-600 px-1.5 text-[11px] font-sans font-semibold'>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <div role='status' className={`hidden md:flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs font-semibold ${apiStatus.box}`}>
          <span className={`h-2 w-2 rounded-full ${apiStatus.dot}`} aria-hidden='true' /> {apiStatus.label}
        </div>
        <button
          type='button'
          onClick={toggleTheme}
          className={iconButton}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <HiSun className='text-lg' aria-hidden='true' /> : <HiMoon className='text-lg' aria-hidden='true' />}
        </button>
        <button
          type='button'
          onClick={handleLogout}
          className='inline-flex items-center gap-2 h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors'
        >
          <HiOutlineLogout aria-hidden='true' /> <span className='hidden sm:inline'>Sign out</span><span className='sr-only sm:hidden'>Sign out</span>
        </button>
      </div>
    </header>
  );
}
