import { useEffect, useState } from 'react';
import axios from 'axios';
import { HiOutlineBars3, HiOutlineMagnifyingGlass, HiOutlineMoon, HiOutlineSun } from 'react-icons/hi2';
import { useTheme } from '../../services/theme/themeProvider';

// Polls the API health endpoint so the indicator reflects reality.
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

const API_STATUS = {
  up: { label: 'API up', dot: 'bg-s2', text: 'text-ink-2' },
  down: { label: 'API unreachable', dot: 'bg-s5', text: 'text-s5 font-semibold' },
  checking: { label: 'Checking API', dot: 'bg-ink-3', text: 'text-ink-2' },
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export default function Header({ onMenuToggle, onSearch }) {
  const { dark, toggleTheme } = useTheme();
  const api = API_STATUS[useApiStatus()];

  return (
    <header className='sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center gap-3 border-b border-rule/70 bg-canvas/85 backdrop-blur-md'>
      <button
        type='button'
        onClick={onMenuToggle}
        className='lg:hidden -ml-1.5 p-1.5 rounded-md text-ink-2 hover:bg-sunk hover:text-ink'
        aria-label='Open navigation'
      >
        <HiOutlineBars3 className='text-xl' aria-hidden='true' />
      </button>

      <button
        type='button'
        onClick={onSearch}
        className='flex flex-1 max-w-md items-center gap-2 h-9 rounded-lg border border-rule bg-paper shadow-e1 px-3 text-sm text-ink-2 hover:border-rule-strong transition-colors'
        aria-label='Search assets and pages, or check a domain or IP'
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      >
        <HiOutlineMagnifyingGlass className='flex-shrink-0' aria-hidden='true' />
        <span className='truncate'>Search, or check a domain or IP</span>
        <kbd className='ml-auto hidden sm:inline rounded border border-rule bg-paper px-1.5 text-2xs text-ink-2'>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <div className='ml-auto flex items-center gap-1 sm:gap-3'>
        <p role='status' className={`hidden md:flex items-center gap-1.5 text-xs ${api.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${api.dot}`} aria-hidden='true' /> {api.label}
        </p>
        <button
          type='button'
          onClick={toggleTheme}
          className='p-2 rounded-md text-ink-2 hover:bg-sunk hover:text-ink transition-colors'
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {dark ? <HiOutlineSun className='text-lg' aria-hidden='true' /> : <HiOutlineMoon className='text-lg' aria-hidden='true' />}
        </button>
      </div>
    </header>
  );
}
