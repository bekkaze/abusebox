import { useState } from 'react';
import { HiOutlineBars3, HiOutlineMoon, HiOutlineSun, HiXMark } from 'react-icons/hi2';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';
import { useTheme } from '../../services/theme/themeProvider';
import { secondaryButtonClass } from '../shared/ui';

const GITHUB_URL = 'https://github.com/bekkaze/abusebox';

const linkItemClass =
  'inline-flex items-center h-9 px-3 rounded-md text-sm font-medium text-ink-2 hover:text-ink hover:bg-sunk transition-colors ' +
  'aria-[current=page]:text-ink';

const menuItemClass =
  'flex items-center h-10 px-3 -mx-3 rounded-md text-sm font-medium text-ink-2 hover:text-ink hover:bg-sunk aria-[current=page]:text-ink';

const Navbar = () => {
  const { token } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [nav, setNav] = useState(false);
  const close = () => setNav(false);

  const quickCheckCurrent = pathname === '/quick-check' ? 'page' : undefined;
  const account = token
    ? { to: '/dashboard', label: 'Open dashboard' }
    : { to: '/login', label: 'Sign in' };
  const themeLabel = dark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <header className='sticky top-0 z-20 border-b border-rule/70 bg-canvas/85 backdrop-blur-md'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2'>
        <Link to='/' onClick={close} className='flex items-center gap-2.5 mr-auto rounded-md'>
          <img src='/logo.png' alt='' className='h-7 w-7 rounded-md object-cover' />
          <span className='text-[15px] font-semibold tracking-tight text-ink'>AbuseBox</span>
        </Link>

        <nav aria-label='Main' className='hidden sm:flex items-center gap-1'>
          <Link to='/quick-check' className={linkItemClass} aria-current={quickCheckCurrent}>Quick check</Link>
          <a href={GITHUB_URL} className={linkItemClass} target='_blank' rel='noreferrer'>GitHub</a>
        </nav>

        <button
          type='button'
          onClick={toggleTheme}
          className='p-2 rounded-md text-ink-2 hover:bg-sunk hover:text-ink transition-colors'
          aria-label={themeLabel}
          title={themeLabel}
        >
          {dark ? <HiOutlineSun className='text-lg' aria-hidden='true' /> : <HiOutlineMoon className='text-lg' aria-hidden='true' />}
        </button>

        <Link to={account.to} onClick={close} className={`${secondaryButtonClass} ml-1`}>{account.label}</Link>

        <button
          type='button'
          onClick={() => setNav((prev) => !prev)}
          className='sm:hidden p-2 -mr-2 rounded-md text-ink-2 hover:bg-sunk hover:text-ink'
          aria-label={nav ? 'Close menu' : 'Open menu'}
          aria-expanded={nav}
          aria-controls='landing-menu'
        >
          {nav ? <HiXMark className='text-xl' aria-hidden='true' /> : <HiOutlineBars3 className='text-xl' aria-hidden='true' />}
        </button>
      </div>

      {nav ? (
        <nav id='landing-menu' aria-label='Main' className='sm:hidden border-t border-rule px-4 py-2 bg-paper'>
          <Link to='/quick-check' onClick={close} className={menuItemClass} aria-current={quickCheckCurrent}>Quick check</Link>
          <a href={GITHUB_URL} onClick={close} className={menuItemClass} target='_blank' rel='noreferrer'>GitHub</a>
        </nav>
      ) : null}
    </header>
  );
};

export default Navbar;
