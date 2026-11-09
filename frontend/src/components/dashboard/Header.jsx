import { useEffect, useState } from 'react';
import axios from 'axios';
import { Menu, Transition } from '@headlessui/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineCog6Tooth,
  HiOutlineMagnifyingGlass,
  HiOutlineMoon,
  HiOutlineSun,
} from 'react-icons/hi2';
import classNames from 'classnames';
import { useTheme } from '../../services/theme/themeProvider';
import { useAuth } from '../../services/auth/authProvider';
import { logoutUser } from '../../services/auth/authService';
import useCurrentUser from '../../services/users/useCurrentUser';

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

/** Up to two letters from the name, which is all an avatar this size can hold. */
function initials(name) {
  const parts = (name || '').trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const itemClass = 'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors';

function AccountMenu() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const signOut = async () => {
    await logoutUser();
    setToken(null, null);
    navigate('/', { replace: true });
  };

  return (
    <Menu as='div' className='relative'>
      <Menu.Button
        className='flex items-center gap-2 rounded-md p-1 pr-1.5 text-sm text-ink-2 hover:bg-sunk hover:text-ink transition-colors'
        aria-label={me ? `Account: ${me.username}` : 'Account'}
      >
        <span
          className='flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold text-accent'
          aria-hidden='true'
        >
          {initials(me?.username)}
        </span>
        <span className='hidden sm:inline max-w-[9rem] truncate font-medium text-ink'>{me?.username || '\u2026'}</span>
      </Menu.Button>

      <Transition
        enter='transition ease-out duration-100'
        enterFrom='opacity-0 scale-95'
        enterTo='opacity-100 scale-100'
        leave='transition ease-in duration-75'
        leaveFrom='opacity-100 scale-100'
        leaveTo='opacity-0 scale-95'
      >
        <Menu.Items className='absolute right-0 mt-1.5 w-60 origin-top-right overflow-hidden rounded-lg border border-rule bg-paper shadow-e2 focus:outline-none'>
          <div className='border-b border-rule px-3 py-2.5'>
            <p className='truncate text-sm font-semibold text-ink'>{me?.username || 'Signed in'}</p>
            {me?.email && <p className='truncate text-xs text-ink-2'>{me.email}</p>}
            {me?.is_superuser && (
              <p className='mt-1 text-2xs font-medium uppercase tracking-wide text-ink-2'>Administrator</p>
            )}
          </div>
          <Menu.Item>
            {({ active }) => (
              <Link
                to='/dashboard/settings'
                className={classNames(itemClass, 'hover:no-underline', active ? 'bg-sunk text-ink' : 'text-ink-2')}
              >
                <HiOutlineCog6Tooth className='text-base' aria-hidden='true' /> Settings
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button type='button' onClick={signOut} className={classNames(itemClass, active ? 'bg-sunk text-s5' : 'text-ink-2')}>
                <HiOutlineArrowRightOnRectangle className='text-base' aria-hidden='true' /> Sign out
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

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
        className='flex flex-1 min-w-0 max-w-md items-center gap-2 h-9 rounded-lg border border-rule bg-paper shadow-e1 px-3 text-sm text-ink-2 hover:border-rule-strong transition-colors'
        aria-label='Search assets and pages, or check a domain or IP'
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      >
        <HiOutlineMagnifyingGlass className='flex-shrink-0' aria-hidden='true' />
        <span className='truncate'>Search, or check a domain or IP</span>
        <kbd className='ml-auto hidden sm:inline rounded border border-rule bg-paper px-1.5 text-2xs text-ink-2'>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <div className='ml-auto flex flex-shrink-0 items-center gap-1 sm:gap-3'>
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
        <AccountMenu />
      </div>
    </header>
  );
}
